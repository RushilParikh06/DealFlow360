import { type DiscountPolicyView } from '@dealflow/contracts';
import { PrismaService } from '../../shared/prisma.service';
import { AuditService } from './audit.service';
import type { AuthUser } from '../../shared/current-user';
export interface UpdatePolicyInput {
    maxDiscountBps?: number;
    requiresManagerAboveBps?: number;
    requiresFinanceAboveBps?: number;
    isActive?: boolean;
}
export declare class PolicyService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(): Promise<DiscountPolicyView[]>;
    update(id: string, patch: UpdatePolicyInput, actor: AuthUser): Promise<DiscountPolicyView>;
}
