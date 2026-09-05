// B2 OWNED. Who has to sign off.
//
// This is the one function in the codebase where invariant 9 is load bearing:
// there is not a single numeric literal below. Both thresholds arrive from
// discount_policies rows. Change a policy row in the admin screen and the
// routing changes with no deploy, which is the demo moment for that screen.
//
// The governing excess is max(blended, worst line) on purpose. Either one alone
// leaves a hole: blended alone lets a single outrageous line hide inside a big
// order, worst-line alone lets five lines that are each two points over sail
// through untouched.

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

export function routeApprovals(
  weightedExcessBps: number,
  worstLineExcessBps: number,
  thresholds: RoutingThresholds,
): RoutingDecision {
  const governingExcessBps = Math.max(weightedExcessBps, worstLineExcessBps);
  const { requiresManagerAboveBps, requiresFinanceAboveBps } = thresholds;

  if (governingExcessBps > requiresFinanceAboveBps) {
    return {
      approvalRequired: true,
      requiredApprovals: ['SALES_MANAGER', 'FINANCE'],
      governingExcessBps,
      reason: `Governing excess of ${governingExcessBps} bps is above the finance threshold of ${requiresFinanceAboveBps} bps.`,
    };
  }

  if (governingExcessBps > requiresManagerAboveBps) {
    return {
      approvalRequired: true,
      requiredApprovals: ['SALES_MANAGER'],
      governingExcessBps,
      reason: `Governing excess of ${governingExcessBps} bps is above the manager threshold of ${requiresManagerAboveBps} bps.`,
    };
  }

  return {
    approvalRequired: false,
    requiredApprovals: [],
    governingExcessBps,
    reason: 'Every line is within its own category ceiling for this tier.',
  };
}
