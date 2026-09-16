import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ description: 'Calendar to add this event to' })
  @IsString()
  @IsNotEmpty({ message: 'calendarId is required' })
  calendarId: string;

  @ApiProperty({ description: 'Event title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ description: 'ISO 8601 start time' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ description: 'ISO 8601 end time' })
  @IsDateString()
  endTime: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  allDay?: boolean;
}
