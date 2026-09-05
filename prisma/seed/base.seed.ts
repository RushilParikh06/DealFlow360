/**
 * TEMPORARILY B2-OWNED. Master data: tiers, categories, users, products,
 * warehouses, inventory, product relationships.
 *
 * B1 owns users, B3 owns products/warehouses/inventory. This file exists because
 * B2 cannot evaluate a quotation against a policy table that has no tiers and no
 * categories, and at T+0 nobody else's seed exists yet. When B1 and B3 write
 * theirs, split this file along the marked boundaries and delete the halves.
 *
 * Every number here is chosen to match the fixtures in
 * apps/api/src/modules/intelligence/engine/__tests__/, so the demo shows the
 * exact figures the unit tests assert. That is deliberate: "the number on screen
 * is the number in the test" is a strong thing to be able to say to a judge.
 */

import { scryptSync, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

/**
 * B1 OWNS PASSWORD HASHING. This is a dependency-free stand-in so the seed runs
 * before B1's auth module exists. The stored format is self-describing
 * (`scrypt$salt$hash`) so the moment B1 switches to bcrypt/argon the mismatch is
 * obvious rather than mysterious.
 *
 * B1: replace this function with your hash call and re-run `pnpm db:seed`.
 */
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'dealflow123';

function placeholderHash(password: string): string {
  const salt = randomBytes(8).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 32).toString('hex')}`;
}

// ---------------------------------------------------------------------------
// B1's half
// ---------------------------------------------------------------------------

const TIERS = [
  { code: 'BRONZE', name: 'Bronze' },
  { code: 'SILVER', name: 'Silver' },
  { code: 'GOLD', name: 'Gold' },
] as const;

const USERS = [
  { email: 'admin@dealflow.test', name: 'Asha Admin', role: 'ADMIN' as const },
  { email: 'finance@dealflow.test', name: 'Farid Finance', role: 'FINANCE' as const },
  { email: 'manager@dealflow.test', name: 'Meera Manager', role: 'SALES_MANAGER' as const },
  { email: 'rep@dealflow.test', name: 'Ravi Rep', role: 'SALES_REP' as const },
  // A second rep with a clean discount history, so the anomaly detector has a
  // contrast case to point at during the demo.
  { email: 'rep2@dealflow.test', name: 'Neha Rep', role: 'SALES_REP' as const },
];

// ---------------------------------------------------------------------------
// B3's half
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { code: 'HARDWARE', name: 'Hardware' },
  { code: 'SERVICES', name: 'Services' },
  { code: 'SUBSCRIPTIONS', name: 'Subscriptions' },
] as const;

/** Prices are minor units (paise). listPrice 30_000 = Rs 300.00. */
const PRODUCTS = [
  // HARDWARE — thin margins, generous 15% ceiling
  { sku: 'HW-SRV-R220', name: 'RackServer R220', category: 'HARDWARE', listPriceMinor: 30_000, unitCostMinor: 26_000, lineType: 'ONE_TIME' as const },
  { sku: 'HW-SW-24P', name: '24-Port Managed Switch', category: 'HARDWARE', listPriceMinor: 12_000, unitCostMinor: 7_000, lineType: 'ONE_TIME' as const },
  { sku: 'HW-UPS-2K', name: '2kVA Rack UPS', category: 'HARDWARE', listPriceMinor: 8_000, unitCostMinor: 5_000, lineType: 'ONE_TIME' as const },
  // SERVICES — 10% ceiling
  { sku: 'SVC-IMPL-10D', name: 'Implementation Services (10 days)', category: 'SERVICES', listPriceMinor: 45_000, unitCostMinor: 30_881, lineType: 'ONE_TIME' as const },
  { sku: 'SVC-TRAIN-1D', name: 'Onsite Training Day', category: 'SERVICES', listPriceMinor: 9_000, unitCostMinor: 4_000, lineType: 'ONE_TIME' as const },
  // SUBSCRIPTIONS — tightest ceiling at 8%, and the fattest margins. That
  // combination is what makes the per-category rule interesting.
  { sku: 'SUB-SUPP-Y', name: 'Priority Support (annual)', category: 'SUBSCRIPTIONS', listPriceMinor: 24_000, unitCostMinor: 6_000, lineType: 'RECURRING' as const },
  { sku: 'SUB-MON-Y', name: 'Infra Monitoring (annual)', category: 'SUBSCRIPTIONS', listPriceMinor: 18_000, unitCostMinor: 5_000, lineType: 'RECURRING' as const },
];

const WAREHOUSES = [
  { code: 'WH-MAIN', name: 'Main Warehouse', shipmentCostMinor: 4_200 },
  { code: 'WH-EAST', name: 'East Depot', shipmentCostMinor: 2_900 },
  { code: 'WH-WEST', name: 'West Hub', shipmentCostMinor: 3_500 },
];

/**
 * RackServer stock is 22 in Main and 10 in East on purpose: an order for 24 then
 * produces exactly the 22 + 2 split asserted in allocation.spec.ts, and an order
 * for 40 backorders exactly 8.
 */
const INVENTORY: Array<{ warehouse: string; sku: string; onHand: number }> = [
  { warehouse: 'WH-MAIN', sku: 'HW-SRV-R220', onHand: 22 },
  { warehouse: 'WH-EAST', sku: 'HW-SRV-R220', onHand: 10 },
  { warehouse: 'WH-MAIN', sku: 'HW-SW-24P', onHand: 40 },
  { warehouse: 'WH-WEST', sku: 'HW-SW-24P', onHand: 15 },
  { warehouse: 'WH-MAIN', sku: 'HW-UPS-2K', onHand: 6 },
  { warehouse: 'WH-EAST', sku: 'HW-UPS-2K', onHand: 6 },
  { warehouse: 'WH-WEST', sku: 'HW-UPS-2K', onHand: 6 },
];

/** attachRateBps is a seeded co-purchase rate. B2 ranks on marginDelta x attachRate. */
const RELATIONSHIPS: Array<{ source: string; target: string; kind: 'UPSELL' | 'CROSS_SELL'; attachRateBps: number }> = [
  // Support attaches to servers most often AND carries the best margin, so it
  // should come out top of the upsell rank. Good thing to point at on stage.
  { source: 'HW-SRV-R220', target: 'SUB-SUPP-Y', kind: 'UPSELL', attachRateBps: 6_500 },
  { source: 'HW-SRV-R220', target: 'HW-UPS-2K', kind: 'CROSS_SELL', attachRateBps: 5_500 },
  { source: 'HW-SRV-R220', target: 'HW-SW-24P', kind: 'CROSS_SELL', attachRateBps: 4_000 },
  { source: 'HW-SRV-R220', target: 'SVC-IMPL-10D', kind: 'UPSELL', attachRateBps: 3_500 },
  { source: 'SVC-IMPL-10D', target: 'SVC-TRAIN-1D', kind: 'UPSELL', attachRateBps: 3_000 },
  { source: 'SVC-IMPL-10D', target: 'SUB-MON-Y', kind: 'CROSS_SELL', attachRateBps: 2_500 },
  { source: 'HW-SW-24P', target: 'SUB-MON-Y', kind: 'CROSS_SELL', attachRateBps: 2_000 },
];

export interface BaseSeedResult {
  tierIdByCode: Map<string, string>;
  categoryIdByCode: Map<string, string>;
  userIdByEmail: Map<string, string>;
  productIdBySku: Map<string, string>;
  warehouseIdByCode: Map<string, string>;
}

export async function seedBase(prisma: PrismaClient): Promise<BaseSeedResult> {
  const tierIdByCode = new Map<string, string>();
  for (const t of TIERS) {
    const row = await prisma.customerTier.upsert({
      where: { code: t.code },
      create: { code: t.code, name: t.name },
      update: { name: t.name },
    });
    tierIdByCode.set(t.code, row.id);
  }

  const categoryIdByCode = new Map<string, string>();
  for (const c of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { code: c.code },
      create: { code: c.code, name: c.name },
      update: { name: c.name },
    });
    categoryIdByCode.set(c.code, row.id);
  }

  const userIdByEmail = new Map<string, string>();
  for (const u of USERS) {
    const row = await prisma.user.upsert({
      where: { email: u.email },
      create: { email: u.email, name: u.name, role: u.role, passwordHash: placeholderHash(SEED_PASSWORD) },
      update: { name: u.name, role: u.role },
    });
    userIdByEmail.set(u.email, row.id);
  }

  const productIdBySku = new Map<string, string>();
  for (const p of PRODUCTS) {
    const categoryId = categoryIdByCode.get(p.category);
    if (!categoryId) throw new Error(`Product ${p.sku} references unknown category ${p.category}`);
    const row = await prisma.product.upsert({
      where: { sku: p.sku },
      create: {
        sku: p.sku,
        name: p.name,
        categoryId,
        listPriceMinor: p.listPriceMinor,
        unitCostMinor: p.unitCostMinor,
        currency: 'INR',
        lineType: p.lineType,
      },
      update: { name: p.name, categoryId, listPriceMinor: p.listPriceMinor, unitCostMinor: p.unitCostMinor, lineType: p.lineType },
    });
    productIdBySku.set(p.sku, row.id);
  }

  const warehouseIdByCode = new Map<string, string>();
  for (const w of WAREHOUSES) {
    const row = await prisma.warehouse.upsert({
      where: { code: w.code },
      create: w,
      update: { name: w.name, shipmentCostMinor: w.shipmentCostMinor },
    });
    warehouseIdByCode.set(w.code, row.id);
  }

  for (const i of INVENTORY) {
    const warehouseId = warehouseIdByCode.get(i.warehouse)!;
    const productId = productIdBySku.get(i.sku)!;
    await prisma.inventory.upsert({
      where: { warehouseId_productId: { warehouseId, productId } },
      create: { warehouseId, productId, onHand: i.onHand },
      update: { onHand: i.onHand },
    });
  }

  for (const r of RELATIONSHIPS) {
    const sourceProductId = productIdBySku.get(r.source)!;
    const targetProductId = productIdBySku.get(r.target)!;
    await prisma.productRelationship.upsert({
      where: { sourceProductId_targetProductId_kind: { sourceProductId, targetProductId, kind: r.kind } },
      create: { sourceProductId, targetProductId, kind: r.kind, attachRateBps: r.attachRateBps },
      update: { attachRateBps: r.attachRateBps },
    });
  }

  console.log(
    `  base: ${TIERS.length} tiers, ${CATEGORIES.length} categories, ${USERS.length} users, ` +
      `${PRODUCTS.length} products, ${WAREHOUSES.length} warehouses, ${INVENTORY.length} inventory rows, ` +
      `${RELATIONSHIPS.length} relationships`,
  );
  console.log(`  every seeded user's password is "${SEED_PASSWORD}" (placeholder hash, B1 to replace)`);

  return { tierIdByCode, categoryIdByCode, userIdByEmail, productIdBySku, warehouseIdByCode };
}
