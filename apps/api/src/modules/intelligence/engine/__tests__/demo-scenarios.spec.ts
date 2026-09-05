/**
 * B2 OWNED. These tests exist to protect the DEMO, not the engine.
 *
 * The table below mirrors prisma/seed/demo.seed.ts. If somebody tweaks a seeded
 * discount at 2am because a screen looked better, this suite fails and tells them
 * which demo beat they just broke - instead of the team finding out on stage.
 *
 * KEEP IN SYNC WITH prisma/seed/demo.seed.ts. Nothing enforces that but this
 * comment and the fact that these numbers appear nowhere else.
 */

import { evaluateQuotation } from '../evaluate';
import type { EngineLine, EnginePolicy } from '../types';

const BPS = 10_000;
const roundHalfUp = (v: number): number => (v >= 0 ? Math.floor(v + 0.5) : -Math.floor(-v + 0.5));

/** Ceilings in percentage points, exactly as policy.seed.ts states them. */
const TIER_PCT = { BRONZE: 5, SILVER: 10, GOLD: 15 } as const;
const CATEGORY_PCT = { HARDWARE: 15, SERVICES: 10, SUBSCRIPTIONS: 8 } as const;

type TierCode = keyof typeof TIER_PCT;
type CategoryCode = keyof typeof CATEGORY_PCT;

/** Rebuilds what policy.seed.ts writes, min() included. */
function policiesFor(tier: TierCode): EnginePolicy[] {
  const rows: EnginePolicy[] = [
    {
      id: `pol_${tier}_default`,
      tierId: tier,
      categoryId: null,
      maxDiscountBps: TIER_PCT[tier] * 100,
      requiresManagerAboveBps: 0,
      requiresFinanceAboveBps: 500,
    },
  ];
  for (const category of Object.keys(CATEGORY_PCT) as CategoryCode[]) {
    rows.push({
      id: `pol_${tier}_${category}`,
      tierId: tier,
      categoryId: category,
      maxDiscountBps: Math.min(TIER_PCT[tier], CATEGORY_PCT[category]) * 100,
      requiresManagerAboveBps: 0,
      requiresFinanceAboveBps: 500,
    });
  }
  return rows;
}

/** Mirrors base.seed.ts PRODUCTS. */
const PRODUCTS: Record<string, { category: CategoryCode; priceMinor: number; costMinor: number }> = {
  'HW-SRV-R220': { category: 'HARDWARE', priceMinor: 30_000, costMinor: 26_000 },
  'HW-SW-24P': { category: 'HARDWARE', priceMinor: 12_000, costMinor: 7_000 },
  'HW-UPS-2K': { category: 'HARDWARE', priceMinor: 8_000, costMinor: 5_000 },
  'SVC-IMPL-10D': { category: 'SERVICES', priceMinor: 45_000, costMinor: 30_881 },
  'SVC-TRAIN-1D': { category: 'SERVICES', priceMinor: 9_000, costMinor: 4_000 },
  'SUB-SUPP-Y': { category: 'SUBSCRIPTIONS', priceMinor: 24_000, costMinor: 6_000 },
  'SUB-MON-Y': { category: 'SUBSCRIPTIONS', priceMinor: 18_000, costMinor: 5_000 },
};

function buildLines(code: string, rows: Array<[sku: string, qty: number, discountBps: number]>): EngineLine[] {
  return rows.map(([sku, qty, discountBps], i) => {
    const product = PRODUCTS[sku]!;
    const gross = product.priceMinor * qty;
    return {
      quoteLineId: `${code}-L${i + 1}`,
      productId: sku,
      categoryId: product.category,
      categoryName: product.category,
      qty,
      unitPriceMinor: product.priceMinor,
      discountBps,
      lineTotalMinor: roundHalfUp((gross * (BPS - discountBps)) / BPS),
      costMinor: product.costMinor,
      lineType: 'ONE_TIME',
    };
  });
}

function evaluateSeeded(code: string, tier: TierCode, rows: Array<[string, number, number]>) {
  const lines = buildLines(code, rows);
  return evaluateQuotation({
    quotationId: code,
    currency: 'INR',
    tierId: tier,
    tierCode: tier,
    lines,
    policies: policiesFor(tier),
  });
}

describe('seeded demo scenarios', () => {
  it('QT-1001 is the plan.md section 8 worked example and pulls Finance in', () => {
    const r = evaluateSeeded('QT-1001', 'GOLD', [
      ['SVC-IMPL-10D', 1, 1800],
      ['HW-SRV-R220', 1, 900],
    ]);

    expect(r.blend.netMinor).toBe(64_200);
    expect(r.blend.marginBps).toBe(1140);
    expect(r.blend.weightedExcessBps).toBe(460);
    expect(r.blend.worstLineExcessBps).toBe(800);
    expect(r.riskScore).toBe(80);
    expect(r.riskLevel).toBe('HIGH');
    expect(r.requiredApprovals).toEqual(['SALES_MANAGER', 'FINANCE']);
    expect(r.violations).toHaveLength(1);
  });

  it('QT-1002 would pass an order-level cap and still gets flagged (the pitch)', () => {
    const rows: Array<[string, number, number]> = [
      ['SUB-SUPP-Y', 4, 1300],
      ['SUB-MON-Y', 4, 1250],
      ['SVC-TRAIN-1D', 3, 1400],
      ['HW-SW-24P', 6, 1800],
    ];
    const r = evaluateSeeded('QT-1002', 'GOLD', rows);

    // The claim on the slide: overall discount is under the customer's own
    // 15 percent tier cap, so a single order-level check sees nothing wrong.
    const lines = buildLines('QT-1002', rows);
    const grossMinor = lines.reduce((s, l) => s + l.unitPriceMinor * l.qty, 0);
    const overallDiscountBps = Math.round(((grossMinor - r.blend.netMinor) * BPS) / grossMinor);
    expect(overallDiscountBps).toBe(1431);
    expect(overallDiscountBps).toBeLessThanOrEqual(TIER_PCT.GOLD * 100);

    // ...and yet, line by line, four separate ceilings are breached.
    expect(r.violations).toHaveLength(4);
    expect(r.blend.weightedExcessBps).toBe(424);
    expect(r.blend.worstLineExcessBps).toBe(500);
    expect(r.riskScore).toBe(59);
    expect(r.riskLevel).toBe('MEDIUM');

    // Manager only. The worst line sits exactly ON the finance threshold, not
    // above it, so Finance is correctly left out. This is the contrast beat.
    expect(r.requiredApprovals).toEqual(['SALES_MANAGER']);
  });

  it('QT-1003 is fully compliant, so nothing is asked of anyone', () => {
    const r = evaluateSeeded('QT-1003', 'SILVER', [
      ['HW-SRV-R220', 2, 800],
      ['SUB-SUPP-Y', 2, 700],
    ]);

    expect(r.violations).toEqual([]);
    expect(r.blend.weightedExcessBps).toBe(0);
    expect(r.riskScore).toBe(0);
    expect(r.requiredApprovals).toEqual([]);
    expect(r.approvalRequired).toBe(false);
  });

  it('QT-1006 is a single dramatic breach that also loses money', () => {
    const r = evaluateSeeded('QT-1006', 'BRONZE', [['HW-SRV-R220', 5, 2800]]);

    expect(r.blend.worstLineExcessBps).toBe(2300); // Bronze caps at 500 bps
    expect(r.blend.marginBps).toBeLessThan(0);
    expect(r.riskScore).toBe(100);
    expect(r.requiredApprovals).toEqual(['SALES_MANAGER', 'FINANCE']);
  });
});
