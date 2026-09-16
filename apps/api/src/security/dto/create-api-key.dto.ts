import { IsString, IsOptional, IsBoolean, IsInt, Min, Max, MinLength } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsOptional()
  @IsBoolean()
  write?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}
