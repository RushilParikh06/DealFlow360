/**
 * TEMPORARILY B2-OWNED. Demo quotations and one order.
 *
 * These rows are not filler. Each quote exists to make one specific behaviour
 * visible on stage, and the comment above each one says which. If a quote here
 * stops mattering to the demo script, delete it - a seed full of noise makes the
 * dashboard look impressive and the demo impossible to drive.
 *
 * All line totals are COMPUTED, never typed, using the same integer arithmetic
 * as the engine. Typing a total by hand is how a demo ends up showing a margin
 * that contradicts its own line items.
 */

import type { PrismaClient, QuotationStatus } from '@prisma/client';
import type { BaseSeedResult } from './base.seed';

const BPS_SCALE = 10_000;

/** Same half-up rule as packages/contracts/src/money.ts. Kept local so the seed
 *  has no import from apps/api and can run before the api compiles. */
const roundHalfUp = (v: number): number => (v >= 0 ? Math.floor(v + 0.5) : -Math.floor(-v + 0.5));

interface SeedLine {
  sku: string;
  qty: number;
  discountBps: number;
  /** Optional override of the product's list price, for a negotiated unit price. */
  unitPriceMinor?: number;
}

interface SeedQuote {
  code: string;
  customer: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  ownerEmail: string;
  status: QuotationStatus;
  /** How many days ago the quote was last touched. Drives deal-health staleness. */
  lastActivityDaysAgo: number;
  why: string;
  lines: SeedLine[];
}

const CUSTOMERS: Array<{ name: string; tier: 'BRONZE' | 'SILVER' | 'GOLD'; email: string }> = [
  { name: 'Meridian Logistics', tier: 'GOLD', email: 'buyer@meridian.test' },
  { name: 'Kalyani Textiles', tier: 'SILVER', email: 'buyer@kalyani.test' },
  { name: 'Sunfield Retail', tier: 'BRONZE', email: 'buyer@sunfield.test' },
];

const QUOTES: SeedQuote[] = [
  {
    // THE HERO QUOTE. Reproduces the worked example in plan.md section 8 exactly:
    // weightedExcess 460 bps, worstLine 800 bps, margin 1140 bps, HIGH,
    // routed to SALES_MANAGER then FINANCE. Same numbers as risk.spec.ts.
    code: 'QT-1001',
    customer: 'Meridian Logistics',
    tier: 'GOLD',
    ownerEmail: 'rep@dealflow.test',
    status: 'SUBMITTED',
    lastActivityDaysAgo: 0,
    why: 'plan.md s8 worked example: blend 460, worst 800, margin 1140, score 80 HIGH, Manager+Finance',
    lines: [
      { sku: 'SVC-IMPL-10D', qty: 1, discountBps: 1800 },
      { sku: 'HW-SRV-R220', qty: 1, discountBps: 900 },
    ],
  },
  {
    // THE DIFFERENTIATOR. Read this one carefully, it is the whole pitch.
    //
    // Overall discount on this order is 14.31 percent. The customer is GOLD, so
    // an order-level cap of 15 percent looks at 14.31 and passes it silently.
    // Per-category ceilings checked line by line find FOUR breaches, because
    // subscriptions are capped at 8 and services at 10 no matter how good the
    // customer is. Blended excess 424 bps, worst line 500 bps, score 59 MEDIUM,
    // routed to a Sales Manager and deliberately NOT to Finance - the worst line
    // is exactly at the 500 bps finance threshold, not above it.
    //
    // Contrast with QT-1001, which has ONE breach and does pull Finance in. Two
    // quotes, opposite shapes, and the routing is different for a reason you can
    // say out loud in ten seconds.
    code: 'QT-1002',
    customer: 'Meridian Logistics',
    tier: 'GOLD',
    ownerEmail: 'rep@dealflow.test',
    status: 'SUBMITTED',
    lastActivityDaysAgo: 1,
    why: 'INVARIANT 3: 14.31% overall would pass an order-level cap; four per-line breaches do not',
    lines: [
      { sku: 'SUB-SUPP-Y', qty: 4, discountBps: 1300 }, // ceiling 800 -> 500 over
      { sku: 'SUB-MON-Y', qty: 4, discountBps: 1250 }, // ceiling 800 -> 450 over
      { sku: 'SVC-TRAIN-1D', qty: 3, discountBps: 1400 }, // ceiling 1000 -> 400 over
      { sku: 'HW-SW-24P', qty: 6, discountBps: 1800 }, // ceiling 1500 -> 300 over
    ],
  },
  {
    // THE CLEAN QUOTE. Every line inside its ceiling, so evaluation auto-approves
    // and no approval chain is created. Shows the engine is not a rubber stamp
    // that flags everything.
    code: 'QT-1003',
    customer: 'Kalyani Textiles',
    tier: 'SILVER',
    ownerEmail: 'rep2@dealflow.test',
    status: 'SUBMITTED',
    lastActivityDaysAgo: 0,
    why: 'fully compliant: auto-approve path, empty requiredApprovals',
    lines: [
      { sku: 'HW-SRV-R220', qty: 2, discountBps: 800 }, // Silver hardware ceiling 1000
      { sku: 'SUB-SUPP-Y', qty: 2, discountBps: 700 }, // Silver subs ceiling 800
    ],
  },
  {
    // STALLED, CRITICAL. 16 days without activity while sitting in SUBMITTED.
    // Crosses the 14-day critical threshold in deal-health.ts.
    code: 'QT-1004',
    customer: 'Sunfield Retail',
    tier: 'BRONZE',
    ownerEmail: 'rep@dealflow.test',
    status: 'SUBMITTED',
    lastActivityDaysAgo: 16,
    why: 'deal health STALLED / CRITICAL',
    lines: [{ sku: 'HW-UPS-2K', qty: 3, discountBps: 400 }],
  },
  {
    // STALLED, WARNING. 9 days: past the 7-day warn threshold, short of critical.
    // Having both severities on the dashboard makes the colour coding mean
    // something.
    code: 'QT-1005',
    customer: 'Kalyani Textiles',
    tier: 'SILVER',
    ownerEmail: 'rep2@dealflow.test',
    status: 'NEGOTIATING',
    lastActivityDaysAgo: 9,
    why: 'deal health STALLED / WARN',
    lines: [{ sku: 'SVC-TRAIN-1D', qty: 2, discountBps: 900 }],
  },
  {
    // DISCOUNT ANOMALY plus LOW MARGIN. Ravi's other quotes average 11.94 points
    // of discount; this one is 28, so the detector reports "16.06 points above
    // this rep's own average". It fires because of the gap to HIS history, not
    // because 28 is a big number in the abstract - a rep who always discounts
    // 25 percent would not trip it, which is the point of an anomaly detector.
    //
    // The RackServer only carries 13.3 percent gross margin, so 28 percent off
    // takes the order margin NEGATIVE (-20.37 percent). That is deliberate: the
    // dashboard should be able to say "this deal loses money" out loud.
    code: 'QT-1006',
    customer: 'Sunfield Retail',
    tier: 'BRONZE',
    ownerEmail: 'rep@dealflow.test',
    status: 'SUBMITTED',
    lastActivityDaysAgo: 2,
    why: 'deal health DISCOUNT_ANOMALY vs the rep own average, plus MARGIN_EROSION',
    lines: [{ sku: 'HW-SRV-R220', qty: 5, discountBps: 2800 }],
  },
  {
    // The quote behind the allocation demo. Already CONFIRMED, 24 RackServers,
    // which against seeded stock of 22 in Main and 10 in East produces the exact
    // 22 + 2 split asserted in allocation.spec.ts. CONFIRMED is outside the
    // deal-health sweep's status set, so this quote's thin margin does not clutter
    // the health dashboard.
    code: 'QT-1007',
    customer: 'Meridian Logistics',
    tier: 'GOLD',
    ownerEmail: 'rep@dealflow.test',
    status: 'CONFIRMED',
    lastActivityDaysAgo: 3,
    why: 'source of the order used for the multi-warehouse split demo',
    lines: [{ sku: 'HW-SRV-R220', qty: 24, discountBps: 1200 }],
  },
];

function computeLine(listPriceMinor: number, unitCostMinor: number, l: SeedLine) {
  const unitPriceMinor = l.unitPriceMinor ?? listPriceMinor;
  const grossMinor = unitPriceMinor * l.qty;
  const lineTotalMinor = roundHalfUp((grossMinor * (BPS_SCALE - l.discountBps)) / BPS_SCALE);
  return { unitPriceMinor, lineTotalMinor, grossMinor, costMinor: unitCostMinor };
}

export async function seedDemo(prisma: PrismaClient, base: BaseSeedResult): Promise<void> {
  const products = await prisma.product.findMany();
  const bySku = new Map(products.map((p) => [p.sku, p]));

  const customerIdByName = new Map<string, string>();
  for (const c of CUSTOMERS) {
    const tierId = base.tierIdByCode.get(c.tier);
    if (!tierId) throw new Error(`Customer ${c.name} references unknown tier ${c.tier}`);
    const existing = await prisma.customer.findFirst({ where: { name: c.name } });
    const row = existing
      ? await prisma.customer.update({ where: { id: existing.id }, data: { tierId, email: c.email } })
      : await prisma.customer.create({ data: { name: c.name, tierId, email: c.email } });
    customerIdByName.set(c.name, row.id);
  }

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const q of QUOTES) {
    const customerId = customerIdByName.get(q.customer);
    const ownerUserId = base.userIdByEmail.get(q.ownerEmail);
    if (!customerId || !ownerUserId) throw new Error(`Quote ${q.code} references a missing customer or owner`);

    const computed = q.lines.map((l) => {
      const product = bySku.get(l.sku);
      if (!product) throw new Error(`Quote ${q.code} references unknown sku ${l.sku}`);
      return { line: l, product, ...computeLine(product.listPriceMinor, product.unitCostMinor, l) };
    });

    const grossMinor = computed.reduce((s, c) => s + c.grossMinor, 0);
    const netMinor = computed.reduce((s, c) => s + c.lineTotalMinor, 0);
    const costMinor = computed.reduce((s, c) => s + c.costMinor * c.line.qty, 0);
    const marginBps = netMinor === 0 ? 0 : roundHalfUp(((netMinor - costMinor) * BPS_SCALE) / netMinor);
    const lastActivityAt = new Date(now - q.lastActivityDaysAgo * DAY_MS);

    const header = {
      customerId,
      ownerUserId,
      status: q.status,
      currency: 'INR',
      subtotalMinor: grossMinor,
      discountMinor: grossMinor - netMinor,
      taxMinor: 0,
      totalMinor: netMinor,
      marginBps,
      validUntil: new Date(now + 30 * DAY_MS),
      lastActivityAt,
    };

    const quote = await prisma.quotation.upsert({
      where: { code: q.code },
      create: { code: q.code, ...header },
      update: header,
    });

    // rewrite lines wholesale so re-running the seed cannot double them up
    await prisma.quotationLine.deleteMany({ where: { quotationId: quote.id } });
    await prisma.quotationLine.createMany({
      data: computed.map((c) => ({
        quotationId: quote.id,
        productId: c.product.id,
        description: c.product.name,
        qty: c.line.qty,
        unitPriceMinor: c.unitPriceMinor,
        discountBps: c.line.discountBps,
        lineTotalMinor: c.lineTotalMinor,
        // UNIT cost. The engine multiplies by qty. See the note in sales.prisma.
        costMinor: c.costMinor,
        lineType: c.product.lineType,
      })),
    });

    console.log(`  ${q.code}  net ${netMinor}  margin ${marginBps}bps  ${q.status.padEnd(11)} ${q.why}`);
  }

  // ---- the order for the allocation demo -----------------------------------
  const sourceQuote = await prisma.quotation.findUnique({
    where: { code: 'QT-1007' },
    include: { lines: true },
  });
  if (sourceQuote) {
    const orderHeader = {
      quotationId: sourceQuote.id,
      customerId: sourceQuote.customerId,
      status: 'CONFIRMED',
      currency: sourceQuote.currency,
      totalMinor: sourceQuote.totalMinor,
    };
    const order = await prisma.order.upsert({
      where: { code: 'ORD-2001' },
      create: { code: 'ORD-2001', ...orderHeader },
      update: orderHeader,
    });

    await prisma.orderLine.deleteMany({ where: { orderId: order.id } });
    await prisma.orderLine.createMany({
      data: sourceQuote.lines.map((l) => ({
        orderId: order.id,
        productId: l.productId,
        description: l.description,
        qty: l.qty,
        unitPriceMinor: l.unitPriceMinor,
        discountBps: l.discountBps,
        lineTotalMinor: l.lineTotalMinor,
        costMinor: l.costMinor,
        lineType: l.lineType,
      })),
    });

    // start clean so the split demo is repeatable
    await prisma.inventoryReservation.deleteMany({ where: { orderId: order.id } });
    console.log('  ORD-2001  24 x RackServer R220 -> expect a 22 + 2 split across Main and East');
  }
}
