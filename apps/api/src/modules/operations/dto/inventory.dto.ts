// B3 owned. Query DTOs are classes, not inline types: ValidationPipe can only
// transform page/pageSize into numbers when there is a class to reflect on,
// and Prisma rejects a string where it wants an Int.
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class ListInventoryQueryDto {
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

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

export class ReserveInventoryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty!: number;

  /// Every movement row has to say why it happened; a blank reason defeats the ledger.
  @IsString()
  @MinLength(1)
  reason!: string;
}
