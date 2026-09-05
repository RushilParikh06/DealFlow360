"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ceilings_1 = require("../ceilings");
const app_error_1 = require("../../../shared/app-error");
const fixtures_1 = require("./fixtures");
describe('per-line ceiling resolution', () => {
    it('prefers the category row over the tier default', () => {
        expect((0, ceilings_1.resolvePolicyForLine)(fixtures_1.goldPolicies, fixtures_1.CAT_SERVICES).maxDiscountBps).toBe(1000);
        expect((0, ceilings_1.resolvePolicyForLine)(fixtures_1.goldPolicies, fixtures_1.CAT_HARDWARE).maxDiscountBps).toBe(1500);
    });
    it('falls back to the tier default when the category has no row of its own', () => {
        expect((0, ceilings_1.resolvePolicyForLine)(fixtures_1.goldPolicies, 'cat_unseeded').maxDiscountBps).toBe(1500);
        expect((0, ceilings_1.resolvePolicyForLine)(fixtures_1.goldPolicies, null).maxDiscountBps).toBe(1500);
    });
    it('refuses to guess when the tier has no policy at all', () => {
        expect(() => (0, ceilings_1.resolvePolicyForLine)([], fixtures_1.CAT_SERVICES)).toThrow(app_error_1.AppError);
        expect(() => (0, ceilings_1.resolvePolicyForLine)([], fixtures_1.CAT_SERVICES)).toThrow(/No discount policy/);
    });
    it('reports overBps per line and zero for a compliant line', () => {
        const ceilings = (0, ceilings_1.resolveLineCeilings)([
            (0, fixtures_1.line)({ quoteLineId: 'l1', categoryId: fixtures_1.CAT_SERVICES, categoryName: 'Services', discountBps: 1800 }),
            (0, fixtures_1.line)({ quoteLineId: 'l2', discountBps: 900 }),
        ], fixtures_1.goldPolicies);
        expect(ceilings[0]).toMatchObject({ allowedDiscountBps: 1000, actualDiscountBps: 1800, overBps: 800 });
        expect(ceilings[1]).toMatchObject({ allowedDiscountBps: 1500, overBps: 0 });
    });
    it('takes the strictest thresholds among the policies the lines actually touched', () => {
        const mixed = [
            { id: 'a', tierId: fixtures_1.GOLD, categoryId: fixtures_1.CAT_HARDWARE, maxDiscountBps: 1500, requiresManagerAboveBps: 200, requiresFinanceAboveBps: 900 },
            { id: 'b', tierId: fixtures_1.GOLD, categoryId: fixtures_1.CAT_SERVICES, maxDiscountBps: 1000, requiresManagerAboveBps: 0, requiresFinanceAboveBps: 500 },
            { id: 'c', tierId: fixtures_1.GOLD, categoryId: 'cat_unused', maxDiscountBps: 100, requiresManagerAboveBps: 0, requiresFinanceAboveBps: 10 },
        ];
        const ceilings = (0, ceilings_1.resolveLineCeilings)([(0, fixtures_1.line)({ quoteLineId: 'l1' }), (0, fixtures_1.line)({ quoteLineId: 'l2', categoryId: fixtures_1.CAT_SERVICES, categoryName: 'Services' })], mixed);
        // the tight Services policy wins over the loose Hardware one, and the
        // untouched policy does not drag the thresholds down with it
        expect((0, ceilings_1.governingThresholds)(ceilings, mixed)).toEqual({
            requiresManagerAboveBps: 0,
            requiresFinanceAboveBps: 500,
        });
    });
});
//# sourceMappingURL=ceilings.spec.js.map