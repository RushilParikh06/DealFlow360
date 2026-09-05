// B2 OWNED. The allocation CHOICE. It recommends and commits nothing
// (plan.md section 8: "recommend a split, commit nothing").
//
// B3 owns the endpoint that acts on the recommendation. B2 owns the reservation
// rows, which are the only mechanism by which stock leaves the available pool.

import { Injectable } from '@nestjs/common';
import { ErrorCode, type AllocationResponse } from '@dealflow/contracts';
import { AppError } from '../../shared/app-error';
import { PrismaService } from '../../shared/prisma.service';
import type { AuthUser } from '../../shared/current-user';
import { chooseAllocation } from '../engine/allocation';
import { AuditService } from './audit.service';
import { OpsReaderService } from './ops-reader.service';

@Injectable()
export class AllocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ops: OpsReaderService,
    private readonly audit: AuditService,
  ) {}

  async recommend(orderId: string): Promise<AllocationResponse> {
    const { currency, demand } = await this.ops.loadOrderDemand(orderId);
    const stock = await this.ops.loadStock(demand.map((d) => d.productId));
    return chooseAllocation(orderId, demand, stock, currency);
  }

  /**
   * Turn a recommendation into reservation rows. Re-reads stock INSIDE the
   * transaction and re-runs the same pure function, because the recommendation
   * the user is looking at may be seconds stale and two reps confirming the last
   * unit at once is the one race that matters here.
   */
  async reserve(orderId: string, actor: AuthUser): Promise<AllocationResponse> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryReservation.count({
        where: { orderId, status: { in: ['RESERVED', 'ALLOCATED', 'SHIPPED'] } },
      });
      if (existing > 0) {
        throw new AppError(
          ErrorCode.INSUFFICIENT_STOCK,
          'This order already holds reservations. Release them before reserving again.',
          { orderId, existing },
        );
      }

      const { currency, demand } = await this.ops.loadOrderDemand(orderId);
      const stock = await this.ops.loadStock(demand.map((d) => d.productId));
      const plan = chooseAllocation(orderId, demand, stock, currency);

      if (plan.allocations.length === 0) {
        throw new AppError(ErrorCode.INSUFFICIENT_STOCK, 'No stock is available for this order.', {
          orderId,
          backorder: plan.backorder,
        });
      }

      await tx.inventoryReservation.createMany({
        data: plan.allocations.map((a) => ({
          orderId,
          productId: a.productId,
          warehouseId: a.warehouseId,
          qty: a.qty,
          status: 'RESERVED' as const,
        })),
      });

      await this.audit.record(tx, {
        entityType: 'INVENTORY_RESERVATION',
        entityId: orderId,
        action: 'STOCK_RESERVED',
        actorUserId: actor.id,
        actorRole: actor.role,
        toValue: `${plan.allocations.length} reservation(s) across ${plan.totalShipments} shipment(s)`,
        metadata: { allocations: plan.allocations, backorder: plan.backorder },
      });

      return plan;
    });
  }

  async release(orderId: string, actor: AuthUser): Promise<{ released: number }> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.inventoryReservation.updateMany({
        where: { orderId, status: { in: ['RESERVED', 'ALLOCATED'] } },
        data: { status: 'RELEASED', releasedAt: new Date() },
      });

      await this.audit.record(tx, {
        entityType: 'INVENTORY_RESERVATION',
        entityId: orderId,
        action: 'STOCK_RELEASED',
        actorUserId: actor.id,
        actorRole: actor.role,
        toValue: String(result.count),
      });

      return { released: result.count };
    });
  }
}
