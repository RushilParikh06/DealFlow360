import { ListOrdersQueryDto } from '../dto/quote.dto';
import { OrdersService } from '../services/orders.service';
export declare class OrdersController {
    private readonly orders;
    constructor(orders: OrdersService);
    list(query: ListOrdersQueryDto): Promise<import("@dealflow/contracts").Paginated<unknown>>;
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
