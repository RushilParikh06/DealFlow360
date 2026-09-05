export interface Money {
    amountMinor: number;
    currency: string;
}
/** Round-half-up integer bps math. Money is never a float (plan.md #5.1). */
export declare function applyBps(amountMinor: number, bps: number): number;
export declare function addMoney(a: Money, b: Money): Money;
/** One error shape for the whole B3 surface, matching plan.md section 8's envelope. */
export declare class AppError extends Error {
    code: string;
    details?: unknown;
    constructor(code: string, message: string, details?: unknown);
}
