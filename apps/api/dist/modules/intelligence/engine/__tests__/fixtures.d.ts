import type { EngineLine, EnginePolicy, EvaluationInput } from '../types';
export declare const GOLD = "tier_gold";
export declare const CAT_HARDWARE = "cat_hardware";
export declare const CAT_SERVICES = "cat_services";
export declare const CAT_SUBSCRIPTIONS = "cat_subs";
/** Tier ceilings Bronze 5 / Silver 10 / Gold 15, category ceilings Hardware 15 /
 *  Services 10 / Subscriptions 8, each category row stored as the min of the two.
 *  Manager threshold 0 bps (any excess needs a manager), finance threshold
 *  500 bps (five points of excess pulls finance in). */
export declare const goldPolicies: EnginePolicy[];
export declare function line(over: Partial<EngineLine> & {
    quoteLineId: string;
}): EngineLine;
export declare function input(lines: EngineLine[], policies?: EnginePolicy[]): EvaluationInput;
