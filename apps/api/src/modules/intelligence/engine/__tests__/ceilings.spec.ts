import { governingThresholds, resolveLineCeilings, resolvePolicyForLine } from '../ceilings';
import { AppError } from '../../../shared/app-error';
import { CAT_HARDWARE, CAT_SERVICES, GOLD, goldPolicies, line } from './fixtures';

describe('per-line ceiling resolution', () => {
  it('prefers the category row over the tier default', () => {
    expect(resolvePolicyForLine(goldPolicies, CAT_SERVICES).maxDiscountBps).toBe(1000);
    expect(resolvePolicyForLine(goldPolicies, CAT_HARDWARE).maxDiscountBps).toBe(1500);
  });

  it('falls back to the tier default when the category has no row of its own', () => {
    expect(resolvePolicyForLine(goldPolicies, 'cat_unseeded').maxDiscountBps).toBe(1500);
    expect(resolvePolicyForLine(goldPolicies, null).maxDiscountBps).toBe(1500);
  });

  it('refuses to guess when the tier has no policy at all', () => {
    expect(() => resolvePolicyForLine([], CAT_SERVICES)).toThrow(AppError);
    expect(() => resolvePolicyForLine([], CAT_SERVICES)).toThrow(/No discount policy/);
  });

  it('reports overBps per line and zero for a compliant line', () => {
    const ceilings = resolveLineCeilings(
      [
        line({ quoteLineId: 'l1', categoryId: CAT_SERVICES, categoryName: 'Services', discountBps: 1800 }),
        line({ quoteLineId: 'l2', discountBps: 900 }),
      ],
      goldPolicies,
    );

    expect(ceilings[0]).toMatchObject({ allowedDiscountBps: 1000, actualDiscountBps: 1800, overBps: 800 });
    expect(ceilings[1]).toMatchObject({ allowedDiscountBps: 1500, overBps: 0 });
  });

  it('takes the strictest thresholds among the policies the lines actually touched', () => {
    const mixed = [
      { id: 'a', tierId: GOLD, categoryId: CAT_HARDWARE, maxDiscountBps: 1500, requiresManagerAboveBps: 200, requiresFinanceAboveBps: 900 },
      { id: 'b', tierId: GOLD, categoryId: CAT_SERVICES, maxDiscountBps: 1000, requiresManagerAboveBps: 0, requiresFinanceAboveBps: 500 },
      { id: 'c', tierId: GOLD, categoryId: 'cat_unused', maxDiscountBps: 100, requiresManagerAboveBps: 0, requiresFinanceAboveBps: 10 },
    ];
    const ceilings = resolveLineCeilings([line({ quoteLineId: 'l1' }), line({ quoteLineId: 'l2', categoryId: CAT_SERVICES, categoryName: 'Services' })], mixed);

    // the tight Services policy wins over the loose Hardware one, and the
    // untouched policy does not drag the thresholds down with it
    expect(governingThresholds(ceilings, mixed)).toEqual({
      requiresManagerAboveBps: 0,
      requiresFinanceAboveBps: 500,
    });
  });
});
