// B2 OWNED. The composition root of the engine. Still pure - no Prisma, no Nest.
//
// Read this function to understand the entire governance mechanic:
//   resolve each line's own ceiling
//     -> blend the excesses, weighted by line value
//       -> score it out of 100 across four named factors
//         -> route it using thresholds that live in the database

import type { ApproverRole, DiscountViolation, RiskFactor, RiskLevel } from '@dealflow/contracts';
import { governingThresholds, resolveLineCeilings } from './ceilings';
import { DEFAULT_RISK_MODEL, type RiskModel } from './risk-model';
import { computeBlend, computeFactors, levelFromScore, scoreFromFactors, type RiskBlend } from './risk';
import { routeApprovals, type RoutingDecision } from './routing';
import { hashEvaluationInput } from './hash';
import type { EvaluationInput, LineCeiling } from './types';

export interface EngineEvaluation {
  inputHash: string;
  riskScore: number;
  riskLevel: RiskLevel;
  approvalRequired: boolean;
  requiredApprovals: ApproverRole[];
  violations: DiscountViolation[];
  ceilings: LineCeiling[];
  blend: RiskBlend;
  factors: RiskFactor[];
  routing: RoutingDecision;
  currency: string;
}

export function evaluateQuotation(
  input: EvaluationInput,
  model: RiskModel = DEFAULT_RISK_MODEL,
): EngineEvaluation {
  const ceilings = resolveLineCeilings(input.lines, input.policies);
  const blend = computeBlend(input.lines, ceilings);
  const factors = computeFactors(blend, model);
  const riskScore = scoreFromFactors(factors);
  const thresholds = governingThresholds(ceilings, input.policies);
  const routing = routeApprovals(blend.weightedExcessBps, blend.worstLineExcessBps, thresholds);

  const violations: DiscountViolation[] = ceilings
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
    inputHash: hashEvaluationInput(input),
    riskScore,
    riskLevel: levelFromScore(riskScore, model),
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
