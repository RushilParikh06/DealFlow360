"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeLineTotals = computeLineTotals;
exports.computeQuotationTotals = computeQuotationTotals;
// B1 owned. Pure arithmetic: subtotal/discount/lineTotal from unit price, qty
// and the line's own discountBps. Tax is not computed here - B3 owns tax
// rules and nothing wires that seam yet, so taxMinor stays 0 until it does.
const contracts_1 = require("@dealflow/contracts");
function computeLineTotals(line) {
    const subtotalMinor = line.unitPriceMinor * line.qty;
    const discountMinor = (0, contracts_1.applyBps)(subtotalMinor, line.discountBps);
    return { subtotalMinor, discountMinor, lineTotalMinor: subtotalMinor - discountMinor };
}
function computeQuotationTotals(lines) {
    const perLine = lines.map(computeLineTotals);
    const subtotalMinor = perLine.reduce((s, l) => s + l.subtotalMinor, 0);
    const discountMinor = perLine.reduce((s, l) => s + l.discountMinor, 0);
    const taxMinor = 0; // TODO(B3 seam): wire tax-rule resolution once available
    return { subtotalMinor, discountMinor, taxMinor, totalMinor: subtotalMinor - discountMinor + taxMinor };
}
//# sourceMappingURL=totals.service.js.map