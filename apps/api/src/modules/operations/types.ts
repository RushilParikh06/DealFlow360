// B3 shared helpers. This file used to carry its own Money/AppError because
// packages/contracts did not exist yet; it does now, so these are re-exports and
// there is exactly one of each in the process.
//
// That matters beyond tidiness: AllExceptionsFilter matches on
// `instanceof AppError`. A second class with the same shape is not the same
// class, so every B3 error would have left as a 500 instead of its own code.

export { applyBps, type Money } from '@dealflow/contracts';
export { AppError } from '../shared/app-error';

import type { Money } from '@dealflow/contracts';
import { ErrorCode } from '@dealflow/contracts';
import { AppError } from '../shared/app-error';

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new AppError(ErrorCode.VALIDATION_FAILED, `currency mismatch: ${a.currency} vs ${b.currency}`, {
      left: a.currency,
      right: b.currency,
    });
  }
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}
