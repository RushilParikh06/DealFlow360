// B2 OWNED. Choosing the warehouse split. Recommends, commits nothing.
//
// B3 owns warehouses and inventory and exposes the stock. B2 chooses. Greedy,
// and the greed is deliberate: sort by available stock descending so the fewest
// warehouses are touched, tie-break on the cheaper shipment. Fewest shipments is
// the objective a warehouse manager actually optimises for, and a greedy pass is
// provably optimal for "cover demand from as few sources as possible" when the
// largest source is always taken first.
//
// Anything the warehouses cannot cover becomes a backorder line rather than a
// silent short ship. Stock is never decremented here - a reservation row is the
// only thing that moves inventory (plan.md section 7).

import { money, sum } from '@dealflow/contracts';
import type { AllocationResponse } from '@dealflow/contracts';

export interface StockRow {
  warehouseId: string;
  warehouseName: string;
  productId: string;
  /** onHand - reserved, computed by the caller. Never stored (invariant, section 6). */
  availableQty: number;
  shipmentCostMinor: number;
}

export interface AllocationDemand {
  productId: string;
  qty: number;
}

export function chooseAllocation(
  orderId: string,
  demand: AllocationDemand[],
  stock: StockRow[],
  currency: string,
): AllocationResponse {
  const allocations: AllocationResponse['allocations'] = [];
  const backorder: AllocationResponse['backorder'] = [];

  // local copy, so one product's allocation cannot double-spend another's stock
  const remainingStock = new Map<string, number>();
  for (const row of stock) {
    remainingStock.set(`${row.warehouseId}:${row.productId}`, Math.max(0, row.availableQty));
  }

  for (const line of demand) {
    let outstanding = line.qty;

    const candidates = stock
      .filter((s) => s.productId === line.productId)
      .sort(
        (a, b) =>
          (remainingStock.get(`${b.warehouseId}:${b.productId}`) ?? 0) -
            (remainingStock.get(`${a.warehouseId}:${a.productId}`) ?? 0) ||
          a.shipmentCostMinor - b.shipmentCostMinor ||
          (a.warehouseId < b.warehouseId ? -1 : 1),
      );

    for (const candidate of candidates) {
      if (outstanding <= 0) break;
      const key = `${candidate.warehouseId}:${candidate.productId}`;
      const available = remainingStock.get(key) ?? 0;
      if (available <= 0) continue;

      const take = Math.min(available, outstanding);
      remainingStock.set(key, available - take);
      outstanding -= take;

      allocations.push({
        warehouseId: candidate.warehouseId,
        warehouseName: candidate.warehouseName,
        productId: candidate.productId,
        qty: take,
        shipments: 1,
        shippingCost: money(candidate.shipmentCostMinor, currency),
      });
    }

    if (outstanding > 0) {
      backorder.push({
        productId: line.productId,
        qty: outstanding,
        reason:
          candidates.length === 0
            ? 'No warehouse stocks this product.'
            : 'Demand exceeds available stock across all warehouses.',
      });
    }
  }

  const distinctWarehouses = new Set(allocations.map((a) => a.warehouseId));

  return {
    orderId,
    allocations,
    backorder,
    totalShipments: distinctWarehouses.size,
    totalShippingCost: money(
      sum(
        [...distinctWarehouses].map(
          (id) => stock.find((s) => s.warehouseId === id)?.shipmentCostMinor ?? 0,
        ),
      ),
      currency,
    ),
  };
}
