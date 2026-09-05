import { type DealHealthItem } from '@dealflow/contracts';
import { PrismaService } from '../../shared/prisma.service';
import type { AuthUser } from '../../shared/current-user';
import { AuditService } from './audit.service';
import { QuoteReaderService } from './quote-reader.service';
export declare class DealHealthService {
    private readonly prisma;
    private readonly reader;
    private readonly audit;
    constructor(prisma: PrismaService, reader: QuoteReaderService, audit: AuditService);
    /** Run detection across every open quote. Idempotent, so safe to call from a
     *  refresh button as well as from a scheduled job. */
    sweep(now?: Date): Promise<{
        scanned: number;
        findings: number;
    }>;
    detectFor(quotationId: string, now?: Date): Promise<DealHealthItem[]>;
    list(filter: {
        severity?: 'INFO' | 'WARN' | 'CRITICAL';
        includeResolved?: boolean;
    }): Promise<DealHealthItem[]>;
    listFor(quotationId: string): Promise<DealHealthItem[]>;
    /** POST /deal-health/:id/nudge. Records that somebody chased the deal. The
     *  outbound message itself is B3's or F's problem, not the engine's. */
    nudge(eventId: string, actor: AuthUser): Promise<DealHealthItem>;
    private decorate;
}
