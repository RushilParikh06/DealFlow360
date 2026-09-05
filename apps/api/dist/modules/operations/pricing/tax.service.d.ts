import { type Money } from '../types';
export interface TaxRule {
    categoryId: string;
    rateBps: number;
}
/** Finds the rule for a category, or the null-categoryId default rule. */
export declare function findTaxRule(rules: TaxRule[], categoryId: string): TaxRule | undefined;
/** Tax on one line total. No rule for the category means zero tax, not an error. */
export declare function calculateLineTax(lineTotal: Money, rules: TaxRule[], categoryId: string): Money;
