// Local to B3 until packages/contracts exists (group-owned, per plan.md section 3).
// Move this file there verbatim once F/B1/B2 scaffold the workspace - do not
// duplicate the definition in billing/, import it from here instead.

export interface Money {
  amountMinor: number;
  currency: string; // ISO 4217, e.g. "INR"
}

/** Round-half-up integer bps math. Money is never a float (plan.md #5.1). */
export function applyBps(amountMinor: number, bps: number): number {
  return Math.round((amountMinor * bps) / 10000);
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new AppError('VALIDATION_FAILED', `currency mismatch: ${a.currency} vs ${b.currency}`);
  }
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}

/** One error shape for the whole B3 surface, matching plan.md section 8's envelope. */
export class AppError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
