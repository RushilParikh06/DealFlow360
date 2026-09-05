import { type Money } from '../types';
export interface PriceList {
    id: string;
    customerTierId: string | null;
}
export interface PriceListItem {
    priceListId: string;
    productId: string;
    unitPriceMinor: number;
    currency: string;
}
/**
 * Backs GET /price-lists/:id/resolve (plan.md section 8). A tier-specific list
 * always wins over the default one when both carry the product; missing from
 * both is a hard NOT_FOUND, never a silent zero price.
 */
export declare function resolvePrice(priceLists: PriceList[], items: PriceListItem[], productId: string, customerTierId: string | null): Money;
