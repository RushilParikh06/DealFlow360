import { type EvaluationResponse, type QuoteStatePort } from '@dealflow/contracts';
import { PrismaService } from '../../shared/prisma.service';
import type { AuthUser } from '../../shared/current-user';
import { AuditService } from './audit.service';
import { QuoteReaderService } from './quote-reader.service';
export declare class EvaluationService {
    private readonly prisma;
    private readonly reader;
    private readonly audit;
    private readonly quoteState;
    constructor(prisma: PrismaService, reader: QuoteReaderService, audit: AuditService, quoteState: QuoteStatePort);
    evaluate(quotationId: string, actor: AuthUser): Promise<EvaluationResponse>;
    /** Newest first. The trail is append-only, so this is the negotiation history
     *  of the quote: every re-evaluation that ever happened, with the score as it
     *  stood at the time. */
    history(quotationId: string, take?: number): Promise<EvaluationResponse[]>;
    latestFor(quotationId: string): Promise<EvaluationResponse | null>;
    private persist;
    /**
     * The escalation itself. This is the moment the demo is built around, so it is
     * worth reading slowly.
     *
     * Over ceiling  -> open a chain and push the quote to PENDING_MANAGER
     * Within        -> supersede any open chain, and the quote either auto approves
     *                  (from SUBMITTED) or returns to CONFIRMED (from NEGOTIATING)
     *
     * The second branch is what makes a portal counter-offer safe: the customer
     * lowers their ask, the engine re-scores, the stale approval chain is closed
     * rather than left dangling in somebody's queue.
     */
    private applyRouting;
    /** B2 never writes quotations.status directly (invariant 5). It asks the port. */
    private transition;
    private toResponse;
    /** Rehydrate a stored row without recomputing. Used by the history endpoint
     *  and by the approval screens, which must show the score AS IT WAS JUDGED. */
    private fromRow;
}
