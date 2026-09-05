"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const inventory_state_service_1 = require("./inventory-state.service");
const types_1 = require("../types");
describe('transitionReservation', () => {
    it('walks the happy path AVAILABLE -> RESERVED -> ALLOCATED -> SHIPPED', () => {
        expect((0, inventory_state_service_1.transitionReservation)('AVAILABLE', 'RESERVED')).toBe('RESERVED');
        expect((0, inventory_state_service_1.transitionReservation)('RESERVED', 'ALLOCATED')).toBe('ALLOCATED');
        expect((0, inventory_state_service_1.transitionReservation)('ALLOCATED', 'SHIPPED')).toBe('SHIPPED');
    });
    it('release puts stock back to available for re-reservation', () => {
        expect((0, inventory_state_service_1.transitionReservation)('RESERVED', 'RELEASED')).toBe('RELEASED');
        expect((0, inventory_state_service_1.transitionReservation)('RELEASED', 'RESERVED')).toBe('RESERVED');
    });
    it('a shipped reservation is terminal', () => {
        expect(() => (0, inventory_state_service_1.transitionReservation)('SHIPPED', 'RELEASED')).toThrow(types_1.AppError);
        try {
            (0, inventory_state_service_1.transitionReservation)('SHIPPED', 'RELEASED');
        }
        catch (e) {
            expect(e.code).toBe('QUOTE_INVALID_STATE');
        }
    });
    it('skipping a state is rejected', () => {
        expect(() => (0, inventory_state_service_1.transitionReservation)('AVAILABLE', 'SHIPPED')).toThrow();
    });
});
describe('availableQty / reserveStock', () => {
    it('available is onHand minus reserved, never stored directly', () => {
        expect((0, inventory_state_service_1.availableQty)(50, 12)).toBe(38);
    });
    it('reserving more than available raises INSUFFICIENT_STOCK', () => {
        expect(() => (0, inventory_state_service_1.reserveStock)(10, 8, 5)).toThrow(types_1.AppError);
        try {
            (0, inventory_state_service_1.reserveStock)(10, 8, 5);
        }
        catch (e) {
            expect(e.code).toBe('INSUFFICIENT_STOCK');
        }
        expect((0, inventory_state_service_1.reserveStock)(10, 8, 2)).toBe(10);
    });
});
//# sourceMappingURL=inventory-state.service.spec.js.map