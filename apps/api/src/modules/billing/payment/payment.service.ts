import { AppError } from '../../operations/types';
import type { InvoiceStatus } from '../invoice/invoice.service';

/**
 * POST /invoices/:id/payments (plan.md section 8). Payments are simulated, no
 * real gateway (README limitations), but the resulting invoice status is real:
 * derived from paid-so-far vs. the invoice total, never set directly by the caller.
 */
export function applyPayment(
  invoiceTotalMinor: number,
  paidSoFarMinor: number,
  amountMinor: number,
): { newPaidMinor: number; status: InvoiceStatus } {
  if (amountMinor <= 0) {
    throw new AppError('VALIDATION_FAILED', 'payment amount must be positive', { amountMinor });
  }
  const newPaidMinor = paidSoFarMinor + amountMinor;
  if (newPaidMinor > invoiceTotalMinor) {
    throw new AppError('VALIDATION_FAILED', 'payment exceeds the outstanding invoice balance', {
      invoiceTotalMinor,
      paidSoFarMinor,
      amountMinor,
    });
  }
  return { newPaidMinor, status: newPaidMinor === invoiceTotalMinor ? 'PAID' : 'PARTIALLY_PAID' };
}
