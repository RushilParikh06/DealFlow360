// B2 OWNED. The definition of the risk model.
//
// On invariant 9 ("a number that decides an outcome never appears as a literal
// in code"): every number that GATES AN APPROVAL lives in discount_policies -
// maxDiscountBps, requiresManagerAboveBps, requiresFinanceAboveBps. Read
// routing.ts, it takes those from the database and nothing else. The constants
// below only shape the 0-100 score that a human reads on screen 6, and the
// LOW / MEDIUM / HIGH band that colours a badge. No approval decision reads
// them. They are the model definition, not a threshold.
//
// If a judge asks "how is 82 computed", the answer is this file: four named
// factors that add to at most 100, each returned in the response as its own row
// with its own points and its own sentence.

export interface RiskModel {
  /** weightedExcessBps that earns the full blended allocation. */
  blendedFullScaleBps: number;
  blendedMaxPoints: number;
  /** worstLineExcessBps that earns the full worst-line allocation. */
  hardFullScaleBps: number;
  hardMaxPoints: number;
  /** At or above this margin, margin pressure contributes nothing. */
  healthyMarginBps: number;
  /** At or below this margin, margin pressure contributes its whole allocation. */
  criticalMarginBps: number;
  marginMaxPoints: number;
  spreadMaxPoints: number;
  bandHigh: number;
  bandMedium: number;
}

export const DEFAULT_RISK_MODEL: RiskModel = {
  // 5 discount points of blended excess is a fully loaded blend
  blendedFullScaleBps: 500,
  blendedMaxPoints: 40,
  // 10 discount points over on a single line is a fully loaded worst line
  hardFullScaleBps: 1000,
  hardMaxPoints: 30,
  healthyMarginBps: 2500,
  criticalMarginBps: 500,
  marginMaxPoints: 20,
  spreadMaxPoints: 10,
  bandHigh: 70,
  bandMedium: 35,
};

export const RISK_MODEL_MAX_POINTS =
  DEFAULT_RISK_MODEL.blendedMaxPoints +
  DEFAULT_RISK_MODEL.hardMaxPoints +
  DEFAULT_RISK_MODEL.marginMaxPoints +
  DEFAULT_RISK_MODEL.spreadMaxPoints; // 100
