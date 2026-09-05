// B3 owned. The status enums here mirror the transition tables in the engine
// files. Validation rejects a nonsense value at the edge; the engine still
// rejects a legal value arriving from the wrong state, which is the part that
// needs the current row to decide.
import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

const FULFILLMENT_STATUSES = [
  'ORDER_CONFIRMED',
  'INVENTORY_RESERVED',
  'PICKING',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'BACKORDERED',
] as const;

const SUBSCRIPTION_STATUSES = ['ACTIVE', 'PAUSED', 'CANCELLED'] as const;

class PagedQueryDto {
  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  status?: string;

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

export class ListFulfillmentsQueryDto extends PagedQueryDto {}
export class ListInvoicesQueryDto extends PagedQueryDto {}
export class ListSubscriptionsQueryDto extends PagedQueryDto {}

export class AdvanceFulfillmentDto {
  @IsIn(FULFILLMENT_STATUSES)
  status!: (typeof FULFILLMENT_STATUSES)[number];
}

export class TransitionSubscriptionDto {
  @IsIn(SUBSCRIPTION_STATUSES)
  status!: (typeof SUBSCRIPTION_STATUSES)[number];
}

export class RecordPaymentDto {
  /// Minor units. Money never arrives as a float (plan.md invariant 1).
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsString()
  @MinLength(1)
  method!: string;

  @IsString()
  @MinLength(1)
  reference!: string;
}
