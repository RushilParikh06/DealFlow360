"use strict";
// B2 OWNED. Shared test fixtures. Mirrors what prisma/seed/policy.seed.ts writes,
// so a test that passes here describes the behaviour the demo will actually show.
Object.defineProperty(exports, "__esModule", { value: true });
exports.goldPolicies = exports.CAT_SUBSCRIPTIONS = exports.CAT_SERVICES = exports.CAT_HARDWARE = exports.GOLD = void 0;
exports.line = line;
exports.input = input;
exports.GOLD = 'tier_gold';
exports.CAT_HARDWARE = 'cat_hardware';
exports.CAT_SERVICES = 'cat_services';
exports.CAT_SUBSCRIPTIONS = 'cat_subs';
/** Tier ceilings Bronze 5 / Silver 10 / Gold 15, category ceilings Hardware 15 /
 *  Services 10 / Subscriptions 8, each category row stored as the min of the two.
 *  Manager threshold 0 bps (any excess needs a manager), finance threshold
 *  500 bps (five points of excess pulls finance in). */
exports.goldPolicies = [
    { id: 'pol_gold_default', tierId: exports.GOLD, categoryId: null, maxDiscountBps: 1500, requiresManagerAboveBps: 0, requiresFinanceAboveBps: 500 },
    { id: 'pol_gold_hw', tierId: exports.GOLD, categoryId: exports.CAT_HARDWARE, maxDiscountBps: 1500, requiresManagerAboveBps: 0, requiresFinanceAboveBps: 500 },
    { id: 'pol_gold_svc', tierId: exports.GOLD, categoryId: exports.CAT_SERVICES, maxDiscountBps: 1000, requiresManagerAboveBps: 0, requiresFinanceAboveBps: 500 },
    { id: 'pol_gold_sub', tierId: exports.GOLD, categoryId: exports.CAT_SUBSCRIPTIONS, maxDiscountBps: 800, requiresManagerAboveBps: 0, requiresFinanceAboveBps: 500 },
];
function line(over) {
    return {
        productId: 'prd_1',
        categoryId: exports.CAT_HARDWARE,
        categoryName: 'Hardware',
        qty: 1,
        unitPriceMinor: 100_000,
        discountBps: 0,
        lineTotalMinor: 100_000,
        costMinor: 60_000,
        lineType: 'ONE_TIME',
        ...over,
    };
}
function input(lines, policies = exports.goldPolicies) {
    return { quotationId: 'qt_test', currency: 'INR', tierId: exports.GOLD, tierCode: 'GOLD', lines, policies };
}
//# sourceMappingURL=fixtures.js.map