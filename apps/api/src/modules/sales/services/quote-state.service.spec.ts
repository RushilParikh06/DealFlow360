import { QuotationStatus } from '@dealflow/contracts';
import { QuoteStateService, isTransitionAllowed, ALLOWED_TRANSITIONS } from './quote-state.service';

describe('isTransitionAllowed', () => {
  it('walks the whole plan.md section 7 happy path', () => {
    const path: [string, string][] = [
      ['DRAFT', 'SUBMITTED'],
      ['SUBMITTED', 'PENDING_MANAGER'],
      ['PENDING_MANAGER', 'PENDING_FINANCE'],
      ['PENDING_FINANCE', 'APPROVED'],
      ['APPROVED', 'CONFIRMED'],
      ['CONFIRMED', 'FULFILLING'],
      ['FULFILLING', 'COMPLETED'],
    ];
    for (const [from, to] of path) {
      expect(isTransitionAllowed(from as QuotationStatus, to as QuotationStatus)).toBe(true);
    }
  });

  it('allows the negotiation loop both ways', () => {
    expect(isTransitionAllowed('CONFIRMED', 'NEGOTIATING')).toBe(true);
    expect(isTransitionAllowed('NEGOTIATING', 'CONFIRMED')).toBe(true);
    expect(isTransitionAllowed('NEGOTIATING', 'PENDING_MANAGER')).toBe(true);
  });

  it('allows RETURNED back to DRAFT for revision', () => {
    expect(isTransitionAllowed('PENDING_MANAGER', 'RETURNED')).toBe(true);
    expect(isTransitionAllowed('RETURNED', 'DRAFT')).toBe(true);
  });

  it('rejects skipping a step', () => {
    expect(isTransitionAllowed('DRAFT', 'CONFIRMED')).toBe(false);
    expect(isTransitionAllowed('SUBMITTED', 'APPROVED')).toBe(false);
  });

  it('REJECTED and COMPLETED are terminal', () => {
    expect(ALLOWED_TRANSITIONS.REJECTED).toEqual([]);
    expect(ALLOWED_TRANSITIONS.COMPLETED).toEqual([]);
  });

  it('a same-state request is a no-op, not an error', () => {
    expect(isTransitionAllowed('DRAFT', 'DRAFT')).toBe(true);
  });
});

describe('QuoteStateService.transition', () => {
  function fakeClient(initialStatus: string) {
    let status = initialStatus;
    return {
      quotation: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve({ status })),
        update: jest.fn().mockImplementation(({ data }: { data: { status: string } }) => {
          status = data.status;
          return Promise.resolve({ status });
        }),
      },
    };
  }

  it('writes the new status when the transition is allowed', async () => {
    const client = fakeClient('DRAFT');
    const service = new QuoteStateService(client as never);
    const result = await service.transition({ quotationId: 'q1', to: QuotationStatus.SUBMITTED, actorUserId: 'u1' });
    expect(result.status).toBe('SUBMITTED');
    expect(client.quotation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUBMITTED' }) }),
    );
  });

  it('throws QUOTE_INVALID_STATE and never calls update for a disallowed move', async () => {
    const client = fakeClient('DRAFT');
    const service = new QuoteStateService(client as never);
    await expect(
      service.transition({ quotationId: 'q1', to: QuotationStatus.CONFIRMED, actorUserId: 'u1' }),
    ).rejects.toMatchObject({ code: 'QUOTE_INVALID_STATE' });
    expect(client.quotation.update).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND for a quotation that does not exist', async () => {
    const client = { quotation: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() } };
    const service = new QuoteStateService(client as never);
    await expect(
      service.transition({ quotationId: 'missing', to: QuotationStatus.SUBMITTED, actorUserId: 'u1' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
