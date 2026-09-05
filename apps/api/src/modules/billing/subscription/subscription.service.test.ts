import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionSubscription, nextBillingDate } from './subscription.service.ts';
import { AppError } from '../../operations/types.ts';

test('active can pause or cancel; paused can resume or cancel', () => {
  assert.equal(transitionSubscription('ACTIVE', 'PAUSED'), 'PAUSED');
  assert.equal(transitionSubscription('PAUSED', 'ACTIVE'), 'ACTIVE');
  assert.equal(transitionSubscription('ACTIVE', 'CANCELLED'), 'CANCELLED');
});

test('cancelled is terminal', () => {
  assert.throws(() => transitionSubscription('CANCELLED', 'ACTIVE'), (e: unknown) => e instanceof AppError && e.code === 'SUBSCRIPTION_INVALID_STATE');
});

test('billing cadence advances by whole months, no proration', () => {
  const next = nextBillingDate(new Date('2026-01-15T00:00:00Z'), 1);
  assert.equal(next.toISOString().slice(0, 10), '2026-02-15');
});
