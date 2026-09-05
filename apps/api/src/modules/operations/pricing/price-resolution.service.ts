import { AppError, type Money } from '../types';

export interface PriceList {
  id: string;
  customerTierId: string | null; // null = the default/general list
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
export function resolvePrice(
  priceLists: PriceList[],
  items: PriceListItem[],
  productId: string,
  customerTierId: string | null,
): Money {
  const tierList = customerTierId ? priceLists.find((l) => l.customerTierId === customerTierId) : undefined;
  const defaultList = priceLists.find((l) => l.customerTierId === null);

  const item =
    (tierList && items.find((i) => i.priceListId === tierList.id && i.productId === productId)) ||
    (defaultList && items.find((i) => i.priceListId === defaultList.id && i.productId === productId));

  if (!item) {
    throw new AppError('NOT_FOUND', `no price list entry for product ${productId}`, { productId, customerTierId });
  }
  return { amountMinor: item.unitPriceMinor, currency: item.currency };
}
