import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsObject, ValidateNested, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { RecurrenceDto } from './create-reminder.dto';

export class UpdateReminderDto {
  @ApiPropertyOptional({ description: 'Reminder title' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Extra message/detail' })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({ description: 'When the reminder should next fire (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: 'Repeat rule; set to null to make it one-off', type: RecurrenceDto })
  @IsObject()
  @ValidateNested()
  @Type(() => RecurrenceDto)
  @IsOptional()
  recurrence?: RecurrenceDto | null;
}
