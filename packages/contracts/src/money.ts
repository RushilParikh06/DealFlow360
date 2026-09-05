// GROUP OWNED BY PROTOCOL. plan.md invariant 1.
// Money is an integer in minor units plus a currency code. No floats, anywhere.
// Percentages are basis points: 18 percent is 1800.

export interface Money {
  amountMinor: number;
  currency: string;
}

export const money = (amountMinor: number, currency: string): Money => ({
  amountMinor: Math.round(amountMinor),
  currency,
});

export const BPS_SCALE = 10_000;

/** Half-up rounding that behaves the same for negative values. Never Math.round on money. */
export const roundHalfUp = (value: number): number =>
  value >= 0 ? Math.floor(value + 0.5) : -Math.floor(-value + 0.5);

/** Apply a basis-point rate to a minor-unit amount and stay an integer. */
export const applyBps = (amountMinor: number, bps: number): number =>
  roundHalfUp((amountMinor * bps) / BPS_SCALE);

/** part / whole expressed in basis points. Returns 0 when whole is 0. */
export const asBps = (part: number, whole: number): number =>
  whole === 0 ? 0 : roundHalfUp((part * BPS_SCALE) / whole);

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);
