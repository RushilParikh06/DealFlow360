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

export class CreateQuotationDto {
  @IsString()
  customerId!: string;

  @IsString()
  currency!: string;
}

export class AddQuotationLineDto {
  @IsString()
  productId!: string;

  @IsString()
  description!: string;

  @IsInt()
  @Min(1)
  qty!: number;

  @IsInt()
  @Min(0)
  unitPriceMinor!: number;

  @IsInt()
  @Min(0)
  costMinor!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  discountBps?: number;

  @IsOptional()
  @IsEnum(LineType)
  lineType?: (typeof LineType)[keyof typeof LineType];
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
