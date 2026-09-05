"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const deal_health_1 = require("../deal-health");
const NOW = new Date('2026-09-05T12:00:00.000Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 86_400_000);
const base = {
    quotationId: 'qt_1',
    status: 'PENDING_MANAGER',
    lastActivityAt: daysAgo(1),
    marginBps: 3000,
    lines: [{ discountBps: 500, lineTotalMinor: 100_000 }],
    repAverageDiscountBps: 600,
    promisedDeliveryDate: null,
    projectedDeliveryDate: null,
};
const typesOf = (input) => (0, deal_health_1.detectDealHealth)(input, NOW).map((f) => f.type);
describe('deal health detection', () => {
    it('finds nothing wrong with a healthy live quote', () => {
        expect((0, deal_health_1.detectDealHealth)(base, NOW)).toEqual([]);
    });
    it('flags a stalled quote and escalates severity with age', () => {
        const warn = (0, deal_health_1.detectDealHealth)({ ...base, lastActivityAt: daysAgo(9) }, NOW);
        expect(warn[0]).toMatchObject({ type: 'STALLED', severity: 'WARN', dedupeKey: 'STALLED:WARN' });
        expect(warn[0].message).toContain('9 days');
        const critical = (0, deal_health_1.detectDealHealth)({ ...base, lastActivityAt: daysAgo(21) }, NOW);
        expect(critical[0]).toMatchObject({ severity: 'CRITICAL', dedupeKey: 'STALLED:CRITICAL' });
    });
    it('does not call a closed deal stalled', () => {
        expect(typesOf({ ...base, status: 'COMPLETED', lastActivityAt: daysAgo(60) })).not.toContain('STALLED');
        expect(typesOf({ ...base, status: 'CONFIRMED', lastActivityAt: daysAgo(60) })).not.toContain('STALLED');
    });
    it('measures a discount anomaly against the rep own history, not a global number', () => {
        const anomalous = { ...base, lines: [{ discountBps: 1500, lineTotalMinor: 100_000 }], repAverageDiscountBps: 600 };
        const f = (0, deal_health_1.detectDealHealth)(anomalous, NOW).find((x) => x.type === 'DISCOUNT_ANOMALY');
        expect(f).toMatchObject({ severity: 'WARN' });
        expect(f.metadata).toMatchObject({ orderDiscountBps: 1500, repAverageDiscountBps: 600, deltaBps: 900 });
        // a rep who always discounts heavily does not get flagged for being themselves
        expect(typesOf({ ...anomalous, repAverageDiscountBps: 1400 })).not.toContain('DISCOUNT_ANOMALY');
    });
    it('stays quiet when the rep has no history to compare against', () => {
        expect(typesOf({ ...base, lines: [{ discountBps: 4000, lineTotalMinor: 100_000 }], repAverageDiscountBps: null })).not.toContain('DISCOUNT_ANOMALY');
    });
    it('flags delivery slippage only when the projection is later than the promise', () => {
        const promised = new Date('2026-09-20T00:00:00.000Z');
        expect(typesOf({ ...base, promisedDeliveryDate: promised, projectedDeliveryDate: new Date('2026-09-19T00:00:00.000Z') })).not.toContain('DELIVERY_SLIPPAGE');
        const slipped = (0, deal_health_1.detectDealHealth)({ ...base, promisedDeliveryDate: promised, projectedDeliveryDate: new Date('2026-09-26T00:00:00.000Z') }, NOW);
        expect(slipped.find((f) => f.type === 'DELIVERY_SLIPPAGE')).toMatchObject({ severity: 'CRITICAL' });
    });
    it('flags low margin and escalates below the critical floor', () => {
        expect((0, deal_health_1.detectDealHealth)({ ...base, marginBps: 1200 }, NOW).find((f) => f.type === 'LOW_MARGIN')).toMatchObject({ severity: 'WARN' });
        expect((0, deal_health_1.detectDealHealth)({ ...base, marginBps: 400 }, NOW).find((f) => f.type === 'LOW_MARGIN')).toMatchObject({ severity: 'CRITICAL' });
    });
    it('reports every condition at once instead of stopping at the first', () => {
        const wrecked = {
            ...base,
            lastActivityAt: daysAgo(30),
            marginBps: 300,
            lines: [{ discountBps: 3000, lineTotalMinor: 100_000 }],
            repAverageDiscountBps: 500,
            promisedDeliveryDate: new Date('2026-09-10T00:00:00.000Z'),
            projectedDeliveryDate: new Date('2026-09-30T00:00:00.000Z'),
        };
        expect(typesOf(wrecked).sort()).toEqual(['DELIVERY_SLIPPAGE', 'DISCOUNT_ANOMALY', 'LOW_MARGIN', 'STALLED']);
    });
    it('produces the same dedupeKey for a condition that is still true', () => {
        const a = (0, deal_health_1.detectDealHealth)({ ...base, lastActivityAt: daysAgo(9) }, NOW);
        const b = (0, deal_health_1.detectDealHealth)({ ...base, lastActivityAt: daysAgo(11) }, NOW);
        // the sweep can run every five minutes and the unique index absorbs it
        expect(a[0].dedupeKey).toBe(b[0].dedupeKey);
    });
    it('weights the order discount by line value, matching the risk engine', () => {
        expect((0, deal_health_1.weightedDiscountBps)([
            { discountBps: 2000, lineTotalMinor: 10_000 },
            { discountBps: 0, lineTotalMinor: 90_000 },
        ])).toBe(200);
        expect((0, deal_health_1.weightedDiscountBps)([])).toBe(0);
    });
});
//# sourceMappingURL=deal-health.spec.js.map