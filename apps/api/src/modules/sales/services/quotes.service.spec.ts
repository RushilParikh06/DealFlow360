import { QuotesService } from './quotes.service';

/** Minimal stand-in for the two prisma calls deleteLine/addLine reach for. */
function prismaStub(quote: { id: string; status: string; currency: string; lines: { id: string }[] }) {
  return {
    // get() resolves an id OR a human code, so it reads through findFirst.
    quotation: { findFirst: jest.fn().mockResolvedValue(quote), update: jest.fn() },
    quotationLine: { delete: jest.fn(), create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    product: { findUnique: jest.fn().mockResolvedValue(null) },
  };
}

describe('QuotesService.deleteLine', () => {
  const quote = { id: 'qt_A', status: 'DRAFT', currency: 'INR', lines: [{ id: 'line_a1' }] };

  it('deletes a line that belongs to the quote', async () => {
    const prisma = prismaStub(quote);
    const service = new QuotesService(prisma as never, {} as never);
    await service.deleteLine('qt_A', 'line_a1');
    expect(prisma.quotationLine.delete).toHaveBeenCalledWith({ where: { id: 'line_a1' } });
  });

  it('refuses to delete a line belonging to a different quote', async () => {
    const prisma = prismaStub(quote);
    const service = new QuotesService(prisma as never, {} as never);

    await expect(service.deleteLine('qt_A', 'line_from_quote_B')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    // the real damage was the delete landing on another quote's line and that
    // quote then keeping totals for a line it no longer has
    expect(prisma.quotationLine.delete).not.toHaveBeenCalled();
    expect(prisma.quotation.update).not.toHaveBeenCalled();
  });

  it('refuses to edit a quote that has left DRAFT', async () => {
    const prisma = prismaStub({ ...quote, status: 'PENDING_MANAGER' });
    const service = new QuotesService(prisma as never, {} as never);
    await expect(service.deleteLine('qt_A', 'line_a1')).rejects.toMatchObject({ code: 'QUOTE_INVALID_STATE' });
  });
});

describe('QuotesService.addLine', () => {
  it('prices the line from the product, never from the request', async () => {
    const prisma = prismaStub({ id: 'qt_A', status: 'DRAFT', currency: 'INR', lines: [] });
    prisma.product.findUnique = jest.fn().mockResolvedValue({
      id: 'prd_1',
      name: 'RackServer R220',
      listPriceMinor: 30_000,
      unitCostMinor: 26_000,
      currency: 'INR',
      lineType: 'ONE_TIME',
    });
    prisma.quotationLine.create = jest.fn().mockResolvedValue({ id: 'line_new' });

    const service = new QuotesService(prisma as never, {} as never);
    await service.addLine('qt_A', { productId: 'prd_1', qty: 2, discountBps: 1000 });

    expect(prisma.quotationLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        unitPriceMinor: 30_000,
        costMinor: 26_000, // UNIT cost, what B2 multiplies by qty
        description: 'RackServer R220',
        lineType: 'ONE_TIME',
        lineTotalMinor: 54_000, // 2 x 30000, less 10%
      }),
    });
  });

  it('rejects a product priced in another currency', async () => {
    const prisma = prismaStub({ id: 'qt_A', status: 'DRAFT', currency: 'INR', lines: [] });
    prisma.product.findUnique = jest.fn().mockResolvedValue({ id: 'prd_1', currency: 'USD', listPriceMinor: 1, unitCostMinor: 1, name: 'x', lineType: 'ONE_TIME' });

    const service = new QuotesService(prisma as never, {} as never);
    await expect(service.addLine('qt_A', { productId: 'prd_1', qty: 1 })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('404s on an unknown product instead of writing a zero-priced line', async () => {
    const prisma = prismaStub({ id: 'qt_A', status: 'DRAFT', currency: 'INR', lines: [] });
    const service = new QuotesService(prisma as never, {} as never);
    await expect(service.addLine('qt_A', { productId: 'nope', qty: 1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(prisma.quotationLine.create).not.toHaveBeenCalled();
  });
});
