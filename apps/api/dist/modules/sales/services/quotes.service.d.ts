import { type Paginated } from '@dealflow/contracts';
import { PrismaService } from '../../shared/prisma.service';
import type { AuthUser } from '../../shared/current-user';
import { QuoteStateService } from './quote-state.service';
import type { AddQuotationLineDto, CreateQuotationDto, ListQuotesQueryDto, UpdateQuotationLineDto } from '../dto/quote.dto';
export declare class QuotesService {
    private readonly prisma;
    private readonly quoteState;
    constructor(prisma: PrismaService, quoteState: QuoteStateService);
    list(query: ListQuotesQueryDto): Promise<Paginated<unknown>>;
    get(id: string): Promise<{
        customer: {
            tier: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                code: string;
            };
        } & {
            id: string;
            name: string;
            tierId: string;
            email: string | null;
            createdAt: Date;
            updatedAt: Date;
        };
        lines: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            quotationId: string;
            productId: string;
            description: string;
            qty: number;
            unitPriceMinor: number;
            discountBps: number;
            lineTotalMinor: number;
            costMinor: number;
            lineType: import("@prisma/client").$Enums.LineType;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        customerId: string;
        status: import("@prisma/client").$Enums.QuotationStatus;
        currency: string;
        totalMinor: number;
        ownerUserId: string;
        subtotalMinor: number;
        discountMinor: number;
        taxMinor: number;
        marginBps: number;
        validUntil: Date | null;
        lastActivityAt: Date;
        portalToken: string | null;
    }>;
    create(dto: CreateQuotationDto, actor: AuthUser): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        customerId: string;
        status: import("@prisma/client").$Enums.QuotationStatus;
        currency: string;
        totalMinor: number;
        ownerUserId: string;
        subtotalMinor: number;
        discountMinor: number;
        taxMinor: number;
        marginBps: number;
        validUntil: Date | null;
        lastActivityAt: Date;
        portalToken: string | null;
    }>;
    /** Recomputes and persists the quotation's totals from its current lines. */
    private recomputeTotals;
    private assertEditable;
    /**
     * Price, cost, description and lineType come off the product, never off the
     * request body (invariant 2). costMinor is stored as a UNIT cost because
     * that is what B2's quote-reader.service.ts multiplies by qty.
     */
    addLine(quotationId: string, dto: AddQuotationLineDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        quotationId: string;
        productId: string;
        description: string;
        qty: number;
        unitPriceMinor: number;
        discountBps: number;
        lineTotalMinor: number;
        costMinor: number;
        lineType: import("@prisma/client").$Enums.LineType;
    }>;
    updateLine(quotationId: string, lineId: string, dto: UpdateQuotationLineDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        quotationId: string;
        productId: string;
        description: string;
        qty: number;
        unitPriceMinor: number;
        discountBps: number;
        lineTotalMinor: number;
        costMinor: number;
        lineType: import("@prisma/client").$Enums.LineType;
    }>;
    deleteLine(quotationId: string, lineId: string): Promise<void>;
    /**
     * DRAFT -> SUBMITTED. Scoring and further routing (AUTO_APPROVED vs
     * PENDING_MANAGER) happen when the caller invokes B2's POST /evaluate right
     * after this, per plan.md's client-driven flow - this endpoint only opens
     * the gate.
     */
    submit(quotationId: string, actor: AuthUser): Promise<{
        customer: {
            tier: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                code: string;
            };
        } & {
            id: string;
            name: string;
            tierId: string;
            email: string | null;
            createdAt: Date;
            updatedAt: Date;
        };
        lines: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            quotationId: string;
            productId: string;
            description: string;
            qty: number;
            unitPriceMinor: number;
            discountBps: number;
            lineTotalMinor: number;
            costMinor: number;
            lineType: import("@prisma/client").$Enums.LineType;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        customerId: string;
        status: import("@prisma/client").$Enums.QuotationStatus;
        currency: string;
        totalMinor: number;
        ownerUserId: string;
        subtotalMinor: number;
        discountMinor: number;
        taxMinor: number;
        marginBps: number;
        validUntil: Date | null;
        lastActivityAt: Date;
        portalToken: string | null;
    }>;
    /**
     * AUTO_APPROVED or APPROVED -> CONFIRMED, and copies the quote into a new
     * order (order_lines snapshot quotation_lines because the quote may still
     * change after the order exists - plan.md section 6).
     */
    confirm(quotationId: string, actor: AuthUser): Promise<{
        lines: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            orderId: string;
            productId: string;
            description: string;
            qty: number;
            unitPriceMinor: number;
            discountBps: number;
            lineTotalMinor: number;
            costMinor: number;
            lineType: import("@prisma/client").$Enums.LineType;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        quotationId: string;
        customerId: string;
        status: string;
        currency: string;
        totalMinor: number;
    }>;
}
