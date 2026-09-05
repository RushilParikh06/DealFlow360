/**
 * B3 demo state: fulfilments, invoices, payments and subscriptions.
 *
 * The API can produce all of this itself - confirm a quote, walk the
 * fulfilment to SHIPPED, POST /orders/:id/invoices, POST a payment. The seed
 * exists so the demo does not open on four empty screens, and it deliberately
 * builds the same shapes those endpoints build, so a row that was seeded and a
 * row that was created on stage are indistinguishable.
 *
 * Idempotent: re-running resets billing to this exact state.
 */

import type { PrismaClient } from '@prisma/client';

/** Where each seeded order sits on the fulfilment path. */
const FULFILMENT_STATE: Record<string, string> = {
  'ORD-2001': 'PACKED', // mid-flight: the "Ship" button on stage has something to do
  'ORD-2002': 'SHIPPED', // shipped, so it can be invoiced
};

/** How much of each invoice has been collected, in basis points of the total. */
const PAID_BPS: Record<string, number> = {
  'ORD-2002': 4000, // 40% in, so the invoice sits in PARTIALLY_PAID
};

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export async function seedBilling(prisma: PrismaClient): Promise<void> {
  const orders = await prisma.order.findMany({ include: { lines: true }, orderBy: { code: 'asc' } });

  for (const order of orders) {
    // ---- fulfilment: exactly one per order, at its scripted state ----------
    const status = FULFILMENT_STATE[order.code] ?? 'ORDER_CONFIRMED';
    const existing = await prisma.fulfillment.findFirst({ where: { orderId: order.id } });
    if (existing) await prisma.fulfillment.update({ where: { id: existing.id }, data: { status } });
    else await prisma.fulfillment.create({ data: { orderId: order.id, status } });

    // Billing only follows shipment. This mirrors the engine's own rule rather
    // than seeding around it.
    if (status !== 'SHIPPED' && status !== 'DELIVERED') {
      console.log(`  ${order.code}  fulfilment ${status} (not billable yet)`);
      continue;
    }

    // ---- invoice: the ONE_TIME half of the order --------------------------
    const oneTime = order.lines.filter((line) => line.lineType === 'ONE_TIME');
    const totalMinor = oneTime.reduce((sum, line) => sum + line.lineTotalMinor, 0);

    await prisma.$transaction(async (tx) => {
      for (const invoice of await tx.invoice.findMany({ where: { orderId: order.id } })) {
        await tx.payment.deleteMany({ where: { invoiceId: invoice.id } });
        await tx.invoiceLine.deleteMany({ where: { invoiceId: invoice.id } });
        await tx.billingSchedule.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceId: null } });
        await tx.invoice.delete({ where: { id: invoice.id } });
      }
      if (oneTime.length === 0) return;

      const paidMinor = Math.floor((totalMinor * (PAID_BPS[order.code] ?? 0)) / 10_000);
      const invoice = await tx.invoice.create({
        data: {
          orderId: order.id,
          // Derived from paid-vs-total, the same way payment.service.ts derives
          // it. Never typed in by hand.
          status: paidMinor === 0 ? 'ISSUED' : paidMinor >= totalMinor ? 'PAID' : 'PARTIALLY_PAID',
          totalMinor,
          paidMinor,
          currency: order.currency,
          lines: {
            create: oneTime.map((line) => ({
              orderLineId: line.id,
              amountMinor: line.lineTotalMinor,
              currency: order.currency,
            })),
          },
        },
      });

      if (paidMinor > 0) {
        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            amountMinor: paidMinor,
            currency: order.currency,
            method: 'BANK_TRANSFER',
            reference: `SEED-${order.code}`,
          },
        });
      }
      console.log(`  ${order.code}  invoice ${invoice.status} ${paidMinor}/${totalMinor}`);
    });

    // ---- subscription: the RECURRING half ---------------------------------
    const recurring = order.lines.filter((line) => line.lineType === 'RECURRING');
    await prisma.$transaction(async (tx) => {
      for (const subscription of await tx.subscription.findMany({ where: { orderId: order.id } })) {
        await tx.billingSchedule.deleteMany({ where: { subscriptionId: subscription.id } });
        await tx.subscription.delete({ where: { id: subscription.id } });
      }
      if (recurring.length === 0) return;

      const amountMinor = recurring.reduce((sum, line) => sum + line.lineTotalMinor, 0);
      const now = Date.now();
      await tx.subscription.create({
        data: {
          orderId: order.id,
          status: 'ACTIVE',
          amountMinor,
          currency: order.currency,
          cadenceMonths: 1,
          schedules: {
            create: [0, 1, 2].map((month) => ({
              dueAt: new Date(now + month * MONTH_MS),
              amountMinor,
              currency: order.currency,
            })),
          },
        },
      });
      console.log(`  ${order.code}  subscription ACTIVE ${amountMinor}/month, 3 scheduled`);
    });
  }
}
