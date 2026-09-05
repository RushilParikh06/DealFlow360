import type { Money } from '../types';
export interface OrderLineRequest {
    productId: string;
    qty: number;
}
export interface WarehouseStock {
    warehouseId: string;
    warehouseName: string;
    productId: string;
    available: number;
    shippingCostMinor: number;
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
    backorder: {
        productId: string;
        qty: number;
    }[];
    totalShipments: number;
}
/**
 * Recommends a warehouse split for an order (plan.md section 8, POST
 * /orders/:id/allocation). Greedy: for each line, drain the cheapest-shipping
 * warehouse first, then the next, until the line is covered or stock runs
 * out. This favors the fewest shipments/lowest cost split, not evenness.
 * Recommends only - it reserves nothing.
 */
export declare function recommendAllocation(lines: OrderLineRequest[], stock: WarehouseStock[]): AllocationResult;
