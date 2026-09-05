// B2 OWNED. Shared test fixtures. Mirrors what prisma/seed/policy.seed.ts writes,
// so a test that passes here describes the behaviour the demo will actually show.

import type { EngineLine, EnginePolicy, EvaluationInput } from '../types';

export const GOLD = 'tier_gold';
export const CAT_HARDWARE = 'cat_hardware';
export const CAT_SERVICES = 'cat_services';
export const CAT_SUBSCRIPTIONS = 'cat_subs';

/** Tier ceilings Bronze 5 / Silver 10 / Gold 15, category ceilings Hardware 15 /
 *  Services 10 / Subscriptions 8, each category row stored as the min of the two.
 *  Manager threshold 0 bps (any excess needs a manager), finance threshold
 *  500 bps (five points of excess pulls finance in). */
export const goldPolicies: EnginePolicy[] = [
  { id: 'pol_gold_default', tierId: GOLD, categoryId: null, maxDiscountBps: 1500, requiresManagerAboveBps: 0, requiresFinanceAboveBps: 500 },
  { id: 'pol_gold_hw', tierId: GOLD, categoryId: CAT_HARDWARE, maxDiscountBps: 1500, requiresManagerAboveBps: 0, requiresFinanceAboveBps: 500 },
  { id: 'pol_gold_svc', tierId: GOLD, categoryId: CAT_SERVICES, maxDiscountBps: 1000, requiresManagerAboveBps: 0, requiresFinanceAboveBps: 500 },
  { id: 'pol_gold_sub', tierId: GOLD, categoryId: CAT_SUBSCRIPTIONS, maxDiscountBps: 800, requiresManagerAboveBps: 0, requiresFinanceAboveBps: 500 },
];

export function line(over: Partial<EngineLine> & { quoteLineId: string }): EngineLine {
  return {
    productId: 'prd_1',
    categoryId: CAT_HARDWARE,
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

export function input(lines: EngineLine[], policies = goldPolicies): EvaluationInput {
  return { quotationId: 'qt_test', currency: 'INR', tierId: GOLD, tierCode: 'GOLD', lines, policies };
}
