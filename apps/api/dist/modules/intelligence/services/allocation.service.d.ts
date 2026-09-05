import { type AllocationResponse } from '@dealflow/contracts';
import { PrismaService } from '../../shared/prisma.service';
import type { AuthUser } from '../../shared/current-user';
import { AuditService } from './audit.service';
import { OpsReaderService } from './ops-reader.service';
export declare class AllocationService {
    private readonly prisma;
    private readonly ops;
    private readonly audit;
    constructor(prisma: PrismaService, ops: OpsReaderService, audit: AuditService);
    recommend(orderId: string): Promise<AllocationResponse>;
    /**
     * Turn a recommendation into reservation rows. Re-reads stock INSIDE the
     * transaction and re-runs the same pure function, because the recommendation
     * the user is looking at may be seconds stale and two reps confirming the last
     * unit at once is the one race that matters here.
     */
    reserve(orderId: string, actor: AuthUser): Promise<AllocationResponse>;
    release(orderId: string, actor: AuthUser): Promise<{
        released: number;
    }>;
}
