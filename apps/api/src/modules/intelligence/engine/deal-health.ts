// B2 OWNED. Deal health and anomaly detection.
//
// Four conditions, all deterministic, all derived from data already on the quote.
// Every finding carries a dedupeKey so the sweep can run every five minutes
// without piling up duplicate rows for a condition that is simply still true.
// The unique index on (quotationId, type, dedupeKey) turns "detect" into an
// upsert and the whole thing becomes idempotent for free.

import { asBps, roundHalfUp, sum } from '@dealflow/contracts';
import type { DealHealthSeverity, DealHealthType } from '@dealflow/contracts';

export interface DealHealthThresholds {
  stalledAfterDays: number;
  stalledCriticalAfterDays: number;
  /** How far above the rep's own historical average discount counts as anomalous. */
  anomalyDeltaBps: number;
  lowMarginBps: number;
  criticalMarginBps: number;
  slippageWarnDays: number;
}

export const DEFAULT_HEALTH_THRESHOLDS: DealHealthThresholds = {
  stalledAfterDays: 7,
  stalledCriticalAfterDays: 14,
  anomalyDeltaBps: 500,
  lowMarginBps: 1500,
  criticalMarginBps: 800,
  slippageWarnDays: 3,
};

/** A quote in one of these is live and can go stale. CONFIRMED onward cannot. */
export const OPEN_FOR_STALL = new Set([
  'DRAFT',
  'SUBMITTED',
  'PENDING_MANAGER',
  'PENDING_FINANCE',
  'RETURNED',
  'NEGOTIATING',
]);

export interface DealHealthInput {
  quotationId: string;
  status: string;
  lastActivityAt: Date;
  marginBps: number;
  lines: Array<{ discountBps: number; lineTotalMinor: number }>;
  /** The owning rep's mean discount across their own closed quotes, in bps. */
  repAverageDiscountBps: number | null;
  promisedDeliveryDate: Date | null;
  projectedDeliveryDate: Date | null;
}

export interface DealHealthFinding {
  quotationId: string;
  type: DealHealthType;
  severity: DealHealthSeverity;
  dedupeKey: string;
  message: string;
  metadata: Record<string, unknown>;
}

const DAY_MS = 86_400_000;
const daysBetween = (from: Date, to: Date): number => Math.floor((to.getTime() - from.getTime()) / DAY_MS);

/** Order-level discount, weighted by line value - the same weighting the risk
 *  engine uses, so the two numbers on screen are comparable. */
export function weightedDiscountBps(lines: DealHealthInput['lines']): number {
  const net = sum(lines.map((l) => l.lineTotalMinor));
  if (net === 0) return 0;
  return roundHalfUp(sum(lines.map((l) => l.discountBps * l.lineTotalMinor)) / net);
}

export function detectDealHealth(
  input: DealHealthInput,
  now: Date,
  t: DealHealthThresholds = DEFAULT_HEALTH_THRESHOLDS,
): DealHealthFinding[] {
  const findings: DealHealthFinding[] = [];

  // 1. stalled
  if (OPEN_FOR_STALL.has(input.status)) {
    const idleDays = daysBetween(input.lastActivityAt, now);
    if (idleDays >= t.stalledAfterDays) {
      const severity: DealHealthSeverity =
        idleDays >= t.stalledCriticalAfterDays ? 'CRITICAL' : 'WARN';
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
      const severity: DealHealthSeverity = deltaBps > t.anomalyDeltaBps * 2 ? 'CRITICAL' : 'WARN';
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
      const severity: DealHealthSeverity = slipDays >= t.slippageWarnDays ? 'CRITICAL' : 'WARN';
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
    const severity: DealHealthSeverity =
      input.marginBps < t.criticalMarginBps ? 'CRITICAL' : 'WARN';
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
export const marginBpsOf = (netMinor: number, costMinor: number): number =>
  asBps(netMinor - costMinor, netMinor);
