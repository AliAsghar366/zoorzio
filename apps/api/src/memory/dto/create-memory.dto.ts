import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsArray, IsObject } from 'class-validator';
import { MemoryType, ChannelType } from '@anchor/database';

export { MemoryType, ChannelType };

export class CreateMemoryDto {
  @ApiProperty({ description: 'Memory content', example: 'Meeting with John at 3pm tomorrow' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Memory type', enum: MemoryType, default: MemoryType.NOTE })
  @IsEnum(MemoryType)
  @IsOptional()
  type?: MemoryType;

  @ApiPropertyOptional({ description: 'Source channel', enum: ChannelType, default: ChannelType.NATIVE_APP })
  @IsEnum(ChannelType)
  @IsOptional()
  source?: ChannelType;

  @ApiPropertyOptional({ description: 'Additional metadata', example: { sender: 'John' } })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Tags', example: ['meeting', 'work'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
