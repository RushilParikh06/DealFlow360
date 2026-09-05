import { calculateLineTax } from './tax.service';

describe('calculateLineTax', () => {
  it('applies the matching category rate', () => {
    const tax = calculateLineTax({ amountMinor: 10000, currency: 'INR' }, [{ categoryId: 'hardware', rateBps: 1800 }], 'hardware');
    expect(tax.amountMinor).toBe(1800);
    expect(tax.currency).toBe('INR');
  });

  it('falls back to the default (null categoryId) rule', () => {
    const rules = [{ categoryId: null as unknown as string, rateBps: 500 }, { categoryId: 'hardware', rateBps: 1800 }];
    const tax = calculateLineTax({ amountMinor: 10000, currency: 'INR' }, rules, 'services');
    expect(tax.amountMinor).toBe(500);
  });

  it('no matching rule at all means zero tax, not a throw', () => {
    const tax = calculateLineTax({ amountMinor: 10000, currency: 'INR' }, [], 'services');
    expect(tax.amountMinor).toBe(0);
  });

  it('rounds half up to the nearest minor unit', () => {
    const tax = calculateLineTax({ amountMinor: 33, currency: 'INR' }, [{ categoryId: 'x', rateBps: 50 }], 'x'); // 33*0.005=0.165
    expect(tax.amountMinor).toBe(0);
  });
});
