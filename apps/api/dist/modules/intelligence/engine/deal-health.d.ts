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
export declare const DEFAULT_HEALTH_THRESHOLDS: DealHealthThresholds;
/** A quote in one of these is live and can go stale. CONFIRMED onward cannot. */
export declare const OPEN_FOR_STALL: Set<string>;
export interface DealHealthInput {
    quotationId: string;
    status: string;
    lastActivityAt: Date;
    marginBps: number;
    lines: Array<{
        discountBps: number;
        lineTotalMinor: number;
    }>;
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
/** Order-level discount, weighted by line value - the same weighting the risk
 *  engine uses, so the two numbers on screen are comparable. */
export declare function weightedDiscountBps(lines: DealHealthInput['lines']): number;
export declare function detectDealHealth(input: DealHealthInput, now: Date, t?: DealHealthThresholds): DealHealthFinding[];
/** Exported so the deal-health screen can show the same figure the engine judged on. */
export declare const marginBpsOf: (netMinor: number, costMinor: number) => number;
