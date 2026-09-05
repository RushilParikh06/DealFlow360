/**
 * Seed entry point. `pnpm db:seed` runs this.
 *
 * Order matters: policies need tiers and categories to exist, demo quotes need
 * products and users. Everything is idempotent, so re-running it is the normal
 * way to reset the demo between rehearsals rather than something to be careful
 * about.
 */

import { PrismaClient } from '@prisma/client';
import { seedBase } from './base.seed';
import { seedDiscountPolicies } from './policy.seed';
import { seedDemo } from './demo.seed';
import { seedBilling } from './billing.seed';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('seeding dealflow360');

  console.log('\n1/4 master data');
  const base = await seedBase(prisma);

  console.log('\n2/4 discount policies (the table that governs all approval routing)');
  await seedDiscountPolicies(prisma);

  console.log('\n3/4 demo quotations');
  await seedDemo(prisma, base);

  console.log('\n4/4 fulfilments, invoices, payments and subscriptions');
  await seedBilling(prisma);

  console.log('\ndone. Next: POST /api/v1/quotes/<QT-1001 id>/evaluate');
}

main()
  .catch((error) => {
    console.error('\nseed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
