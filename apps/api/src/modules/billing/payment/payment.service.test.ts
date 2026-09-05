import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPayment } from './payment.service.ts';
import { AppError } from '../../operations/types.ts';

test('a partial payment leaves the invoice partially paid', () => {
  const result = applyPayment(10000, 0, 4000);
  assert.equal(result.newPaidMinor, 4000);
  assert.equal(result.status, 'PARTIALLY_PAID');
});

test('paying the remaining balance marks it paid', () => {
  const result = applyPayment(10000, 4000, 6000);
  assert.equal(result.status, 'PAID');
});

test('overpayment is rejected rather than silently accepted', () => {
  assert.throws(() => applyPayment(10000, 4000, 7000), (e: unknown) => e instanceof AppError && e.code === 'VALIDATION_FAILED');
});

test('a zero or negative payment is rejected', () => {
  assert.throws(() => applyPayment(10000, 0, 0));
  assert.throws(() => applyPayment(10000, 0, -100));
});
