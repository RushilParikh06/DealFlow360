"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const payment_service_1 = require("./payment.service");
const types_1 = require("../../operations/types");
describe('applyPayment', () => {
    it('a partial payment leaves the invoice partially paid', () => {
        const result = (0, payment_service_1.applyPayment)(10000, 0, 4000);
        expect(result.newPaidMinor).toBe(4000);
        expect(result.status).toBe('PARTIALLY_PAID');
    });
    it('paying the remaining balance marks it paid', () => {
        expect((0, payment_service_1.applyPayment)(10000, 4000, 6000).status).toBe('PAID');
    });
    it('overpayment is rejected rather than silently accepted', () => {
        expect(() => (0, payment_service_1.applyPayment)(10000, 4000, 7000)).toThrow(types_1.AppError);
        try {
            (0, payment_service_1.applyPayment)(10000, 4000, 7000);
        }
        catch (e) {
            expect(e.code).toBe('VALIDATION_FAILED');
        }
    });
    it('a zero or negative payment is rejected', () => {
        expect(() => (0, payment_service_1.applyPayment)(10000, 0, 0)).toThrow();
        expect(() => (0, payment_service_1.applyPayment)(10000, 0, -100)).toThrow();
    });
});
//# sourceMappingURL=payment.service.spec.js.map