import { type ApprovalDetail, type ApprovalListItem, type ApprovalStatus, type ApproverRole, type Paginated, type QuoteStatePort } from '@dealflow/contracts';
import { PrismaService } from '../../shared/prisma.service';
import type { AuthUser } from '../../shared/current-user';
import { AuditService } from './audit.service';
import { EvaluationService } from './evaluation.service';
export interface ListApprovalsFilter {
    status?: ApprovalStatus;
    assignedRole?: ApproverRole;
    page?: number;
    pageSize?: number;
}
export declare class ApprovalService {
    private readonly prisma;
    private readonly audit;
    private readonly evaluations;
    private readonly quoteState;
    constructor(prisma: PrismaService, audit: AuditService, evaluations: EvaluationService, quoteState: QuoteStatePort);
    list(filter: ListApprovalsFilter): Promise<Paginated<ApprovalListItem>>;
    detail(id: string): Promise<ApprovalDetail>;
    act(id: string, action: 'APPROVE' | 'REJECT' | 'RETURN', actor: AuthUser, reason?: string): Promise<ApprovalDetail>;
    /** Reads B1's tables, so it stays small and obvious. */
    private quotationHeaders;
}
