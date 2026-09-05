import { applyBps, type Money } from '../types.ts';

export interface TaxRule {
  categoryId: string;
  rateBps: number; // e.g. 1800 = 18%
}

/** Finds the rule for a category, or the null-categoryId default rule. */
export function findTaxRule(rules: TaxRule[], categoryId: string): TaxRule | undefined {
  return rules.find((r) => r.categoryId === categoryId) ?? rules.find((r) => r.categoryId === null as unknown as string);
}

/** Tax on one line total. No rule for the category means zero tax, not an error. */
export function calculateLineTax(lineTotal: Money, rules: TaxRule[], categoryId: string): Money {
  const rule = findTaxRule(rules, categoryId);
  return { amountMinor: rule ? applyBps(lineTotal.amountMinor, rule.rateBps) : 0, currency: lineTotal.currency };
}
