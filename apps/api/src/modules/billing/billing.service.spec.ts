import { BillingService } from './billing.service';
import type { AuthUser } from '../shared/current-user';

const actor: AuthUser = { id: 'usr_1', role: 'FINANCE', customerId: null };

const order = {
  id: 'ord_1',
  currency: 'INR',
  lines: [
    { id: 'ol_1', lineType: 'ONE_TIME', lineTotalMinor: 30_000 },
    { id: 'ol_2', lineType: 'ONE_TIME', lineTotalMinor: 12_000 },
    { id: 'ol_3', lineType: 'RECURRING', lineTotalMinor: 5_000 },
  ],
};

/** $transaction hands the callback a client; here it is the same stub. */
function prismaStub(overrides: Record<string, unknown> = {}) {
  const stub: Record<string, unknown> = {
    order: { findUnique: jest.fn().mockResolvedValue(order) },
    fulfillment: { findFirst: jest.fn().mockResolvedValue({ status: 'SHIPPED' }) },
    invoice: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'inv_1' }),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'inv_1', ...data })),
    },
    subscription: { create: jest.fn().mockResolvedValue({ id: 'sub_1' }) },
    payment: { create: jest.fn() },
    ...overrides,
  };
  stub.$transaction = (fn: (tx: unknown) => unknown) => fn(stub);
  return stub;
}

const auditStub = () => ({ record: jest.fn() });

describe('BillingService.invoiceOrder', () => {
  it('bills one-time lines and opens a subscription for the recurring ones', async () => {
    const prisma = prismaStub();
    const audit = auditStub();
    const service = new BillingService(prisma as never, audit as never);

    await service.invoiceOrder('ord_1', actor);

    const invoice = (prisma.invoice as { create: jest.Mock }).create.mock.calls[0][0].data;
    expect(invoice.totalMinor).toBe(42_000); // the two ONE_TIME lines, not the recurring one
    expect(invoice.lines.create).toHaveLength(2);
    expect(invoice.status).toBe('ISSUED');

    const subscription = (prisma.subscription as { create: jest.Mock }).create.mock.calls[0][0].data;
    expect(subscription.amountMinor).toBe(5_000);
    expect(subscription.status).toBe('ACTIVE');
  });

  it('refuses to bill an order that has not shipped', async () => {
    const prisma = prismaStub({ fulfillment: { findFirst: jest.fn().mockResolvedValue({ status: 'PICKING' }) } });
    const service = new BillingService(prisma as never, auditStub() as never);

    await expect(service.invoiceOrder('ord_1', actor)).rejects.toMatchObject({ code: 'INVOICE_BEFORE_SHIPMENT' });
    expect((prisma.invoice as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });

  it('returns the existing invoice instead of billing the order twice', async () => {
    const prisma = prismaStub({
      invoice: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inv_existing' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'inv_existing' }),
        create: jest.fn(),
      },
    });
    const service = new BillingService(prisma as never, auditStub() as never);

    await expect(service.invoiceOrder('ord_1', actor)).resolves.toMatchObject({ id: 'inv_existing' });
    expect((prisma.invoice as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });
});

describe('BillingService.payInvoice', () => {
  const issued = { id: 'inv_1', status: 'ISSUED', totalMinor: 42_000, paidMinor: 0, currency: 'INR' };

  const withInvoice = (invoice: Record<string, unknown>) =>
    prismaStub({
      invoice: {
        findUnique: jest.fn().mockResolvedValue(invoice),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'inv_1', ...data })),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    });

  it('derives PARTIALLY_PAID from the running total, not from the caller', async () => {
    const prisma = withInvoice(issued);
    const service = new BillingService(prisma as never, auditStub() as never);

    await expect(service.payInvoice('inv_1', 10_000, 'NEFT', 'ref-1', actor)).resolves.toMatchObject({
      paidMinor: 10_000,
      status: 'PARTIALLY_PAID',
    });
  });

  it('marks the invoice PAID only when the balance is cleared exactly', async () => {
    const prisma = withInvoice({ ...issued, paidMinor: 40_000 });
    const service = new BillingService(prisma as never, auditStub() as never);

    await expect(service.payInvoice('inv_1', 2_000, 'NEFT', 'ref-2', actor)).resolves.toMatchObject({
      status: 'PAID',
    });
  });

  it('rejects an overpayment and records nothing', async () => {
    const prisma = withInvoice(issued);
    const service = new BillingService(prisma as never, auditStub() as never);

    await expect(service.payInvoice('inv_1', 50_000, 'NEFT', 'ref-3', actor)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect((prisma.payment as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });

  it('refuses to settle a voided invoice', async () => {
    const prisma = withInvoice({ ...issued, status: 'VOID' });
    const service = new BillingService(prisma as never, auditStub() as never);

    await expect(service.payInvoice('inv_1', 1_000, 'NEFT', 'ref-4', actor)).rejects.toMatchObject({
      code: 'QUOTE_INVALID_STATE',
    });
  });
});
