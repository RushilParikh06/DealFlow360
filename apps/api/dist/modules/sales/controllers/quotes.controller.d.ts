import { type AuthUser } from '../../shared/current-user';
import { AddQuotationLineDto, CreateQuotationDto, ListQuotesQueryDto, UpdateQuotationLineDto } from '../dto/quote.dto';
import { QuotesService } from '../services/quotes.service';
export declare class QuotesController {
    private readonly quotes;
    constructor(quotes: QuotesService);
    list(query: ListQuotesQueryDto): Promise<import("@dealflow/contracts").Paginated<unknown>>;
    get(id: string): Promise<{
        lines: {
            id: string;
            quotationId: string;
            createdAt: Date;
            updatedAt: Date;
            productId: string;
            description: string;
            qty: number;
            unitPriceMinor: number;
            discountBps: number;
            lineTotalMinor: number;
            costMinor: number;
            lineType: import("@prisma/client").$Enums.LineType;
        }[];
        customer: {
            tier: {
                id: string;
                code: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            tierId: string;
            email: string | null;
        };
    } & {
        id: string;
        code: string;
        customerId: string;
        status: import("@prisma/client").$Enums.QuotationStatus;
        currency: string;
        totalMinor: number;
        createdAt: Date;
        updatedAt: Date;
        portalToken: string | null;
        ownerUserId: string;
        subtotalMinor: number;
        discountMinor: number;
        taxMinor: number;
        marginBps: number;
        validUntil: Date | null;
        lastActivityAt: Date;
    }>;
    create(dto: CreateQuotationDto, actor: AuthUser): Promise<{
        id: string;
        code: string;
        customerId: string;
        status: import("@prisma/client").$Enums.QuotationStatus;
        currency: string;
        totalMinor: number;
        createdAt: Date;
        updatedAt: Date;
        portalToken: string | null;
        ownerUserId: string;
        subtotalMinor: number;
        discountMinor: number;
        taxMinor: number;
        marginBps: number;
        validUntil: Date | null;
        lastActivityAt: Date;
    }>;
    addLine(id: string, dto: AddQuotationLineDto): Promise<{
        id: string;
        quotationId: string;
        createdAt: Date;
        updatedAt: Date;
        productId: string;
        description: string;
        qty: number;
        unitPriceMinor: number;
        discountBps: number;
        lineTotalMinor: number;
        costMinor: number;
        lineType: import("@prisma/client").$Enums.LineType;
    }>;
    updateLine(id: string, lineId: string, dto: UpdateQuotationLineDto): Promise<{
        id: string;
        quotationId: string;
        createdAt: Date;
        updatedAt: Date;
        productId: string;
        description: string;
        qty: number;
        unitPriceMinor: number;
        discountBps: number;
        lineTotalMinor: number;
        costMinor: number;
        lineType: import("@prisma/client").$Enums.LineType;
    }>;
    deleteLine(id: string, lineId: string): Promise<void>;
    submit(id: string, actor: AuthUser): Promise<{
        lines: {
            id: string;
            quotationId: string;
            createdAt: Date;
            updatedAt: Date;
            productId: string;
            description: string;
            qty: number;
            unitPriceMinor: number;
            discountBps: number;
            lineTotalMinor: number;
            costMinor: number;
            lineType: import("@prisma/client").$Enums.LineType;
        }[];
        customer: {
            tier: {
                id: string;
                code: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            tierId: string;
            email: string | null;
        };
    } & {
        id: string;
        code: string;
        customerId: string;
        status: import("@prisma/client").$Enums.QuotationStatus;
        currency: string;
        totalMinor: number;
        createdAt: Date;
        updatedAt: Date;
        portalToken: string | null;
        ownerUserId: string;
        subtotalMinor: number;
        discountMinor: number;
        taxMinor: number;
        marginBps: number;
        validUntil: Date | null;
        lastActivityAt: Date;
    }>;
    confirm(id: string, actor: AuthUser): Promise<{
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
        code: string;
        quotationId: string;
        customerId: string;
        status: string;
        currency: string;
        totalMinor: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
