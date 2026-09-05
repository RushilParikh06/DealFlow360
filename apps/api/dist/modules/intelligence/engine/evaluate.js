"use strict";
// B2 OWNED. The composition root of the engine. Still pure - no Prisma, no Nest.
//
// Read this function to understand the entire governance mechanic:
//   resolve each line's own ceiling
//     -> blend the excesses, weighted by line value
//       -> score it out of 100 across four named factors
//         -> route it using thresholds that live in the database
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateQuotation = evaluateQuotation;
const ceilings_1 = require("./ceilings");
const risk_model_1 = require("./risk-model");
const risk_1 = require("./risk");
const routing_1 = require("./routing");
const hash_1 = require("./hash");
function evaluateQuotation(input, model = risk_model_1.DEFAULT_RISK_MODEL) {
    const ceilings = (0, ceilings_1.resolveLineCeilings)(input.lines, input.policies);
    const blend = (0, risk_1.computeBlend)(input.lines, ceilings);
    const factors = (0, risk_1.computeFactors)(blend, model);
    const riskScore = (0, risk_1.scoreFromFactors)(factors);
    const thresholds = (0, ceilings_1.governingThresholds)(ceilings, input.policies);
    const routing = (0, routing_1.routeApprovals)(blend.weightedExcessBps, blend.worstLineExcessBps, thresholds);
    const violations = ceilings
        .filter((c) => c.overBps > 0)
        .sort((a, b) => b.overBps - a.overBps || (a.quoteLineId < b.quoteLineId ? -1 : 1))
        .map((c) => ({
        quoteLineId: c.quoteLineId,
        productId: c.productId,
        categoryName: c.categoryName,
        allowedBps: c.allowedDiscountBps,
        actualBps: c.actualDiscountBps,
        excessBps: c.overBps,
        lineTotal: { amountMinor: c.lineTotalMinor, currency: input.currency },
    }));
    return {
        inputHash: (0, hash_1.hashEvaluationInput)(input),
        riskScore,
        riskLevel: (0, risk_1.levelFromScore)(riskScore, model),
        approvalRequired: routing.approvalRequired,
        requiredApprovals: routing.requiredApprovals,
        violations,
        ceilings,
        blend,
        factors,
        routing,
        currency: input.currency,
    };
}
//# sourceMappingURL=evaluate.js.map