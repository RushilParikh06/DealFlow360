import { type Paginated } from '@dealflow/contracts';
import { PrismaService } from '../../shared/prisma.service';
import type { ListOrdersQueryDto } from '../dto/quote.dto';
export declare class OrdersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(query: ListOrdersQueryDto): Promise<Paginated<unknown>>;
    get(id: string): Promise<{
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
