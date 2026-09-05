"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fulfillment_state_service_1 = require("./fulfillment-state.service");
const types_1 = require("../../operations/types");
describe('transitionFulfillment', () => {
    it('walks the happy path to delivered', () => {
        const path = [
            ['ORDER_CONFIRMED', 'INVENTORY_RESERVED'],
            ['INVENTORY_RESERVED', 'PICKING'],
            ['PICKING', 'PACKED'],
            ['PACKED', 'SHIPPED'],
            ['SHIPPED', 'DELIVERED'],
        ];
        for (const [from, to] of path)
            expect((0, fulfillment_state_service_1.transitionFulfillment)(from, to)).toBe(to);
    });
    it('a short reservation can fall into backordered and recover', () => {
        expect((0, fulfillment_state_service_1.transitionFulfillment)('ORDER_CONFIRMED', 'BACKORDERED')).toBe('BACKORDERED');
        expect((0, fulfillment_state_service_1.transitionFulfillment)('BACKORDERED', 'INVENTORY_RESERVED')).toBe('INVENTORY_RESERVED');
    });
    it('delivered is terminal and skipping steps is rejected', () => {
        expect(() => (0, fulfillment_state_service_1.transitionFulfillment)('DELIVERED', 'SHIPPED')).toThrow(types_1.AppError);
        try {
            (0, fulfillment_state_service_1.transitionFulfillment)('DELIVERED', 'SHIPPED');
        }
        catch (e) {
            expect(e.code).toBe('QUOTE_INVALID_STATE');
        }
        expect(() => (0, fulfillment_state_service_1.transitionFulfillment)('PICKING', 'SHIPPED')).toThrow();
    });
});
//# sourceMappingURL=fulfillment-state.service.spec.js.map