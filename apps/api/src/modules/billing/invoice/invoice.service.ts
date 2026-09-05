import { AppError, type Money } from '../../operations/types.ts';
import type { FulfillmentStatus } from '../fulfillment/fulfillment-state.service.ts';

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID' | 'OVERDUE';

const TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ['ISSUED', 'VOID'],
  ISSUED: ['PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'],
  PARTIALLY_PAID: ['PAID', 'OVERDUE'],
  PAID: [],
  OVERDUE: ['PARTIALLY_PAID', 'PAID'],
  VOID: [],
};

/** The only function allowed to move an invoice between states. */
export function transitionInvoice(from: InvoiceStatus, to: InvoiceStatus): InvoiceStatus {
  if (!TRANSITIONS[from].includes(to)) {
    throw new AppError('QUOTE_INVALID_STATE', `cannot move invoice from ${from} to ${to}`, { from, to });
  }
  return to;
}

export interface OrderLine {
  id: string;
  lineType: 'ONE_TIME' | 'RECURRING';
  lineTotalMinor: number;
  currency: string;
}

export interface InvoiceLine {
  orderLineId: string;
  amount: Money;
}

/**
 * POST /orders/:id/invoices (plan.md section 8): splits one-time lines into an
 * invoice and leaves recurring lines for the subscription engine. Nothing not
 * yet shipped is billed - "nothing is invoiced before it ships" (README).
 */
export function buildOneTimeInvoiceLines(lines: OrderLine[], fulfillmentByLineId: Map<string, FulfillmentStatus>): InvoiceLine[] {
  const oneTime = lines.filter((l) => l.lineType === 'ONE_TIME');
  const unshipped = oneTime.find((l) => {
    const status = fulfillmentByLineId.get(l.id);
    return status !== 'SHIPPED' && status !== 'DELIVERED';
  });
  if (unshipped) {
    throw new AppError('INVOICE_BEFORE_SHIPMENT', `line ${unshipped.id} has not shipped yet`, { orderLineId: unshipped.id });
  }
  return oneTime.map((l) => ({ orderLineId: l.id, amount: { amountMinor: l.lineTotalMinor, currency: l.currency } }));
}
