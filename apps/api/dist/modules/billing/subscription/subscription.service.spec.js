"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const subscription_service_1 = require("./subscription.service");
const types_1 = require("../../operations/types");
describe('transitionSubscription', () => {
    it('active can pause or cancel; paused can resume or cancel', () => {
        expect((0, subscription_service_1.transitionSubscription)('ACTIVE', 'PAUSED')).toBe('PAUSED');
        expect((0, subscription_service_1.transitionSubscription)('PAUSED', 'ACTIVE')).toBe('ACTIVE');
        expect((0, subscription_service_1.transitionSubscription)('ACTIVE', 'CANCELLED')).toBe('CANCELLED');
    });
    it('cancelled is terminal', () => {
        expect(() => (0, subscription_service_1.transitionSubscription)('CANCELLED', 'ACTIVE')).toThrow(types_1.AppError);
        try {
            (0, subscription_service_1.transitionSubscription)('CANCELLED', 'ACTIVE');
        }
        catch (e) {
            expect(e.code).toBe('SUBSCRIPTION_INVALID_STATE');
        }
    });
});
describe('nextBillingDate', () => {
    it('advances by whole months, no proration', () => {
        const next = (0, subscription_service_1.nextBillingDate)(new Date('2026-01-15T00:00:00Z'), 1);
        expect(next.toISOString().slice(0, 10)).toBe('2026-02-15');
    });
});
//# sourceMappingURL=subscription.service.spec.js.map