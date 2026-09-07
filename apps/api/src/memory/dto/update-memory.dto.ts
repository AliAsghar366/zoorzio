import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsArray, IsObject, IsBoolean } from 'class-validator';
import { MemoryType, ChannelType } from './create-memory.dto';

export class UpdateMemoryDto {
  @ApiPropertyOptional({ description: 'Mark as reviewed/kept during memory cleanup' })
  @IsBoolean()
  @IsOptional()
  isVerified?: boolean;

  @ApiPropertyOptional({ description: 'Memory content' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ description: 'Memory type', enum: MemoryType })
  @IsEnum(MemoryType)
  @IsOptional()
  type?: MemoryType;

  @ApiPropertyOptional({ description: 'Source channel', enum: ChannelType })
  @IsEnum(ChannelType)
  @IsOptional()
  source?: ChannelType;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Tags' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
