import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLineTax } from './tax.service.ts';

test('applies the matching category rate', () => {
  const tax = calculateLineTax({ amountMinor: 10000, currency: 'INR' }, [{ categoryId: 'hardware', rateBps: 1800 }], 'hardware');
  assert.equal(tax.amountMinor, 1800);
  assert.equal(tax.currency, 'INR');
});

test('falls back to the default (null categoryId) rule', () => {
  const rules = [{ categoryId: null as unknown as string, rateBps: 500 }, { categoryId: 'hardware', rateBps: 1800 }];
  const tax = calculateLineTax({ amountMinor: 10000, currency: 'INR' }, rules, 'services');
  assert.equal(tax.amountMinor, 500);
});

test('no matching rule at all means zero tax, not a throw', () => {
  const tax = calculateLineTax({ amountMinor: 10000, currency: 'INR' }, [], 'services');
  assert.equal(tax.amountMinor, 0);
});

test('rounds half up to the nearest minor unit', () => {
  const tax = calculateLineTax({ amountMinor: 33, currency: 'INR' }, [{ categoryId: 'x', rateBps: 50 }], 'x'); // 33*0.005=0.165
  assert.equal(tax.amountMinor, 0);
});
