/**
 * All three numbers are basis points. 10000 bps = 100%.
 * Nothing here is a float, ever (plan.md invariant 1).
 */
export declare class UpdatePolicyDto {
    maxDiscountBps?: number;
    requiresManagerAboveBps?: number;
    requiresFinanceAboveBps?: number;
    isActive?: boolean;
}
