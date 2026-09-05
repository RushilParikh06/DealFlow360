import type { InvoiceStatus } from '../invoice/invoice.service';
/**
 * POST /invoices/:id/payments (plan.md section 8). Payments are simulated, no
 * real gateway (README limitations), but the resulting invoice status is real:
 * derived from paid-so-far vs. the invoice total, never set directly by the caller.
 */
export declare function applyPayment(invoiceTotalMinor: number, paidSoFarMinor: number, amountMinor: number): {
    newPaidMinor: number;
    status: InvoiceStatus;
};
