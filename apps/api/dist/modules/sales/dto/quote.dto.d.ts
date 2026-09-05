import { QuotationStatus } from '@dealflow/contracts';
export declare class ListQuotesQueryDto {
    status?: (typeof QuotationStatus)[keyof typeof QuotationStatus];
    customerId?: string;
    ownerUserId?: string;
    page?: number;
    pageSize?: number;
}
/** A class, not an inline type: without one, ValidationPipe cannot transform
 *  page/pageSize and Prisma is handed a string where it wants an Int. */
export declare class ListOrdersQueryDto {
    status?: string;
    customerId?: string;
    page?: number;
    pageSize?: number;
}
export declare class CreateQuotationDto {
    customerId: string;
    currency: string;
}
/**
 * plan.md section 8: `POST /quotes/:id/lines { productId, qty, discountBps }`.
 * Price, cost, description and lineType are deliberately NOT accepted from the
 * client - the service reads them off the product. Letting the browser send
 * costMinor would hand it control of the margin B2 scores risk on, and with it
 * the approval routing (invariant 2).
 */
export declare class AddQuotationLineDto {
    productId: string;
    qty: number;
    discountBps?: number;
}
export declare class UpdateQuotationLineDto {
    qty?: number;
    discountBps?: number;
    description?: string;
}
