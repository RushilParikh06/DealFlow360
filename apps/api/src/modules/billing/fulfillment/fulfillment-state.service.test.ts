import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionFulfillment } from './fulfillment-state.service.ts';
import { AppError } from '../../operations/types.ts';

test('walks the happy path to delivered', () => {
  const path: Parameters<typeof transitionFulfillment>[] = [
    ['ORDER_CONFIRMED', 'INVENTORY_RESERVED'],
    ['INVENTORY_RESERVED', 'PICKING'],
    ['PICKING', 'PACKED'],
    ['PACKED', 'SHIPPED'],
    ['SHIPPED', 'DELIVERED'],
  ];
  for (const [from, to] of path) assert.equal(transitionFulfillment(from, to), to);
});

test('a short reservation can fall into backordered and recover', () => {
  assert.equal(transitionFulfillment('ORDER_CONFIRMED', 'BACKORDERED'), 'BACKORDERED');
  assert.equal(transitionFulfillment('BACKORDERED', 'INVENTORY_RESERVED'), 'INVENTORY_RESERVED');
});

test('delivered is terminal and skipping steps is rejected', () => {
  assert.throws(() => transitionFulfillment('DELIVERED', 'SHIPPED'), (e: unknown) => e instanceof AppError && e.code === 'QUOTE_INVALID_STATE');
  assert.throws(() => transitionFulfillment('PICKING', 'SHIPPED'));
});
