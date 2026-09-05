"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hash_1 = require("../hash");
const fixtures_1 = require("./fixtures");
describe('evaluation input hash', () => {
    const base = (0, fixtures_1.input)([(0, fixtures_1.line)({ quoteLineId: 'l1', discountBps: 1000 }), (0, fixtures_1.line)({ quoteLineId: 'l2', discountBps: 500 })]);
    it('is stable across repeated calls', () => {
        expect((0, hash_1.hashEvaluationInput)(base)).toBe((0, hash_1.hashEvaluationInput)(base));
    });
    it('ignores the order lines arrive in', () => {
        const reordered = (0, fixtures_1.input)([...base.lines].reverse());
        expect((0, hash_1.hashEvaluationInput)(reordered)).toBe((0, hash_1.hashEvaluationInput)(base));
    });
    it('changes when a discount changes', () => {
        const edited = (0, fixtures_1.input)([(0, fixtures_1.line)({ quoteLineId: 'l1', discountBps: 1400 }), base.lines[1]]);
        expect((0, hash_1.hashEvaluationInput)(edited)).not.toBe((0, hash_1.hashEvaluationInput)(base));
    });
    it('changes when a ceiling is edited in the policy screen', () => {
        const tightened = (0, fixtures_1.input)(base.lines, [
            { ...fixtures_1.goldPolicies[0], maxDiscountBps: 700 },
            ...fixtures_1.goldPolicies.slice(1),
        ]);
        // otherwise the admin screen would edit a policy and the cached evaluation
        // would keep showing the old score, which is exactly the demo that dies
        expect((0, hash_1.hashEvaluationInput)(tightened)).not.toBe((0, hash_1.hashEvaluationInput)(base));
    });
    it('changes when a line moves to a different category', () => {
        const moved = (0, fixtures_1.input)([(0, fixtures_1.line)({ quoteLineId: 'l1', discountBps: 1000, categoryId: fixtures_1.CAT_SERVICES }), base.lines[1]]);
        expect((0, hash_1.hashEvaluationInput)(moved)).not.toBe((0, hash_1.hashEvaluationInput)(base));
    });
});
//# sourceMappingURL=hash.spec.js.map