"use strict";
// B2 OWNED. Stable hash of an evaluation input.
//
// POST /quotes/:id/evaluate is documented as idempotent and safe on every line
// change (plan.md section 8). F will call it on keystroke debounce from the
// builder screen, so it has to be cheap to call and it must not write a
// risk_evaluations row every time. Same inputs, same hash, re-use the last row.
// Different inputs, new row, and the history the negotiation flow needs is intact.
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashEvaluationInput = hashEvaluationInput;
const node_crypto_1 = require("node:crypto");
/** JSON.stringify with sorted keys, so key order can never change the hash. */
function stableStringify(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value) ?? 'null';
    if (Array.isArray(value))
        return `[${value.map(stableStringify).join(',')}]`;
    const entries = Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
}
function hashEvaluationInput(input) {
    const canonical = {
        quotationId: input.quotationId,
        currency: input.currency,
        tierId: input.tierId,
        lines: [...input.lines]
            .sort((a, b) => (a.quoteLineId < b.quoteLineId ? -1 : 1))
            .map((l) => ({
            id: l.quoteLineId,
            p: l.productId,
            c: l.categoryId,
            q: l.qty,
            u: l.unitPriceMinor,
            d: l.discountBps,
            t: l.lineTotalMinor,
            k: l.costMinor,
        })),
        // policies are part of the hash: editing a ceiling in the admin screen must
        // invalidate the cached evaluation, otherwise the demo shows a stale score
        policies: [...input.policies]
            .sort((a, b) => (a.id < b.id ? -1 : 1))
            .map((p) => ({
            id: p.id,
            c: p.categoryId,
            m: p.maxDiscountBps,
            mg: p.requiresManagerAboveBps,
            fn: p.requiresFinanceAboveBps,
        })),
    };
    return (0, node_crypto_1.createHash)('sha256').update(stableStringify(canonical)).digest('hex').slice(0, 32);
}
//# sourceMappingURL=hash.js.map