import type { Money } from '../types.ts';

export interface OrderLineRequest {
  productId: string;
  qty: number;
}

export interface WarehouseStock {
  warehouseId: string;
  warehouseName: string;
  productId: string;
  available: number; // onHand - reserved, computed by inventory-state.service
  shippingCostMinor: number; // flat cost per shipment from this warehouse
  currency: string;
}

export interface Allocation {
  warehouseId: string;
  warehouseName: string;
  productId: string;
  qty: number;
  shipments: number;
  shippingCost: Money;
}

export interface AllocationResult {
  allocations: Allocation[];
  backorder: { productId: string; qty: number }[];
  totalShipments: number;
}

/**
 * Recommends a warehouse split for an order (plan.md section 8, POST
 * /orders/:id/allocation). Greedy: for each line, drain the cheapest-shipping
 * warehouse first, then the next, until the line is covered or stock runs
 * out. This favors the fewest shipments/lowest cost split, not evenness.
 * Recommends only - it reserves nothing.
 */
export function recommendAllocation(lines: OrderLineRequest[], stock: WarehouseStock[]): AllocationResult {
  const allocations: Allocation[] = [];
  const backorder: { productId: string; qty: number }[] = [];
  // Track consumption locally so the same warehouse row isn't double-spent
  // across lines when two lines request the same product.
  const remaining = new Map(stock.map((s) => [`${s.warehouseId}:${s.productId}`, s.available]));

  for (const line of lines) {
    const candidates = stock
      .filter((s) => s.productId === line.productId)
      .sort((a, b) => a.shippingCostMinor - b.shippingCostMinor);

    let toFill = line.qty;
    for (const wh of candidates) {
      if (toFill <= 0) break;
      const key = `${wh.warehouseId}:${wh.productId}`;
      const available = remaining.get(key) ?? 0;
      if (available <= 0) continue;

      const qty = Math.min(available, toFill);
      remaining.set(key, available - qty);
      toFill -= qty;
      allocations.push({
        warehouseId: wh.warehouseId,
        warehouseName: wh.warehouseName,
        productId: wh.productId,
        qty,
        shipments: 1,
        shippingCost: { amountMinor: wh.shippingCostMinor, currency: wh.currency },
      });
    }

    if (toFill > 0) {
      backorder.push({ productId: line.productId, qty: toFill });
    }
  }

  return { allocations, backorder, totalShipments: allocations.length };
}
