import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsArray, IsNumber, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { MemoryType, ChannelType } from './create-memory.dto';

export class QueryMemoryDto {
  @ApiPropertyOptional({
    description: 'Filter by review status: "true" for kept/verified memories, "false" for the cleanup queue',
    enum: ['true', 'false'],
  })
  @IsIn(['true', 'false'])
  @IsOptional()
  isVerified?: string;

  @ApiPropertyOptional({ description: 'Filter by memory type', enum: MemoryType })
  @IsEnum(MemoryType)
  @IsOptional()
  type?: MemoryType;

  @ApiPropertyOptional({ description: 'Filter by source channel', enum: ChannelType })
  @IsEnum(ChannelType)
  @IsOptional()
  source?: ChannelType;

  @ApiPropertyOptional({ description: 'Filter by tags', example: ['work', 'meeting'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Search query' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Max results per page', default: 20, minimum: 1, maximum: 100 })
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Offset for pagination', default: 0, minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  offset?: number;
}
