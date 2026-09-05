export interface Money {
    amountMinor: number;
    currency: string;
}
export declare const money: (amountMinor: number, currency: string) => Money;
export declare const BPS_SCALE = 10000;
/** Half-up rounding that behaves the same for negative values. Never Math.round on money. */
export declare const roundHalfUp: (value: number) => number;
/** Apply a basis-point rate to a minor-unit amount and stay an integer. */
export declare const applyBps: (amountMinor: number, bps: number) => number;
/** part / whole expressed in basis points. Returns 0 when whole is 0. */
export declare const asBps: (part: number, whole: number) => number;
export declare const clamp: (value: number, min: number, max: number) => number;
export declare const sum: (values: number[]) => number;
