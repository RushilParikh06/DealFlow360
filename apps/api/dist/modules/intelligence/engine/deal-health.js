"use strict";
// B2 OWNED. Deal health and anomaly detection.
//
// Four conditions, all deterministic, all derived from data already on the quote.
// Every finding carries a dedupeKey so the sweep can run every five minutes
// without piling up duplicate rows for a condition that is simply still true.
// The unique index on (quotationId, type, dedupeKey) turns "detect" into an
// upsert and the whole thing becomes idempotent for free.
Object.defineProperty(exports, "__esModule", { value: true });
exports.marginBpsOf = exports.OPEN_FOR_STALL = exports.DEFAULT_HEALTH_THRESHOLDS = void 0;
exports.weightedDiscountBps = weightedDiscountBps;
exports.detectDealHealth = detectDealHealth;
const contracts_1 = require("@dealflow/contracts");
exports.DEFAULT_HEALTH_THRESHOLDS = {
    stalledAfterDays: 7,
    stalledCriticalAfterDays: 14,
    anomalyDeltaBps: 500,
    lowMarginBps: 1500,
    criticalMarginBps: 800,
    slippageWarnDays: 3,
};
/** A quote in one of these is live and can go stale. CONFIRMED onward cannot. */
exports.OPEN_FOR_STALL = new Set([
    'DRAFT',
    'SUBMITTED',
    'PENDING_MANAGER',
    'PENDING_FINANCE',
    'RETURNED',
    'NEGOTIATING',
]);
const DAY_MS = 86_400_000;
const daysBetween = (from, to) => Math.floor((to.getTime() - from.getTime()) / DAY_MS);
/** Order-level discount, weighted by line value - the same weighting the risk
 *  engine uses, so the two numbers on screen are comparable. */
function weightedDiscountBps(lines) {
    const net = (0, contracts_1.sum)(lines.map((l) => l.lineTotalMinor));
    if (net === 0)
        return 0;
    return (0, contracts_1.roundHalfUp)((0, contracts_1.sum)(lines.map((l) => l.discountBps * l.lineTotalMinor)) / net);
}
function detectDealHealth(input, now, t = exports.DEFAULT_HEALTH_THRESHOLDS) {
    const findings = [];
    // 1. stalled
    if (exports.OPEN_FOR_STALL.has(input.status)) {
        const idleDays = daysBetween(input.lastActivityAt, now);
        if (idleDays >= t.stalledAfterDays) {
            const severity = idleDays >= t.stalledCriticalAfterDays ? 'CRITICAL' : 'WARN';
            findings.push({
                quotationId: input.quotationId,
                type: 'STALLED',
                severity,
                dedupeKey: `STALLED:${severity}`,
                message: `No activity for ${idleDays} days while sitting in ${input.status}.`,
                metadata: { idleDays, status: input.status, thresholdDays: t.stalledAfterDays },
            });
        }
    }
    // 2. discount anomaly, against the rep's own history rather than a global number
    if (input.repAverageDiscountBps !== null) {
        const orderDiscountBps = weightedDiscountBps(input.lines);
        const deltaBps = orderDiscountBps - input.repAverageDiscountBps;
        if (deltaBps > t.anomalyDeltaBps) {
            const severity = deltaBps > t.anomalyDeltaBps * 2 ? 'CRITICAL' : 'WARN';
            findings.push({
                quotationId: input.quotationId,
                type: 'DISCOUNT_ANOMALY',
                severity,
                dedupeKey: `DISCOUNT_ANOMALY:${severity}`,
                message: `Discount of ${(orderDiscountBps / 100).toFixed(2)} percent is ${(deltaBps / 100).toFixed(2)} points above this rep's own average.`,
                metadata: { orderDiscountBps, repAverageDiscountBps: input.repAverageDiscountBps, deltaBps },
            });
        }
    }
    // 3. delivery slippage
    if (input.promisedDeliveryDate && input.projectedDeliveryDate) {
        const slipDays = daysBetween(input.promisedDeliveryDate, input.projectedDeliveryDate);
        if (slipDays > 0) {
            const severity = slipDays >= t.slippageWarnDays ? 'CRITICAL' : 'WARN';
            findings.push({
                quotationId: input.quotationId,
                type: 'DELIVERY_SLIPPAGE',
                severity,
                dedupeKey: `DELIVERY_SLIPPAGE:${severity}`,
                message: `Projected delivery is ${slipDays} days later than the date promised to the customer.`,
                metadata: {
                    slipDays,
                    promised: input.promisedDeliveryDate.toISOString(),
                    projected: input.projectedDeliveryDate.toISOString(),
                },
            });
        }
    }
    // 4. low margin
    if (input.marginBps < t.lowMarginBps) {
        const severity = input.marginBps < t.criticalMarginBps ? 'CRITICAL' : 'WARN';
        findings.push({
            quotationId: input.quotationId,
            type: 'LOW_MARGIN',
            severity,
            dedupeKey: `LOW_MARGIN:${severity}`,
            message: `Order margin of ${(input.marginBps / 100).toFixed(2)} percent is below the ${(t.lowMarginBps / 100).toFixed(2)} percent floor.`,
            metadata: { marginBps: input.marginBps, floorBps: t.lowMarginBps },
        });
    }
    return findings;
}
/** Exported so the deal-health screen can show the same figure the engine judged on. */
const marginBpsOf = (netMinor, costMinor) => (0, contracts_1.asBps)(netMinor - costMinor, netMinor);
exports.marginBpsOf = marginBpsOf;
//# sourceMappingURL=deal-health.js.map