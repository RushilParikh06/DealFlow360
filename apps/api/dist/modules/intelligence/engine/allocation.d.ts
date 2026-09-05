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
export declare function chooseAllocation(orderId: string, demand: AllocationDemand[], stock: StockRow[], currency: string): AllocationResponse;
