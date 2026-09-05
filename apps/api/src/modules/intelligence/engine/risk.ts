// B2 OWNED. The blended discount risk score. This is the signature mechanic of
// the whole product, so it is the file a reviewer should be able to read in one
// sitting.
//
// Every number in here is an integer. Money is minor units, percentages are
// basis points, and the score is 0-100 whole points (plan.md invariant 1).

import { asBps, clamp, roundHalfUp, sum } from '@dealflow/contracts';
import type { RiskFactor, RiskLevel } from '@dealflow/contracts';
import { DEFAULT_RISK_MODEL, type RiskModel } from './risk-model';
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

export function computeMarginBps(lines: EngineLine[]): { netMinor: number; marginBps: number } {
  const netMinor = sum(lines.map((l) => l.lineTotalMinor));
  const costMinor = sum(lines.map((l) => l.costMinor * l.qty));
  return { netMinor, marginBps: asBps(netMinor - costMinor, netMinor) };
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
export function computeBlend(lines: EngineLine[], ceilings: LineCeiling[]): RiskBlend {
  const { netMinor, marginBps } = computeMarginBps(lines);

  const weightedNumerator = sum(ceilings.map((c) => c.overBps * c.lineTotalMinor));
  const weightedExcessBps = netMinor === 0 ? 0 : roundHalfUp(weightedNumerator / netMinor);

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

const pointsFor = (value: number, fullScale: number, maxPoints: number): number =>
  fullScale <= 0 ? 0 : clamp(roundHalfUp((value * maxPoints) / fullScale), 0, maxPoints);

function marginPoints(marginBps: number, model: RiskModel): number {
  const { healthyMarginBps, criticalMarginBps, marginMaxPoints } = model;
  if (marginBps >= healthyMarginBps) return 0;
  if (marginBps <= criticalMarginBps) return marginMaxPoints;
  const span = healthyMarginBps - criticalMarginBps;
  return clamp(
    roundHalfUp((marginMaxPoints * (healthyMarginBps - marginBps)) / span),
    0,
    marginMaxPoints,
  );
}

/** Four named contributors. They are returned, not just summed, because screen 6
 *  has to answer "why was this flagged" line by line with points over. */
export function computeFactors(blend: RiskBlend, model: RiskModel = DEFAULT_RISK_MODEL): RiskFactor[] {
  const blended = pointsFor(blend.weightedExcessBps, model.blendedFullScaleBps, model.blendedMaxPoints);
  const hard = pointsFor(blend.worstLineExcessBps, model.hardFullScaleBps, model.hardMaxPoints);
  const margin = marginPoints(blend.marginBps, model);
  const spread =
    blend.lineCount === 0
      ? 0
      : clamp(
          roundHalfUp((model.spreadMaxPoints * blend.violatingLineCount) / blend.lineCount),
          0,
          model.spreadMaxPoints,
        );

  const pct = (bps: number) => (bps / 100).toFixed(2);

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

export function scoreFromFactors(factors: RiskFactor[]): number {
  return clamp(sum(factors.map((f) => f.points)), 0, 100);
}

export function levelFromScore(score: number, model: RiskModel = DEFAULT_RISK_MODEL): RiskLevel {
  if (score >= model.bandHigh) return 'HIGH';
  if (score >= model.bandMedium) return 'MEDIUM';
  return 'LOW';
}
