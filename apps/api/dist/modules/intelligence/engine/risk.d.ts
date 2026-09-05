import type { RiskFactor, RiskLevel } from '@dealflow/contracts';
import { type RiskModel } from './risk-model';
import type { EngineLine, LineCeiling } from './types';
export interface RiskBlend {
    /** Each line's excess weighted by that line's share of order net. */
    weightedExcessBps: number;
    /** The single worst line. A quote is only as defensible as its worst line. */
    worstLineExcessBps: number;
    marginBps: number;
    netMinor: number;
    violatingLineCount: number;
    lineCount: number;
}
export declare function computeMarginBps(lines: EngineLine[]): {
    netMinor: number;
    marginBps: number;
};
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
export declare function computeBlend(lines: EngineLine[], ceilings: LineCeiling[]): RiskBlend;
/** Four named contributors. They are returned, not just summed, because screen 6
 *  has to answer "why was this flagged" line by line with points over. */
export declare function computeFactors(blend: RiskBlend, model?: RiskModel): RiskFactor[];
export declare function scoreFromFactors(factors: RiskFactor[]): number;
export declare function levelFromScore(score: number, model?: RiskModel): RiskLevel;
