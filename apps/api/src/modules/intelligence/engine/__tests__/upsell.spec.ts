import { rankUpsell, type UpsellCandidate } from '../upsell';

const candidate = (over: Partial<UpsellCandidate> & { productId: string }): UpsellCandidate => ({
  productName: 'Thing',
  kind: 'UPSELL',
  suggestedQty: 1,
  unitPriceMinor: 100_000,
  unitCostMinor: 60_000,
  attachRateBps: 1000,
  alreadyOnQuote: false,
  safeDiscountBps: 0,
  ...over,
});

describe('upsell ranking', () => {
  it('ranks on margin weighted by attach rate, not raw margin', () => {
    const bigButRare = candidate({ productId: 'prd_rare', productName: 'Rare', unitPriceMinor: 100_000, unitCostMinor: 60_000, attachRateBps: 2000, safeDiscountBps: 1000 });
    const smallButCommon = candidate({ productId: 'prd_common', productName: 'Common', suggestedQty: 2, unitPriceMinor: 20_000, unitCostMinor: 8_000, attachRateBps: 7000, safeDiscountBps: 500 });

    const ranked = rankUpsell([bigButRare, smallButCommon], 'INR');

    expect(ranked[0]!.productId).toBe('prd_common');
    expect(ranked[0]!.marginDelta.amountMinor).toBe(22_000);
    expect(ranked[0]!.expectedMargin.amountMinor).toBe(15_400);
    // the bigger raw margin loses because it almost never attaches
    expect(ranked[1]!.marginDelta.amountMinor).toBe(30_000);
    expect(ranked[1]!.expectedMargin.amountMinor).toBe(6_000);
  });

  it('prices the suggestion at a ceiling-safe discount', () => {
    const ranked = rankUpsell([candidate({ productId: 'p', unitPriceMinor: 100_000, unitCostMinor: 50_000, safeDiscountBps: 1000, attachRateBps: 10_000 })], 'INR');
    // 100000 gross, 10 percent safe discount, 90000 net, 50000 cost
    expect(ranked[0]!.marginDelta.amountMinor).toBe(40_000);
    expect(ranked[0]!.marginBps).toBe(4444);
  });

  it('drops anything already on the quote', () => {
    const ranked = rankUpsell([candidate({ productId: 'p1', alreadyOnQuote: true }), candidate({ productId: 'p2' })], 'INR');
    expect(ranked.map((r) => r.productId)).toEqual(['p2']);
  });

  it('numbers the ranks and respects the limit', () => {
    const many = [1, 2, 3, 4, 5, 6, 7].map((n) => candidate({ productId: `p${n}`, attachRateBps: n * 1000 }));
    const ranked = rankUpsell(many, 'INR', 3);
    expect(ranked).toHaveLength(3);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(ranked[0]!.productId).toBe('p7');
  });

  it('is deterministic when two candidates tie completely', () => {
    const a = candidate({ productId: 'prd_b' });
    const b = candidate({ productId: 'prd_a' });
    expect(rankUpsell([a, b], 'INR').map((r) => r.productId)).toEqual(['prd_a', 'prd_b']);
    expect(rankUpsell([b, a], 'INR').map((r) => r.productId)).toEqual(['prd_a', 'prd_b']);
  });

  it('returns an empty list rather than throwing on no candidates', () => {
    expect(rankUpsell([], 'INR')).toEqual([]);
  });
});
