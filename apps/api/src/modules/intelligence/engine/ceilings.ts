// B2 OWNED. Per-line ceiling resolution. plan.md invariant 3.
//
// The whole reason this is per line and not per order: a tier-level check alone
// passes a quote with a services line eight points over, and passes an order
// with five lines each two points over. Both of those are exactly the quotes a
// sales organisation loses money on.

import { AppError } from '../../shared/app-error';
import { ErrorCode } from '@dealflow/contracts';
import type { EngineLine, EnginePolicy, LineCeiling } from './types';

/**
 * A category-specific row for the tier wins. Otherwise the tier default row
 * (categoryId null). The seed writes the category rows as
 * min(tierCeiling, categoryCeiling), so the stricter of the two is already
 * baked into the row and resolution stays a single lookup.
 */
export function resolvePolicyForLine(
  policies: EnginePolicy[],
  categoryId: string | null,
): EnginePolicy {
  if (categoryId !== null) {
    const specific = policies.find((p) => p.categoryId === categoryId);
    if (specific) return specific;
  }
  const tierDefault = policies.find((p) => p.categoryId === null);
  if (tierDefault) return tierDefault;

  throw new AppError(
    ErrorCode.POLICY_NOT_CONFIGURED,
    'No discount policy is configured for this tier.',
    { categoryId, policiesSeen: policies.length },
  );
}

/** Every line gets a row, violating or not, so the builder screen can badge all of them. */
export function resolveLineCeilings(
  lines: EngineLine[],
  policies: EnginePolicy[],
): LineCeiling[] {
  return lines.map((line) => {
    const policy = resolvePolicyForLine(policies, line.categoryId);
    const allowedDiscountBps = policy.maxDiscountBps;
    const overBps = Math.max(0, line.discountBps - allowedDiscountBps);

    return {
      quoteLineId: line.quoteLineId,
      productId: line.productId,
      categoryId: line.categoryId,
      categoryName: line.categoryName,
      policyId: policy.id,
      allowedDiscountBps,
      actualDiscountBps: line.discountBps,
      overBps,
      lineTotalMinor: line.lineTotalMinor,
    };
  });
}

/**
 * The strictest thresholds among the policies the lines actually touched.
 * A quote whose lines span Services and Hardware is governed by whichever of
 * the two escalates soonest - the tight policy is not diluted by the loose one.
 */
export function governingThresholds(
  ceilings: LineCeiling[],
  policies: EnginePolicy[],
): { requiresManagerAboveBps: number; requiresFinanceAboveBps: number } {
  const touchedIds = new Set(ceilings.map((c) => c.policyId));
  const touched = policies.filter((p) => touchedIds.has(p.id));
  const pool = touched.length > 0 ? touched : policies;

  if (pool.length === 0) {
    throw new AppError(
      ErrorCode.POLICY_NOT_CONFIGURED,
      'No discount policy is configured for this tier.',
    );
  }

  return {
    requiresManagerAboveBps: Math.min(...pool.map((p) => p.requiresManagerAboveBps)),
    requiresFinanceAboveBps: Math.min(...pool.map((p) => p.requiresFinanceAboveBps)),
  };
}
