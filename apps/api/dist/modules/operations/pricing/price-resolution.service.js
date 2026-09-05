"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePrice = resolvePrice;
const types_1 = require("../types");
/**
 * Backs GET /price-lists/:id/resolve (plan.md section 8). A tier-specific list
 * always wins over the default one when both carry the product; missing from
 * both is a hard NOT_FOUND, never a silent zero price.
 */
function resolvePrice(priceLists, items, productId, customerTierId) {
    const tierList = customerTierId ? priceLists.find((l) => l.customerTierId === customerTierId) : undefined;
    const defaultList = priceLists.find((l) => l.customerTierId === null);
    const item = (tierList && items.find((i) => i.priceListId === tierList.id && i.productId === productId)) ||
        (defaultList && items.find((i) => i.priceListId === defaultList.id && i.productId === productId));
    if (!item) {
        throw new types_1.AppError('NOT_FOUND', `no price list entry for product ${productId}`, { productId, customerTierId });
    }
    return { amountMinor: item.unitPriceMinor, currency: item.currency };
}
//# sourceMappingURL=price-resolution.service.js.map