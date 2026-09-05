import { resolvePrice } from './price-resolution.service';
import { AppError } from '../types';

const priceLists = [
  { id: 'pl_default', customerTierId: null },
  { id: 'pl_gold', customerTierId: 'GOLD' },
];
const items = [
  { priceListId: 'pl_default', productId: 'prd_1', unitPriceMinor: 10000, currency: 'INR' },
  { priceListId: 'pl_gold', productId: 'prd_1', unitPriceMinor: 9000, currency: 'INR' },
];

describe('resolvePrice', () => {
  it('a tier-specific price wins over the default', () => {
    expect(resolvePrice(priceLists, items, 'prd_1', 'GOLD').amountMinor).toBe(9000);
  });

  it('falls back to the default list when the customer has no tier match', () => {
    expect(resolvePrice(priceLists, items, 'prd_1', 'SILVER').amountMinor).toBe(10000);
  });

  it('missing from every list is NOT_FOUND, not a zero price', () => {
    expect(() => resolvePrice(priceLists, items, 'prd_missing', null)).toThrow(AppError);
    try {
      resolvePrice(priceLists, items, 'prd_missing', null);
    } catch (e) {
      expect((e as AppError).code).toBe('NOT_FOUND');
    }
  });
});
