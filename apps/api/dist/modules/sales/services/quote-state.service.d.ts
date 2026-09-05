import { QuotationStatus, type QuoteStatePort, type QuoteStateTransition } from '@dealflow/contracts';
import { PrismaService } from '../../shared/prisma.service';
/** plan.md section 7, the whole state machine. Anything not listed throws. */
export declare const ALLOWED_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]>;
/** Pure check, no I/O - what audit/tests/other owners can call without a client. */
export declare function isTransitionAllowed(from: QuotationStatus, to: QuotationStatus): boolean;
export declare class QuoteStateService implements QuoteStatePort {
    private readonly prisma;
    constructor(prisma: PrismaService);
    transition(input: QuoteStateTransition, tx?: unknown): Promise<{
        status: QuotationStatus;
    }>;
}
