// B2 OWNED seam onto B3's tables. See the header of quote-reader.service.ts.

import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@dealflow/contracts';
import { AppError } from '../../shared/app-error';
import { PrismaService } from '../../shared/prisma.service';
import type { StockRow } from '../engine/allocation';
import type { UpsellCandidate } from '../engine/upsell';

@Injectable()
export class OpsReaderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * available = onHand - reserved, computed here and never stored (invariant,
   * plan.md section 6). Reserved counts B2's own inventory_reservations rows,
   * not a denormalised column somebody forgot to decrement.
   */
  async loadStock(productIds: string[]): Promise<StockRow[]> {
    const rows = await this.prisma.inventory.findMany({
      where: { productId: { in: productIds } },
      include: { warehouse: true },
    });

    const held = await this.prisma.inventoryReservation.groupBy({
      by: ['warehouseId', 'productId'],
      where: { productId: { in: productIds }, status: { in: ['RESERVED', 'ALLOCATED'] } },
      _sum: { qty: true },
    });
    const heldBy = new Map(held.map((h) => [`${h.warehouseId}:${h.productId}`, h._sum.qty ?? 0]));

    return rows.map((r) => ({
      warehouseId: r.warehouseId,
      warehouseName: r.warehouse.name,
      productId: r.productId,
      availableQty: r.onHand - (heldBy.get(`${r.warehouseId}:${r.productId}`) ?? 0),
      shipmentCostMinor: r.warehouse.shipmentCostMinor,
    }));
  }

  async loadOrderDemand(orderId: string): Promise<{ currency: string; demand: Array<{ productId: string; qty: number }> }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { lines: true } });
    if (!order) throw new AppError(ErrorCode.NOT_FOUND, 'Order not found.', { orderId });

    // collapse duplicate products so one product is allocated once, not twice
    const merged = new Map<string, number>();
    for (const line of order.lines) {
      merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.qty);
    }

    // Only physical goods are allocated. Training days and annual
    // subscriptions have no depot to ship from, so demanding stock for them
    // put every service line on the backorder list and made an order that is
    // perfectly shippable read as short. A product is stock-tracked exactly
    // when inventory carries a row for it, which is also what loadStock reads.
    const stocked = await this.prisma.inventory.findMany({
      where: { productId: { in: [...merged.keys()] } },
      select: { productId: true },
      distinct: ['productId'],
    });
    const stockedIds = new Set(stocked.map((row) => row.productId));

    return {
      currency: order.currency,
      demand: [...merged.entries()]
        .filter(([productId]) => stockedIds.has(productId))
        .map(([productId, qty]) => ({ productId, qty })),
    };
  }

  /**
   * B3 supplies the pairs and the attach rate. B2 attaches the ceiling-safe
   * discount for the customer's tier, so every suggestion is one a rep can
   * actually give without sending their own quote back into approval.
   */
  async loadUpsellCandidates(
    productIdsOnQuote: string[],
    tierId: string,
  ): Promise<UpsellCandidate[]> {
    const relationships = await this.prisma.productRelationship.findMany({
      where: { sourceProductId: { in: productIdsOnQuote } },
    });
    if (relationships.length === 0) return [];

    const targetIds = [...new Set(relationships.map((r) => r.targetProductId))];
    const products = await this.prisma.product.findMany({ where: { id: { in: targetIds } } });
    const byId = new Map(products.map((p) => [p.id, p]));

    const policies = await this.prisma.discountPolicy.findMany({ where: { tierId, isActive: true } });
    const tierDefault = policies.find((p) => p.categoryId === null);
    const safeFor = (categoryId: string): number =>
      policies.find((p) => p.categoryId === categoryId)?.maxDiscountBps ?? tierDefault?.maxDiscountBps ?? 0;

    const onQuote = new Set(productIdsOnQuote);

    return relationships.flatMap((rel) => {
      const product = byId.get(rel.targetProductId);
      if (!product) return [];
      return [
        {
          productId: product.id,
          productName: product.name,
          kind: rel.kind === 'CROSS_SELL' ? ('CROSS_SELL' as const) : ('UPSELL' as const),
          suggestedQty: 1,
          unitPriceMinor: product.listPriceMinor,
          unitCostMinor: product.unitCostMinor,
          attachRateBps: rel.attachRateBps,
          alreadyOnQuote: onQuote.has(product.id),
          safeDiscountBps: safeFor(product.categoryId),
        },
      ];
    });
  }
}
