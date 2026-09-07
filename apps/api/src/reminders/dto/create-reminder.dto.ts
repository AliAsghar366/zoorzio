import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsObject,
  ValidateNested,
  IsEnum,
  IsInt,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum RecurrenceFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export class RecurrenceDto {
  @ApiProperty({ enum: RecurrenceFrequency })
  @IsEnum(RecurrenceFrequency)
  freq: RecurrenceFrequency;

  @ApiPropertyOptional({ description: 'Repeat every N units (default 1)', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  interval?: number;
}

export class CreateReminderDto {
  @ApiProperty({ description: 'Reminder title', example: 'Take medicine' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Extra message/detail' })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  message?: string;

  @ApiProperty({ description: 'When the reminder should first fire (ISO 8601)' })
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({ description: 'Repeat rule; omit for a one-off reminder', type: RecurrenceDto })
  @IsObject()
  @ValidateNested()
  @Type(() => RecurrenceDto)
  @IsOptional()
  recurrence?: RecurrenceDto;

  @ApiPropertyOptional({ description: 'Link to a task' })
  @IsString()
  @IsOptional()
  taskId?: string;

  @ApiPropertyOptional({ description: 'Link to a memory' })
  @IsString()
  @IsOptional()
  memoryId?: string;
}
