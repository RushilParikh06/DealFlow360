"use strict";
// B2 OWNED. The blended discount risk score. This is the signature mechanic of
// the whole product, so it is the file a reviewer should be able to read in one
// sitting.
//
// Every number in here is an integer. Money is minor units, percentages are
// basis points, and the score is 0-100 whole points (plan.md invariant 1).
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeMarginBps = computeMarginBps;
exports.computeBlend = computeBlend;
exports.computeFactors = computeFactors;
exports.scoreFromFactors = scoreFromFactors;
exports.levelFromScore = levelFromScore;
const contracts_1 = require("@dealflow/contracts");
const risk_model_1 = require("./risk-model");
function computeMarginBps(lines) {
    const netMinor = (0, contracts_1.sum)(lines.map((l) => l.lineTotalMinor));
    const costMinor = (0, contracts_1.sum)(lines.map((l) => l.costMinor * l.qty));
    return { netMinor, marginBps: (0, contracts_1.asBps)(netMinor - costMinor, netMinor) };
}
/**
 * Blend the per-line excesses into one number.
 *
 * weightedExcessBps = sum(excess_i * lineTotal_i) / sum(lineTotal_i)
 *
 * Weighting by line value is the point. A 40 percent overage on a 500 rupee
 * accessory should not sink an order, and a 2 percent overage on the 4 lakh
 * hardware line should not hide behind four clean small lines. The division
 * happens once, at the end, so no intermediate rounding drifts.
 */
function computeBlend(lines, ceilings) {
    const { netMinor, marginBps } = computeMarginBps(lines);
    const weightedNumerator = (0, contracts_1.sum)(ceilings.map((c) => c.overBps * c.lineTotalMinor));
    const weightedExcessBps = netMinor === 0 ? 0 : (0, contracts_1.roundHalfUp)(weightedNumerator / netMinor);
    const worstLineExcessBps = ceilings.length === 0 ? 0 : Math.max(...ceilings.map((c) => c.overBps));
    return {
        weightedExcessBps,
        worstLineExcessBps,
        marginBps,
        netMinor,
        violatingLineCount: ceilings.filter((c) => c.overBps > 0).length,
        lineCount: ceilings.length,
    };
}
const pointsFor = (value, fullScale, maxPoints) => fullScale <= 0 ? 0 : (0, contracts_1.clamp)((0, contracts_1.roundHalfUp)((value * maxPoints) / fullScale), 0, maxPoints);
function marginPoints(marginBps, model) {
    const { healthyMarginBps, criticalMarginBps, marginMaxPoints } = model;
    if (marginBps >= healthyMarginBps)
        return 0;
    if (marginBps <= criticalMarginBps)
        return marginMaxPoints;
    const span = healthyMarginBps - criticalMarginBps;
    return (0, contracts_1.clamp)((0, contracts_1.roundHalfUp)((marginMaxPoints * (healthyMarginBps - marginBps)) / span), 0, marginMaxPoints);
}
/** Four named contributors. They are returned, not just summed, because screen 6
 *  has to answer "why was this flagged" line by line with points over. */
function computeFactors(blend, model = risk_model_1.DEFAULT_RISK_MODEL) {
    const blended = pointsFor(blend.weightedExcessBps, model.blendedFullScaleBps, model.blendedMaxPoints);
    const hard = pointsFor(blend.worstLineExcessBps, model.hardFullScaleBps, model.hardMaxPoints);
    const margin = marginPoints(blend.marginBps, model);
    const spread = blend.lineCount === 0
        ? 0
        : (0, contracts_1.clamp)((0, contracts_1.roundHalfUp)((model.spreadMaxPoints * blend.violatingLineCount) / blend.lineCount), 0, model.spreadMaxPoints);
    const pct = (bps) => (bps / 100).toFixed(2);
    return [
        {
            key: 'BLENDED_EXCESS',
            label: 'Blended discount excess',
            points: blended,
            maxPoints: model.blendedMaxPoints,
            detail: `${pct(blend.weightedExcessBps)} points over ceiling, weighted by each line's share of order value.`,
        },
        {
            key: 'WORST_LINE_EXCESS',
            label: 'Worst single line',
            points: hard,
            maxPoints: model.hardMaxPoints,
            detail: `The worst line sits ${pct(blend.worstLineExcessBps)} points over its own category ceiling.`,
        },
        {
            key: 'MARGIN_PRESSURE',
            label: 'Margin pressure',
            points: margin,
            maxPoints: model.marginMaxPoints,
            detail: `Order margin is ${pct(blend.marginBps)} percent against a healthy floor of ${pct(model.healthyMarginBps)} percent.`,
        },
        {
            key: 'VIOLATION_SPREAD',
            label: 'Spread of violations',
            points: spread,
            maxPoints: model.spreadMaxPoints,
            detail: `${blend.violatingLineCount} of ${blend.lineCount} lines are over their ceiling.`,
        },
    ];
}
function scoreFromFactors(factors) {
    return (0, contracts_1.clamp)((0, contracts_1.sum)(factors.map((f) => f.points)), 0, 100);
}
function levelFromScore(score, model = risk_model_1.DEFAULT_RISK_MODEL) {
    if (score >= model.bandHigh)
        return 'HIGH';
    if (score >= model.bandMedium)
        return 'MEDIUM';
    return 'LOW';
}
//# sourceMappingURL=risk.js.map