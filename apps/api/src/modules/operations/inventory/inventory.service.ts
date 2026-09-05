// B3 owned. Persistence around inventory-state.service.ts, which stays a pure
// function file so its tests need no database.
//
// available is derived on read and never stored (plan.md section 6), and every
// change to onHand/reserved writes an inventory_movements row in the same
// transaction, so stock is never silently decremented (README).
import { Injectable } from '@nestjs/common';
import { ErrorCode, type Paginated } from '@dealflow/contracts';
import { AppError } from '../../shared/app-error';
import { PrismaService } from '../../shared/prisma.service';
import { availableQty, reserveStock } from './inventory-state.service';

export interface InventoryRow {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  onHand: number;
  reserved: number;
  available: number;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: { warehouseId?: string; productId?: string; page?: number; pageSize?: number }): Promise<
    Paginated<InventoryRow>
  > {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where = {
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        include: { product: { select: { sku: true, name: true } }, warehouse: { select: { code: true, name: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ warehouseId: 'asc' }, { productId: 'asc' }],
      }),
      this.prisma.inventory.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        productId: row.productId,
        sku: row.product.sku,
        productName: row.product.name,
        warehouseId: row.warehouseId,
        warehouseCode: row.warehouse.code,
        warehouseName: row.warehouse.name,
        onHand: row.onHand,
        reserved: row.reserved,
        available: availableQty(row.onHand, row.reserved),
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Moves stock into `reserved` for one warehouse/product pair. Throws
   * INSUFFICIENT_STOCK rather than reserving what is not there - the guard lives
   * in reserveStock() so the rule is unit-tested without a database.
   */
  async reserve(inventoryId: string, qty: number, reason: string): Promise<InventoryRow> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.inventory.findUnique({
        where: { id: inventoryId },
        include: { product: { select: { sku: true, name: true } }, warehouse: { select: { code: true, name: true } } },
      });
      if (!row) throw new AppError(ErrorCode.NOT_FOUND, 'Inventory record not found.', { inventoryId });

      const reserved = reserveStock(row.onHand, row.reserved, qty);
      await tx.inventory.update({ where: { id: inventoryId }, data: { reserved } });
      await tx.inventoryMovement.create({ data: { inventoryId, delta: qty, reason } });

      return {
        id: row.id,
        productId: row.productId,
        sku: row.product.sku,
        productName: row.product.name,
        warehouseId: row.warehouseId,
        warehouseCode: row.warehouse.code,
        warehouseName: row.warehouse.name,
        onHand: row.onHand,
        reserved,
        available: availableQty(row.onHand, reserved),
      };
    });
  }
}
