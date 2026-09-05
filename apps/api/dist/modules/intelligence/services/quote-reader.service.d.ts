import { PrismaService } from '../../shared/prisma.service';
import type { EnginePolicy, EvaluationInput } from '../engine/types';
import type { DealHealthInput } from '../engine/deal-health';
export interface QuoteContext {
    id: string;
    code: string;
    status: string;
    currency: string;
    customerId: string;
    customerName: string;
    ownerUserId: string;
    tierId: string;
    tierCode: string;
    totalMinor: number;
    lastActivityAt: Date;
}
export declare class QuoteReaderService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    /** Active policy rows for one tier. Both the tier default and every category row. */
    loadPolicies(tierId: string): Promise<EnginePolicy[]>;
    loadEvaluationInput(quotationId: string): Promise<{
        input: EvaluationInput;
        quote: QuoteContext;
    }>;
    /**
     * The rep's own mean discount across their other quotes, weighted by line value.
     * Comparing a rep against themselves is the whole point of the anomaly check -
     * a rep who always discounts 20 percent is not an anomaly, they are a pattern.
     */
    repAverageDiscountBps(ownerUserId: string, excludeQuotationId: string): Promise<number | null>;
    loadDealHealthInput(quotationId: string): Promise<DealHealthInput>;
}
