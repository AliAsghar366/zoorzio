import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { ListType } from '@anchor/database';

export class UpdateListDto {
  @ApiPropertyOptional({ description: 'List name' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'List type', enum: ListType })
  @IsEnum(ListType)
  @IsOptional()
  type?: ListType;

  @ApiPropertyOptional({ description: 'Archive/unarchive the list' })
  @IsBoolean()
  @IsOptional()
  isArchived?: boolean;
}
