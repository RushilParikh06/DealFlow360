"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyPayment = applyPayment;
const types_1 = require("../../operations/types");
/**
 * POST /invoices/:id/payments (plan.md section 8). Payments are simulated, no
 * real gateway (README limitations), but the resulting invoice status is real:
 * derived from paid-so-far vs. the invoice total, never set directly by the caller.
 */
function applyPayment(invoiceTotalMinor, paidSoFarMinor, amountMinor) {
    if (amountMinor <= 0) {
        throw new types_1.AppError('VALIDATION_FAILED', 'payment amount must be positive', { amountMinor });
    }
    const newPaidMinor = paidSoFarMinor + amountMinor;
    if (newPaidMinor > invoiceTotalMinor) {
        throw new types_1.AppError('VALIDATION_FAILED', 'payment exceeds the outstanding invoice balance', {
            invoiceTotalMinor,
            paidSoFarMinor,
            amountMinor,
        });
    }
    return { newPaidMinor, status: newPaidMinor === invoiceTotalMinor ? 'PAID' : 'PARTIALLY_PAID' };
}
//# sourceMappingURL=payment.service.js.map