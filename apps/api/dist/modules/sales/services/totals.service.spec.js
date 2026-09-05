"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const totals_service_1 = require("./totals.service");
describe('computeLineTotals', () => {
    it('applies the discount to unit price times qty', () => {
        // matches the plan.md worked example: 2 x 45000, 18% discount
        const result = (0, totals_service_1.computeLineTotals)({ unitPriceMinor: 45_000, qty: 2, discountBps: 1800 });
        expect(result.subtotalMinor).toBe(90_000);
        expect(result.discountMinor).toBe(16_200);
        expect(result.lineTotalMinor).toBe(73_800);
    });
    it('zero discount leaves the line total equal to the subtotal', () => {
        const result = (0, totals_service_1.computeLineTotals)({ unitPriceMinor: 1_000, qty: 3, discountBps: 0 });
        expect(result.lineTotalMinor).toBe(3_000);
    });
});
describe('computeQuotationTotals', () => {
    it('sums per-line totals across the quote', () => {
        const totals = (0, totals_service_1.computeQuotationTotals)([
            { unitPriceMinor: 45_000, qty: 2, discountBps: 1800 },
            { unitPriceMinor: 1_000, qty: 3, discountBps: 0 },
        ]);
        expect(totals.subtotalMinor).toBe(93_000);
        expect(totals.discountMinor).toBe(16_200);
        expect(totals.totalMinor).toBe(93_000 - 16_200);
    });
    it('an empty quote totals to zero', () => {
        expect((0, totals_service_1.computeQuotationTotals)([])).toEqual({ subtotalMinor: 0, discountMinor: 0, taxMinor: 0, totalMinor: 0 });
    });
});
//# sourceMappingURL=totals.service.spec.js.map