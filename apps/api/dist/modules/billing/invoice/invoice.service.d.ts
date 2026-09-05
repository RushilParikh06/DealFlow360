import { type Money } from '../../operations/types';
import type { FulfillmentStatus } from '../fulfillment/fulfillment-state.service';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID' | 'OVERDUE';
/** The only function allowed to move an invoice between states. */
export declare function transitionInvoice(from: InvoiceStatus, to: InvoiceStatus): InvoiceStatus;
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
export declare function buildOneTimeInvoiceLines(lines: OrderLine[], fulfillmentByLineId: Map<string, FulfillmentStatus>): InvoiceLine[];
