import { transitionSubscription, nextBillingDate } from './subscription.service';
import { AppError } from '../../operations/types';

describe('transitionSubscription', () => {
  it('active can pause or cancel; paused can resume or cancel', () => {
    expect(transitionSubscription('ACTIVE', 'PAUSED')).toBe('PAUSED');
    expect(transitionSubscription('PAUSED', 'ACTIVE')).toBe('ACTIVE');
    expect(transitionSubscription('ACTIVE', 'CANCELLED')).toBe('CANCELLED');
  });

  it('cancelled is terminal', () => {
    expect(() => transitionSubscription('CANCELLED', 'ACTIVE')).toThrow(AppError);
    try {
      transitionSubscription('CANCELLED', 'ACTIVE');
    } catch (e) {
      expect((e as AppError).code).toBe('SUBSCRIPTION_INVALID_STATE');
    }
  });
});

describe('nextBillingDate', () => {
  it('advances by whole months, no proration', () => {
    const next = nextBillingDate(new Date('2026-01-15T00:00:00Z'), 1);
    expect(next.toISOString().slice(0, 10)).toBe('2026-02-15');
  });
});
