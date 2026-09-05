import type { ApproverRole, DiscountViolation, RiskFactor, RiskLevel } from '@dealflow/contracts';
import { type RiskModel } from './risk-model';
import { type RiskBlend } from './risk';
import { type RoutingDecision } from './routing';
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
export declare function evaluateQuotation(input: EvaluationInput, model?: RiskModel): EngineEvaluation;
