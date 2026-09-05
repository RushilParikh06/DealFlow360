import { transitionInvoice, buildOneTimeInvoiceLines, type OrderLine } from './invoice.service';
import { AppError } from '../../operations/types';

describe('transitionInvoice', () => {
  it('walks the happy path draft -> issued -> paid', () => {
    expect(transitionInvoice('DRAFT', 'ISSUED')).toBe('ISSUED');
    expect(transitionInvoice('ISSUED', 'PARTIALLY_PAID')).toBe('PARTIALLY_PAID');
    expect(transitionInvoice('PARTIALLY_PAID', 'PAID')).toBe('PAID');
  });

  it('paid and void are terminal', () => {
    expect(() => transitionInvoice('PAID', 'ISSUED')).toThrow();
    expect(() => transitionInvoice('VOID', 'ISSUED')).toThrow();
  });
});

describe('buildOneTimeInvoiceLines', () => {
  const lines: OrderLine[] = [
    { id: 'line_1', lineType: 'ONE_TIME', lineTotalMinor: 20000, currency: 'INR' },
    { id: 'line_2', lineType: 'RECURRING', lineTotalMinor: 5000, currency: 'INR' },
  ];

  it('only shipped one-time lines are invoiced; recurring lines are excluded', () => {
    const shipped = new Map([['line_1', 'SHIPPED' as const]]);
    const invoiceLines = buildOneTimeInvoiceLines(lines, shipped);
    expect(invoiceLines.length).toBe(1);
    expect(invoiceLines[0].orderLineId).toBe('line_1');
  });

  it('billing an unshipped one-time line is rejected, not silently skipped', () => {
    const notShipped = new Map([['line_1', 'PICKING' as const]]);
    expect(() => buildOneTimeInvoiceLines(lines, notShipped)).toThrow(AppError);
    try {
      buildOneTimeInvoiceLines(lines, notShipped);
    } catch (e) {
      expect((e as AppError).code).toBe('INVOICE_BEFORE_SHIPMENT');
    }
  });
});
