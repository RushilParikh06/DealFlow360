import type { ApproverRole } from '@dealflow/contracts';
export interface RoutingThresholds {
    requiresManagerAboveBps: number;
    requiresFinanceAboveBps: number;
}
export interface RoutingDecision {
    approvalRequired: boolean;
    requiredApprovals: ApproverRole[];
    governingExcessBps: number;
    reason: string;
}
export declare function routeApprovals(weightedExcessBps: number, worstLineExcessBps: number, thresholds: RoutingThresholds): RoutingDecision;
