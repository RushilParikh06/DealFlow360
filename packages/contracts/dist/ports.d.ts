import type { QuotationStatus } from './enums';
export declare const QUOTE_STATE_PORT = "QUOTE_STATE_PORT";
export interface QuoteStateTransition {
    quotationId: string;
    to: QuotationStatus;
    actorUserId: string;
    reason?: string;
}
export interface QuoteStatePort {
    /**
     * B1's quote-state.service.ts implements this. It validates the transition
     * against its own table and throws QUOTE_INVALID_STATE if the move is not
     * allowed. It must accept an optional transaction client so B2's audit row
     * and this status write land in the same transaction (invariant 6).
     */
    transition(input: QuoteStateTransition, tx?: unknown): Promise<{
        status: QuotationStatus;
    }>;
}
