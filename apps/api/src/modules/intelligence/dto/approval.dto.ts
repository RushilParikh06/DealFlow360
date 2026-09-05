import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApprovalActionType, ApprovalStatus, ApproverRole } from '@dealflow/contracts';

export class ListApprovalsQueryDto {
  /** ADMIN/FINANCE may pass this to widen the queue; reps always see their own. */
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

  @IsOptional()
  @IsEnum(ApproverRole)
  role?: (typeof ApproverRole)[keyof typeof ApproverRole];

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

export class ApprovalActionDto {
  @IsEnum(ApprovalActionType)
  action!: (typeof ApprovalActionType)[keyof typeof ApprovalActionType];

  /** Required for REJECT and RETURN. The service enforces that; this only bounds it. */
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason?: string;
}
