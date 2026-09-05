import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class EvaluationHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;
}
