import type { Prisma } from '@prisma/client';
import type { AuditEntry, UserRole } from '@dealflow/contracts';
import { PrismaService } from '../../shared/prisma.service';
export interface AuditInput {
    entityType: 'QUOTATION' | 'APPROVAL_REQUEST' | 'APPROVAL_STEP' | 'RISK_EVALUATION' | 'DISCOUNT_POLICY' | 'INVENTORY_RESERVATION' | 'DEAL_HEALTH_EVENT';
    entityId: string;
    action: string;
    actorUserId?: string | null;
    actorRole?: UserRole | null;
    fromValue?: string | null;
    toValue?: string | null;
    metadata?: Record<string, unknown> | null;
}
export declare class AuditService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    /** Only callable from inside a transaction. That is the point. */
    record(tx: Prisma.TransactionClient, input: AuditInput): Promise<void>;
    /** Read side for GET /audit and for the trail on the approval detail screen. */
    list(filter: {
        entityType?: string;
        entityId?: string;
        take?: number;
    }): Promise<AuditEntry[]>;
    /** The trail a reviewer reads on screen 6: the quote, its approval, its steps. */
    trailForQuotation(quotationId: string, approvalRequestId?: string): Promise<AuditEntry[]>;
}
