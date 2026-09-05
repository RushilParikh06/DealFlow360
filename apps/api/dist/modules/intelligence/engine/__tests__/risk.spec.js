"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const evaluate_1 = require("../evaluate");
const risk_1 = require("../risk");
const ceilings_1 = require("../ceilings");
const fixtures_1 = require("./fixtures");
describe('blended discount risk score', () => {
    it('auto approves a quote where every line is inside its own ceiling', () => {
        const result = (0, evaluate_1.evaluateQuotation)((0, fixtures_1.input)([
            (0, fixtures_1.line)({ quoteLineId: 'l1', discountBps: 1200 }),
            (0, fixtures_1.line)({ quoteLineId: 'l2', categoryId: fixtures_1.CAT_SERVICES, categoryName: 'Services', discountBps: 1000 }),
        ]));
        expect(result.violations).toHaveLength(0);
        expect(result.approvalRequired).toBe(false);
        expect(result.requiredApprovals).toEqual([]);
        expect(result.blend.weightedExcessBps).toBe(0);
        expect(result.blend.worstLineExcessBps).toBe(0);
    });
    it('THE INVARIANT 3 CASE: several lines each slightly over must still be flagged', () => {
        // no single line is dramatic, and an order-level cap would wave this through
        const lines = [1, 2, 3, 4, 5].map((n) => (0, fixtures_1.line)({ quoteLineId: `l${n}`, discountBps: 1700, lineTotalMinor: 83_000 }));
        const result = (0, evaluate_1.evaluateQuotation)((0, fixtures_1.input)(lines));
        expect(result.violations).toHaveLength(5);
        expect(result.blend.worstLineExcessBps).toBe(200);
        expect(result.blend.weightedExcessBps).toBe(200);
        expect(result.approvalRequired).toBe(true);
        expect(result.requiredApprovals).toEqual(['SALES_MANAGER']);
        // every line is over, so the spread factor is fully loaded
        expect(result.factors.find((f) => f.key === 'VIOLATION_SPREAD')?.points).toBe(10);
    });
    it('weights each excess by that line s share of order value', () => {
        // a big clean line must dilute a small line s overage, not ignore it
        const lines = [
            (0, fixtures_1.line)({ quoteLineId: 'small', categoryId: fixtures_1.CAT_SUBSCRIPTIONS, categoryName: 'Subscriptions', discountBps: 1800, lineTotalMinor: 10_000 }),
            (0, fixtures_1.line)({ quoteLineId: 'big', discountBps: 0, lineTotalMinor: 990_000 }),
        ];
        const ceilings = (0, ceilings_1.resolveLineCeilings)(lines, fixtures_1.goldPolicies);
        const blend = (0, risk_1.computeBlend)(lines, ceilings);
        expect(blend.worstLineExcessBps).toBe(1000); // 1800 against a 800 subscriptions ceiling
        expect(blend.weightedExcessBps).toBe(10); // 1000 * 10000 / 1000000
    });
    it('escalates to finance on the worst line even when the blend is mild', () => {
        const result = (0, evaluate_1.evaluateQuotation)((0, fixtures_1.input)([
            (0, fixtures_1.line)({ quoteLineId: 'l1', categoryId: fixtures_1.CAT_SERVICES, categoryName: 'Services', discountBps: 2500, lineTotalMinor: 20_000 }),
            (0, fixtures_1.line)({ quoteLineId: 'l2', discountBps: 0, lineTotalMinor: 980_000 }),
        ]));
        expect(result.blend.worstLineExcessBps).toBe(1500);
        expect(result.blend.weightedExcessBps).toBe(30); // mild on its own
        // max(blend, worst line) is what routes, so this cannot hide inside a big order
        expect(result.requiredApprovals).toEqual(['SALES_MANAGER', 'FINANCE']);
    });
    it('reproduces the worked example from plan.md section 8', () => {
        const result = (0, evaluate_1.evaluateQuotation)((0, fixtures_1.input)([
            (0, fixtures_1.line)({
                quoteLineId: 'line_2',
                productId: 'prd_9',
                categoryId: fixtures_1.CAT_SERVICES,
                categoryName: 'Services',
                unitPriceMinor: 45_000,
                discountBps: 1800,
                lineTotalMinor: 36_900,
                costMinor: 30_881,
            }),
            (0, fixtures_1.line)({ quoteLineId: 'line_1', unitPriceMinor: 30_000, discountBps: 900, lineTotalMinor: 27_300, costMinor: 26_000 }),
        ]));
        expect(result.blend.weightedExcessBps).toBe(460);
        expect(result.blend.worstLineExcessBps).toBe(800);
        expect(result.blend.marginBps).toBe(1140);
        expect(result.riskLevel).toBe('HIGH');
        expect(result.requiredApprovals).toEqual(['SALES_MANAGER', 'FINANCE']);
        expect(result.violations[0]).toMatchObject({
            quoteLineId: 'line_2',
            categoryName: 'Services',
            allowedBps: 1000,
            actualBps: 1800,
            excessBps: 800,
        });
        // NOTE: plan.md prints 82 for this example. The engine computes 80.
        // The doc number was illustrative and predates the four-factor model.
        expect(result.riskScore).toBe(80);
    });
    it('never exceeds 100 or drops below 0', () => {
        const savage = (0, evaluate_1.evaluateQuotation)((0, fixtures_1.input)([(0, fixtures_1.line)({ quoteLineId: 'l1', categoryId: fixtures_1.CAT_SUBSCRIPTIONS, categoryName: 'Subscriptions', discountBps: 9000, lineTotalMinor: 10_000, costMinor: 90_000 })]));
        expect(savage.riskScore).toBe(100);
        const pristine = (0, evaluate_1.evaluateQuotation)((0, fixtures_1.input)([(0, fixtures_1.line)({ quoteLineId: 'l1', discountBps: 0, lineTotalMinor: 100_000, costMinor: 10_000 })]));
        expect(pristine.riskScore).toBe(0);
        expect(pristine.riskLevel).toBe('LOW');
    });
    it('scores margin pressure on its own without demanding an approval for it', () => {
        // thin margin, zero discount violation. It should colour the badge and
        // raise a deal-health event, but routing is a discount decision only.
        const result = (0, evaluate_1.evaluateQuotation)((0, fixtures_1.input)([(0, fixtures_1.line)({ quoteLineId: 'l1', discountBps: 0, lineTotalMinor: 100_000, costMinor: 95_000 })]));
        expect(result.blend.marginBps).toBe(500);
        expect(result.factors.find((f) => f.key === 'MARGIN_PRESSURE')?.points).toBe(20);
        expect(result.approvalRequired).toBe(false);
    });
    it('survives an empty quote instead of dividing by zero', () => {
        const result = (0, evaluate_1.evaluateQuotation)((0, fixtures_1.input)([]));
        expect(result.blend).toMatchObject({ weightedExcessBps: 0, worstLineExcessBps: 0, marginBps: 0, netMinor: 0 });
        expect(result.approvalRequired).toBe(false);
    });
    it('multiplies unit cost by quantity when computing margin', () => {
        const { netMinor, marginBps } = (0, risk_1.computeMarginBps)([
            (0, fixtures_1.line)({ quoteLineId: 'l1', qty: 4, lineTotalMinor: 400_000, costMinor: 60_000 }),
        ]);
        expect(netMinor).toBe(400_000);
        expect(marginBps).toBe(4000); // (400000 - 240000) / 400000
    });
    it('returns four named factors that add up to the score', () => {
        const result = (0, evaluate_1.evaluateQuotation)((0, fixtures_1.input)([(0, fixtures_1.line)({ quoteLineId: 'l1', categoryId: fixtures_1.CAT_SERVICES, categoryName: 'Services', discountBps: 1600 })]));
        const total = result.factors.reduce((s, f) => s + f.points, 0);
        expect(result.factors).toHaveLength(4);
        expect(total).toBe(result.riskScore);
        result.factors.forEach((f) => expect(f.points).toBeLessThanOrEqual(f.maxPoints));
    });
});
//# sourceMappingURL=risk.spec.js.map