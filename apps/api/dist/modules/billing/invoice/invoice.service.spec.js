"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const invoice_service_1 = require("./invoice.service");
const types_1 = require("../../operations/types");
describe('transitionInvoice', () => {
    it('walks the happy path draft -> issued -> paid', () => {
        expect((0, invoice_service_1.transitionInvoice)('DRAFT', 'ISSUED')).toBe('ISSUED');
        expect((0, invoice_service_1.transitionInvoice)('ISSUED', 'PARTIALLY_PAID')).toBe('PARTIALLY_PAID');
        expect((0, invoice_service_1.transitionInvoice)('PARTIALLY_PAID', 'PAID')).toBe('PAID');
    });
    it('paid and void are terminal', () => {
        expect(() => (0, invoice_service_1.transitionInvoice)('PAID', 'ISSUED')).toThrow();
        expect(() => (0, invoice_service_1.transitionInvoice)('VOID', 'ISSUED')).toThrow();
    });
});
describe('buildOneTimeInvoiceLines', () => {
    const lines = [
        { id: 'line_1', lineType: 'ONE_TIME', lineTotalMinor: 20000, currency: 'INR' },
        { id: 'line_2', lineType: 'RECURRING', lineTotalMinor: 5000, currency: 'INR' },
    ];
    it('only shipped one-time lines are invoiced; recurring lines are excluded', () => {
        const shipped = new Map([['line_1', 'SHIPPED']]);
        const invoiceLines = (0, invoice_service_1.buildOneTimeInvoiceLines)(lines, shipped);
        expect(invoiceLines.length).toBe(1);
        expect(invoiceLines[0].orderLineId).toBe('line_1');
    });
    it('billing an unshipped one-time line is rejected, not silently skipped', () => {
        const notShipped = new Map([['line_1', 'PICKING']]);
        expect(() => (0, invoice_service_1.buildOneTimeInvoiceLines)(lines, notShipped)).toThrow(types_1.AppError);
        try {
            (0, invoice_service_1.buildOneTimeInvoiceLines)(lines, notShipped);
        }
        catch (e) {
            expect(e.code).toBe('INVOICE_BEFORE_SHIPMENT');
        }
    });
});
//# sourceMappingURL=invoice.service.spec.js.map