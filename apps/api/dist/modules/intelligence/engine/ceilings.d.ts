import type { EngineLine, EnginePolicy, LineCeiling } from './types';
/**
 * A category-specific row for the tier wins. Otherwise the tier default row
 * (categoryId null). The seed writes the category rows as
 * min(tierCeiling, categoryCeiling), so the stricter of the two is already
 * baked into the row and resolution stays a single lookup.
 */
export declare function resolvePolicyForLine(policies: EnginePolicy[], categoryId: string | null): EnginePolicy;
/** Every line gets a row, violating or not, so the builder screen can badge all of them. */
export declare function resolveLineCeilings(lines: EngineLine[], policies: EnginePolicy[]): LineCeiling[];
/**
 * The strictest thresholds among the policies the lines actually touched.
 * A quote whose lines span Services and Hardware is governed by whichever of
 * the two escalates soonest - the tight policy is not diluted by the loose one.
 */
export declare function governingThresholds(ceilings: LineCeiling[], policies: EnginePolicy[]): {
    requiresManagerAboveBps: number;
    requiresFinanceAboveBps: number;
};
