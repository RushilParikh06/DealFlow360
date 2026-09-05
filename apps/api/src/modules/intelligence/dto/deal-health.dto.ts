import { IsBooleanString, IsEnum, IsOptional } from 'class-validator';
import { DealHealthSeverity } from '@dealflow/contracts';

export class DealHealthQueryDto {
  @IsOptional()
  @IsEnum(DealHealthSeverity)
  severity?: (typeof DealHealthSeverity)[keyof typeof DealHealthSeverity];

  @IsOptional()
  @IsBooleanString()
  includeResolved?: string;
}
