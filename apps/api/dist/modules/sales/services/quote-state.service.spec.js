"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const contracts_1 = require("@dealflow/contracts");
const quote_state_service_1 = require("./quote-state.service");
describe('isTransitionAllowed', () => {
    it('walks the whole plan.md section 7 happy path', () => {
        const path = [
            ['DRAFT', 'SUBMITTED'],
            ['SUBMITTED', 'PENDING_MANAGER'],
            ['PENDING_MANAGER', 'PENDING_FINANCE'],
            ['PENDING_FINANCE', 'APPROVED'],
            ['APPROVED', 'CONFIRMED'],
            ['CONFIRMED', 'FULFILLING'],
            ['FULFILLING', 'COMPLETED'],
        ];
        for (const [from, to] of path) {
            expect((0, quote_state_service_1.isTransitionAllowed)(from, to)).toBe(true);
        }
    });
    it('allows the negotiation loop both ways', () => {
        expect((0, quote_state_service_1.isTransitionAllowed)('CONFIRMED', 'NEGOTIATING')).toBe(true);
        expect((0, quote_state_service_1.isTransitionAllowed)('NEGOTIATING', 'CONFIRMED')).toBe(true);
        expect((0, quote_state_service_1.isTransitionAllowed)('NEGOTIATING', 'PENDING_MANAGER')).toBe(true);
    });
    it('allows RETURNED back to DRAFT for revision', () => {
        expect((0, quote_state_service_1.isTransitionAllowed)('PENDING_MANAGER', 'RETURNED')).toBe(true);
        expect((0, quote_state_service_1.isTransitionAllowed)('RETURNED', 'DRAFT')).toBe(true);
    });
    it('rejects skipping a step', () => {
        expect((0, quote_state_service_1.isTransitionAllowed)('DRAFT', 'CONFIRMED')).toBe(false);
        expect((0, quote_state_service_1.isTransitionAllowed)('SUBMITTED', 'APPROVED')).toBe(false);
    });
    it('REJECTED and COMPLETED are terminal', () => {
        expect(quote_state_service_1.ALLOWED_TRANSITIONS.REJECTED).toEqual([]);
        expect(quote_state_service_1.ALLOWED_TRANSITIONS.COMPLETED).toEqual([]);
    });
    it('a same-state request is a no-op, not an error', () => {
        expect((0, quote_state_service_1.isTransitionAllowed)('DRAFT', 'DRAFT')).toBe(true);
    });
});
describe('QuoteStateService.transition', () => {
    function fakeClient(initialStatus) {
        let status = initialStatus;
        return {
            quotation: {
                findUnique: jest.fn().mockImplementation(() => Promise.resolve({ status })),
                update: jest.fn().mockImplementation(({ data }) => {
                    status = data.status;
                    return Promise.resolve({ status });
                }),
            },
        };
    }
    it('writes the new status when the transition is allowed', async () => {
        const client = fakeClient('DRAFT');
        const service = new quote_state_service_1.QuoteStateService(client);
        const result = await service.transition({ quotationId: 'q1', to: contracts_1.QuotationStatus.SUBMITTED, actorUserId: 'u1' });
        expect(result.status).toBe('SUBMITTED');
        expect(client.quotation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SUBMITTED' }) }));
    });
    it('throws QUOTE_INVALID_STATE and never calls update for a disallowed move', async () => {
        const client = fakeClient('DRAFT');
        const service = new quote_state_service_1.QuoteStateService(client);
        await expect(service.transition({ quotationId: 'q1', to: contracts_1.QuotationStatus.CONFIRMED, actorUserId: 'u1' })).rejects.toMatchObject({ code: 'QUOTE_INVALID_STATE' });
        expect(client.quotation.update).not.toHaveBeenCalled();
    });
    it('throws NOT_FOUND for a quotation that does not exist', async () => {
        const client = { quotation: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() } };
        const service = new quote_state_service_1.QuoteStateService(client);
        await expect(service.transition({ quotationId: 'missing', to: contracts_1.QuotationStatus.SUBMITTED, actorUserId: 'u1' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
});
//# sourceMappingURL=quote-state.service.spec.js.map