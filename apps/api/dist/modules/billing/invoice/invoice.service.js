"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transitionInvoice = transitionInvoice;
exports.buildOneTimeInvoiceLines = buildOneTimeInvoiceLines;
const types_1 = require("../../operations/types");
const TRANSITIONS = {
    DRAFT: ['ISSUED', 'VOID'],
    ISSUED: ['PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'],
    PARTIALLY_PAID: ['PAID', 'OVERDUE'],
    PAID: [],
    OVERDUE: ['PARTIALLY_PAID', 'PAID'],
    VOID: [],
};
/** The only function allowed to move an invoice between states. */
function transitionInvoice(from, to) {
    if (!TRANSITIONS[from].includes(to)) {
        throw new types_1.AppError('QUOTE_INVALID_STATE', `cannot move invoice from ${from} to ${to}`, { from, to });
    }
    return to;
}
/**
 * POST /orders/:id/invoices (plan.md section 8): splits one-time lines into an
 * invoice and leaves recurring lines for the subscription engine. Nothing not
 * yet shipped is billed - "nothing is invoiced before it ships" (README).
 */
function buildOneTimeInvoiceLines(lines, fulfillmentByLineId) {
    const oneTime = lines.filter((l) => l.lineType === 'ONE_TIME');
    const unshipped = oneTime.find((l) => {
        const status = fulfillmentByLineId.get(l.id);
        return status !== 'SHIPPED' && status !== 'DELIVERED';
    });
    if (unshipped) {
        throw new types_1.AppError('INVOICE_BEFORE_SHIPMENT', `line ${unshipped.id} has not shipped yet`, { orderLineId: unshipped.id });
    }
    return oneTime.map((l) => ({ orderLineId: l.id, amount: { amountMinor: l.lineTotalMinor, currency: l.currency } }));
}
//# sourceMappingURL=invoice.service.js.map