"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findTaxRule = findTaxRule;
exports.calculateLineTax = calculateLineTax;
const types_1 = require("../types");
/** Finds the rule for a category, or the null-categoryId default rule. */
function findTaxRule(rules, categoryId) {
    return rules.find((r) => r.categoryId === categoryId) ?? rules.find((r) => r.categoryId === null);
}
/** Tax on one line total. No rule for the category means zero tax, not an error. */
function calculateLineTax(lineTotal, rules, categoryId) {
    const rule = findTaxRule(rules, categoryId);
    return { amountMinor: rule ? (0, types_1.applyBps)(lineTotal.amountMinor, rule.rateBps) : 0, currency: lineTotal.currency };
}
//# sourceMappingURL=tax.service.js.map