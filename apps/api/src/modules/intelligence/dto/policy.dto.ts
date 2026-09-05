import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * All three numbers are basis points. 10000 bps = 100%.
 * Nothing here is a float, ever (plan.md invariant 1).
 */
export class UpdatePolicyDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  maxDiscountBps?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  requiresManagerAboveBps?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  requiresFinanceAboveBps?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
