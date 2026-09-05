export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';
/** The only function allowed to move a subscription between states. */
export declare function transitionSubscription(from: SubscriptionStatus, to: SubscriptionStatus): SubscriptionStatus;
/**
 * Next billing date, cadence in whole months. No proration on plan changes
 * (README limitations) - a change takes effect on the next cycle, not mid-cycle.
 */
export declare function nextBillingDate(from: Date, cadenceMonths: number): Date;
