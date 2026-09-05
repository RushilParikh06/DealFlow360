import type { UpsellSuggestion } from '@dealflow/contracts';
export interface UpsellCandidate {
    productId: string;
    productName: string;
    kind: 'UPSELL' | 'CROSS_SELL';
    suggestedQty: number;
    unitPriceMinor: number;
    unitCostMinor: number;
    attachRateBps: number;
    /** Candidates already on the quote are dropped, not shown greyed out. */
    alreadyOnQuote: boolean;
    /** The ceiling-safe discount for this product's category and the customer's
     *  tier. The suggestion is priced at a discount the rep can actually give
     *  without sending their own quote back into approval. */
    safeDiscountBps: number;
}
export declare function rankUpsell(candidates: UpsellCandidate[], currency: string, limit?: number): UpsellSuggestion[];
