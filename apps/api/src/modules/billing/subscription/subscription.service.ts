import { AppError } from '../../operations/types';

export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

const TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  ACTIVE: ['PAUSED', 'CANCELLED'],
  PAUSED: ['ACTIVE', 'CANCELLED'],
  CANCELLED: [],
};

/** The only function allowed to move a subscription between states. */
export function transitionSubscription(from: SubscriptionStatus, to: SubscriptionStatus): SubscriptionStatus {
  if (!TRANSITIONS[from].includes(to)) {
    throw new AppError('SUBSCRIPTION_INVALID_STATE', `cannot move subscription from ${from} to ${to}`, { from, to });
  }
  return to;
}

/**
 * Next billing date, cadence in whole months. No proration on plan changes
 * (README limitations) - a change takes effect on the next cycle, not mid-cycle.
 */
export function nextBillingDate(from: Date, cadenceMonths: number): Date {
  const next = new Date(from);
  next.setMonth(next.getMonth() + cadenceMonths);
  return next;
}
