import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ConvertLeadDto {
  @IsString()
  @IsOptional()
  dealTitle?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  dealValue?: number;

  @IsString()
  @IsOptional()
  pipeline?: string;

  @IsString()
  @IsOptional()
  expectedCloseDate?: string;
}
