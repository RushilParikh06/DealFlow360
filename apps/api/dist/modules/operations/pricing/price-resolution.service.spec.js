"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const price_resolution_service_1 = require("./price-resolution.service");
const types_1 = require("../types");
const priceLists = [
    { id: 'pl_default', customerTierId: null },
    { id: 'pl_gold', customerTierId: 'GOLD' },
];
const items = [
    { priceListId: 'pl_default', productId: 'prd_1', unitPriceMinor: 10000, currency: 'INR' },
    { priceListId: 'pl_gold', productId: 'prd_1', unitPriceMinor: 9000, currency: 'INR' },
];
describe('resolvePrice', () => {
    it('a tier-specific price wins over the default', () => {
        expect((0, price_resolution_service_1.resolvePrice)(priceLists, items, 'prd_1', 'GOLD').amountMinor).toBe(9000);
    });
    it('falls back to the default list when the customer has no tier match', () => {
        expect((0, price_resolution_service_1.resolvePrice)(priceLists, items, 'prd_1', 'SILVER').amountMinor).toBe(10000);
    });
    it('missing from every list is NOT_FOUND, not a zero price', () => {
        expect(() => (0, price_resolution_service_1.resolvePrice)(priceLists, items, 'prd_missing', null)).toThrow(types_1.AppError);
        try {
            (0, price_resolution_service_1.resolvePrice)(priceLists, items, 'prd_missing', null);
        }
        catch (e) {
            expect(e.code).toBe('NOT_FOUND');
        }
    });
});
//# sourceMappingURL=price-resolution.service.spec.js.map