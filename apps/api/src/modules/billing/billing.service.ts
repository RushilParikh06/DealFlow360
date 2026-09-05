// B3 owned. Persistence around the billing engines. The engines
// (fulfillment/, invoice/, payment/, subscription/) stay pure functions; this
// file is the only one in the module that touches Prisma.
//
// Two rules the engines enforce and this file must not work around:
//   - nothing is invoiced before it ships (INVOICE_BEFORE_SHIPMENT)
//   - an invoice's status is derived from paid-so-far vs. total, never set by
//     the caller
// And one this file enforces itself: every transition writes its audit row in
// the SAME transaction as the change (plan.md invariant 6).
import { Injectable } from '@nestjs/common';
import { ErrorCode, type Paginated } from '@dealflow/contracts';
import { AppError } from '../shared/app-error';
import { PrismaService } from '../shared/prisma.service';
import type { AuthUser } from '../shared/current-user';
import { AuditService } from '../intelligence/services/audit.service';
import { transitionFulfillment, type FulfillmentStatus } from './fulfillment/fulfillment-state.service';
import { buildOneTimeInvoiceLines, transitionInvoice, type InvoiceStatus } from './invoice/invoice.service';
import { applyPayment } from './payment/payment.service';
import { nextBillingDate, transitionSubscription, type SubscriptionStatus } from './subscription/subscription.service';

/** Cadence for a RECURRING line until plan.md gives products their own term. */
const DEFAULT_CADENCE_MONTHS = 1;

function paginate(query: { page?: number; pageSize?: number }): { page: number; pageSize: number; skip: number; take: number } {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- fulfilment

  async listFulfillments(query: { orderId?: string; status?: string; page?: number; pageSize?: number }): Promise<
    Paginated<unknown>
  > {
    const { page, pageSize, skip, take } = paginate(query);
    const where = {
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.fulfillment.findMany({ where, skip, take, orderBy: { updatedAt: 'desc' } }),
      this.prisma.fulfillment.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** The only writer of fulfillments.status. */
  async advanceFulfillment(id: string, to: FulfillmentStatus, actor: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.fulfillment.findUnique({ where: { id } });
      if (!current) throw new AppError(ErrorCode.NOT_FOUND, 'Fulfillment not found.', { id });

      const status = transitionFulfillment(current.status as FulfillmentStatus, to);
      const updated = await tx.fulfillment.update({ where: { id }, data: { status } });

      await this.audit.record(tx, {
        entityType: 'FULFILLMENT',
        entityId: id,
        action: 'FULFILLMENT_TRANSITION',
        actorUserId: actor.id,
        actorRole: actor.role,
        fromValue: current.status,
        toValue: status,
      });
      return updated;
    });
  }

  // ------------------------------------------------------------------ invoices

  async listInvoices(query: { orderId?: string; status?: string; page?: number; pageSize?: number }): Promise<
    Paginated<unknown>
  > {
    const { page, pageSize, skip, take } = paginate(query);
    const where = {
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({ where, include: { _count: { select: { lines: true } } }, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.invoice.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async getInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: { lines: true, payments: true } });
    if (!invoice) throw new AppError(ErrorCode.NOT_FOUND, 'Invoice not found.', { id });
    return invoice;
  }

  /**
   * POST /orders/:id/invoices. Splits the order: ONE_TIME lines become one
   * invoice, RECURRING lines become a subscription. Called twice on the same
   * order it returns what already exists rather than double-billing.
   */
  async invoiceOrder(orderId: string, actor: AuthUser) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { lines: true } });
    if (!order) throw new AppError(ErrorCode.NOT_FOUND, 'Order not found.', { orderId });

    const existing = await this.prisma.invoice.findFirst({ where: { orderId } });
    if (existing) return this.getInvoice(existing.id);

    // Fulfillment is tracked per order, not per line, so every line inherits
    // the order's shipping state. The engine still refuses to bill anything
    // that has not reached SHIPPED.
    const fulfillment = await this.prisma.fulfillment.findFirst({ where: { orderId }, orderBy: { updatedAt: 'desc' } });
    const status = (fulfillment?.status ?? 'ORDER_CONFIRMED') as FulfillmentStatus;
    const byLine = new Map(order.lines.map((line) => [line.id, status]));

    const lines = buildOneTimeInvoiceLines(
      order.lines.map((line) => ({
        id: line.id,
        lineType: line.lineType as 'ONE_TIME' | 'RECURRING',
        lineTotalMinor: line.lineTotalMinor,
        currency: order.currency,
      })),
      byLine,
    );

    const recurring = order.lines.filter((line) => line.lineType === 'RECURRING');
    const totalMinor = lines.reduce((sum, line) => sum + line.amount.amountMinor, 0);

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          orderId,
          status: 'ISSUED' satisfies InvoiceStatus,
          totalMinor,
          currency: order.currency,
          lines: {
            create: lines.map((line) => ({
              orderLineId: line.orderLineId,
              amountMinor: line.amount.amountMinor,
              currency: line.amount.currency,
            })),
          },
        },
        include: { lines: true },
      });

      if (recurring.length > 0) {
        const amountMinor = recurring.reduce((sum, line) => sum + line.lineTotalMinor, 0);
        const subscription = await tx.subscription.create({
          data: {
            orderId,
            status: 'ACTIVE' satisfies SubscriptionStatus,
            amountMinor,
            currency: order.currency,
            cadenceMonths: DEFAULT_CADENCE_MONTHS,
            schedules: {
              create: {
                dueAt: nextBillingDate(new Date(), DEFAULT_CADENCE_MONTHS),
                amountMinor,
                currency: order.currency,
              },
            },
          },
        });
        await this.audit.record(tx, {
          entityType: 'SUBSCRIPTION',
          entityId: subscription.id,
          action: 'SUBSCRIPTION_CREATED',
          actorUserId: actor.id,
          actorRole: actor.role,
          toValue: 'ACTIVE',
          metadata: { orderId, amountMinor, cadenceMonths: DEFAULT_CADENCE_MONTHS },
        });
      }

      await this.audit.record(tx, {
        entityType: 'INVOICE',
        entityId: invoice.id,
        action: 'INVOICE_ISSUED',
        actorUserId: actor.id,
        actorRole: actor.role,
        toValue: 'ISSUED',
        metadata: { orderId, totalMinor, lineCount: lines.length },
      });

      return invoice;
    });
  }

  // ------------------------------------------------------------------ payments

  /**
   * Simulated settlement (README limitations), but the resulting invoice status
   * is real: applyPayment derives PARTIALLY_PAID or PAID from the running total
   * and rejects an overpayment.
   */
  async payInvoice(invoiceId: string, amountMinor: number, method: string, reference: string, actor: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new AppError(ErrorCode.NOT_FOUND, 'Invoice not found.', { invoiceId });

      const { newPaidMinor, status } = applyPayment(invoice.totalMinor, invoice.paidMinor, amountMinor);
      // Re-checked against the transition table so a VOID invoice cannot be paid.
      const nextStatus = transitionInvoice(invoice.status as InvoiceStatus, status);

      await tx.payment.create({
        data: { invoiceId, amountMinor, currency: invoice.currency, method, reference },
      });
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: { paidMinor: newPaidMinor, status: nextStatus },
      });

      await this.audit.record(tx, {
        entityType: 'INVOICE',
        entityId: invoiceId,
        action: 'PAYMENT_RECORDED',
        actorUserId: actor.id,
        actorRole: actor.role,
        fromValue: invoice.status,
        toValue: nextStatus,
        metadata: { amountMinor, method, reference, paidMinor: newPaidMinor },
      });
      return updated;
    });
  }

  // ------------------------------------------------------------- subscriptions

  async listSubscriptions(query: { orderId?: string; status?: string; page?: number; pageSize?: number }): Promise<
    Paginated<unknown>
  > {
    const { page, pageSize, skip, take } = paginate(query);
    const where = {
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        include: { schedules: { orderBy: { dueAt: 'asc' }, take: 1 } },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.subscription.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** The only writer of subscriptions.status. */
  async transitionSubscription(id: string, to: SubscriptionStatus, actor: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.subscription.findUnique({ where: { id } });
      if (!current) throw new AppError(ErrorCode.NOT_FOUND, 'Subscription not found.', { id });

      const status = transitionSubscription(current.status as SubscriptionStatus, to);
      const updated = await tx.subscription.update({ where: { id }, data: { status } });

      await this.audit.record(tx, {
        entityType: 'SUBSCRIPTION',
        entityId: id,
        action: 'SUBSCRIPTION_TRANSITION',
        actorUserId: actor.id,
        actorRole: actor.role,
        fromValue: current.status,
        toValue: status,
      });
      return updated;
    });
  }
}
