import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionInvoice, buildOneTimeInvoiceLines, type OrderLine } from './invoice.service.ts';
import { AppError } from '../../operations/types.ts';

test('invoice happy path draft -> issued -> paid', () => {
  assert.equal(transitionInvoice('DRAFT', 'ISSUED'), 'ISSUED');
  assert.equal(transitionInvoice('ISSUED', 'PARTIALLY_PAID'), 'PARTIALLY_PAID');
  assert.equal(transitionInvoice('PARTIALLY_PAID', 'PAID'), 'PAID');
});

test('paid and void are terminal', () => {
  assert.throws(() => transitionInvoice('PAID', 'ISSUED'));
  assert.throws(() => transitionInvoice('VOID', 'ISSUED'));
});

const lines: OrderLine[] = [
  { id: 'line_1', lineType: 'ONE_TIME', lineTotalMinor: 20000, currency: 'INR' },
  { id: 'line_2', lineType: 'RECURRING', lineTotalMinor: 5000, currency: 'INR' },
];

test('only shipped one-time lines are invoiced; recurring lines are excluded', () => {
  const shipped = new Map([['line_1', 'SHIPPED' as const]]);
  const invoiceLines = buildOneTimeInvoiceLines(lines, shipped);
  assert.equal(invoiceLines.length, 1);
  assert.equal(invoiceLines[0].orderLineId, 'line_1');
});

test('billing an unshipped one-time line is rejected, not silently skipped', () => {
  const notShipped = new Map([['line_1', 'PICKING' as const]]);
  assert.throws(() => buildOneTimeInvoiceLines(lines, notShipped), (e: unknown) => e instanceof AppError && e.code === 'INVOICE_BEFORE_SHIPMENT');
});
