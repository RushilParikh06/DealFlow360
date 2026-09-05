import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionReservation, availableQty, reserveStock } from './inventory-state.service.ts';
import { AppError } from '../types.ts';

test('walks the happy path AVAILABLE -> RESERVED -> ALLOCATED -> SHIPPED', () => {
  assert.equal(transitionReservation('AVAILABLE', 'RESERVED'), 'RESERVED');
  assert.equal(transitionReservation('RESERVED', 'ALLOCATED'), 'ALLOCATED');
  assert.equal(transitionReservation('ALLOCATED', 'SHIPPED'), 'SHIPPED');
});

test('release puts stock back to available for re-reservation', () => {
  assert.equal(transitionReservation('RESERVED', 'RELEASED'), 'RELEASED');
  assert.equal(transitionReservation('RELEASED', 'RESERVED'), 'RESERVED');
});

test('a shipped reservation is terminal', () => {
  assert.throws(() => transitionReservation('SHIPPED', 'RELEASED'), (e: unknown) => e instanceof AppError && e.code === 'QUOTE_INVALID_STATE');
});

test('skipping a state is rejected', () => {
  assert.throws(() => transitionReservation('AVAILABLE', 'SHIPPED'));
});

test('available is onHand minus reserved, never stored directly', () => {
  assert.equal(availableQty(50, 12), 38);
});

test('reserving more than available raises INSUFFICIENT_STOCK', () => {
  assert.throws(() => reserveStock(10, 8, 5), (e: unknown) => e instanceof AppError && e.code === 'INSUFFICIENT_STOCK');
  assert.equal(reserveStock(10, 8, 2), 10);
});
