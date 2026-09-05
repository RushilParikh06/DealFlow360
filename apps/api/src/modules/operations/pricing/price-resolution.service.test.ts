import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePrice } from './price-resolution.service.ts';
import { AppError } from '../types.ts';

const priceLists = [
  { id: 'pl_default', customerTierId: null },
  { id: 'pl_gold', customerTierId: 'GOLD' },
];
const items = [
  { priceListId: 'pl_default', productId: 'prd_1', unitPriceMinor: 10000, currency: 'INR' },
  { priceListId: 'pl_gold', productId: 'prd_1', unitPriceMinor: 9000, currency: 'INR' },
];

test('a tier-specific price wins over the default', () => {
  assert.equal(resolvePrice(priceLists, items, 'prd_1', 'GOLD').amountMinor, 9000);
});

test('falls back to the default list when the customer has no tier match', () => {
  assert.equal(resolvePrice(priceLists, items, 'prd_1', 'SILVER').amountMinor, 10000);
});

test('missing from every list is NOT_FOUND, not a zero price', () => {
  assert.throws(() => resolvePrice(priceLists, items, 'prd_missing', null), (e: unknown) => e instanceof AppError && e.code === 'NOT_FOUND');
});
