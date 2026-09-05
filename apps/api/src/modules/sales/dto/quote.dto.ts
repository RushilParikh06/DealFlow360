import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { LineType, QuotationStatus } from '@dealflow/contracts';

export class ListQuotesQueryDto {
  @IsOptional()
  @IsEnum(QuotationStatus)
  status?: (typeof QuotationStatus)[keyof typeof QuotationStatus];

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

/** A class, not an inline type: without one, ValidationPipe cannot transform
 *  page/pageSize and Prisma is handed a string where it wants an Int. */
export class ListOrdersQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class CreateQuotationDto {
  @IsString()
  customerId!: string;

  @IsString()
  currency!: string;
}

/**
 * plan.md section 8: `POST /quotes/:id/lines { productId, qty, discountBps }`.
 * Price, cost, description and lineType are deliberately NOT accepted from the
 * client - the service reads them off the product. Letting the browser send
 * costMinor would hand it control of the margin B2 scores risk on, and with it
 * the approval routing (invariant 2).
 */
export class AddQuotationLineDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  qty!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  discountBps?: number;
}

export class UpdateQuotationLineDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  qty?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  discountBps?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;
}
