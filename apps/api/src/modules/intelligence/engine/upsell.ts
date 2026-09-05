// B2 OWNED. Ranking upsell and cross-sell candidates.
//
// B3 owns product_relationships and supplies the pairs and the attach rate.
// B2 decides the order they appear in, which is the part with an opinion in it.
//
// Ranking on raw margin alone puts the expensive thing nobody buys at the top.
// Ranking on attach rate alone puts the cheap cable at the top. The rank key is
// margin weighted by attach rate - expected margin - which is the number a sales
// manager would actually use.

import { asBps, money, roundHalfUp } from '@dealflow/contracts';
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

export function rankUpsell(
  candidates: UpsellCandidate[],
  currency: string,
  limit = 5,
): UpsellSuggestion[] {
  const scored = candidates
    .filter((c) => !c.alreadyOnQuote && c.suggestedQty > 0)
    .map((c) => {
      const grossMinor = c.unitPriceMinor * c.suggestedQty;
      const discountMinor = roundHalfUp((grossMinor * c.safeDiscountBps) / 10_000);
      const netMinor = grossMinor - discountMinor;
      const costMinor = c.unitCostMinor * c.suggestedQty;
      const marginDeltaMinor = netMinor - costMinor;
      const expectedMarginMinor = roundHalfUp((marginDeltaMinor * c.attachRateBps) / 10_000);

      return {
        candidate: c,
        marginDeltaMinor,
        expectedMarginMinor,
        marginBps: asBps(marginDeltaMinor, netMinor),
      };
    })
    // deterministic all the way down, so the demo never reorders between runs
    .sort(
      (a, b) =>
        b.expectedMarginMinor - a.expectedMarginMinor ||
        b.candidate.attachRateBps - a.candidate.attachRateBps ||
        (a.candidate.productId < b.candidate.productId ? -1 : 1),
    )
    .slice(0, limit);

  return scored.map((s, i) => ({
    productId: s.candidate.productId,
    productName: s.candidate.productName,
    kind: s.candidate.kind,
    suggestedQty: s.candidate.suggestedQty,
    unitPrice: money(s.candidate.unitPriceMinor, currency),
    marginDelta: money(s.marginDeltaMinor, currency),
    marginBps: s.marginBps,
    attachRateBps: s.candidate.attachRateBps,
    expectedMargin: money(s.expectedMarginMinor, currency),
    rank: i + 1,
  }));
}
