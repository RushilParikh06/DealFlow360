"use strict";
// B2 OWNED. Ranking upsell and cross-sell candidates.
//
// B3 owns product_relationships and supplies the pairs and the attach rate.
// B2 decides the order they appear in, which is the part with an opinion in it.
//
// Ranking on raw margin alone puts the expensive thing nobody buys at the top.
// Ranking on attach rate alone puts the cheap cable at the top. The rank key is
// margin weighted by attach rate - expected margin - which is the number a sales
// manager would actually use.
Object.defineProperty(exports, "__esModule", { value: true });
exports.rankUpsell = rankUpsell;
const contracts_1 = require("@dealflow/contracts");
function rankUpsell(candidates, currency, limit = 5) {
    const scored = candidates
        .filter((c) => !c.alreadyOnQuote && c.suggestedQty > 0)
        .map((c) => {
        const grossMinor = c.unitPriceMinor * c.suggestedQty;
        const discountMinor = (0, contracts_1.roundHalfUp)((grossMinor * c.safeDiscountBps) / 10_000);
        const netMinor = grossMinor - discountMinor;
        const costMinor = c.unitCostMinor * c.suggestedQty;
        const marginDeltaMinor = netMinor - costMinor;
        const expectedMarginMinor = (0, contracts_1.roundHalfUp)((marginDeltaMinor * c.attachRateBps) / 10_000);
        return {
            candidate: c,
            marginDeltaMinor,
            expectedMarginMinor,
            marginBps: (0, contracts_1.asBps)(marginDeltaMinor, netMinor),
        };
    })
        // deterministic all the way down, so the demo never reorders between runs
        .sort((a, b) => b.expectedMarginMinor - a.expectedMarginMinor ||
        b.candidate.attachRateBps - a.candidate.attachRateBps ||
        (a.candidate.productId < b.candidate.productId ? -1 : 1))
        .slice(0, limit);
    return scored.map((s, i) => ({
        productId: s.candidate.productId,
        productName: s.candidate.productName,
        kind: s.candidate.kind,
        suggestedQty: s.candidate.suggestedQty,
        unitPrice: (0, contracts_1.money)(s.candidate.unitPriceMinor, currency),
        marginDelta: (0, contracts_1.money)(s.marginDeltaMinor, currency),
        marginBps: s.marginBps,
        attachRateBps: s.candidate.attachRateBps,
        expectedMargin: (0, contracts_1.money)(s.expectedMarginMinor, currency),
        rank: i + 1,
    }));
}
//# sourceMappingURL=upsell.js.map