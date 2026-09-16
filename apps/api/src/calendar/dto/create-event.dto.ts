import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsArray,
  IsEmail,
} from 'class-validator';

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

  @ApiPropertyOptional({
    description:
      'Email addresses to invite. Only delivered when the calendar is a connected Google or ' +
      'Outlook account - a LOCAL calendar cannot send invitations.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  attendees?: string[];

  @ApiPropertyOptional({
    description: 'Add a Google Meet link (connected Google calendars only). Defaults to true.',
  })
  @IsOptional()
  @IsBoolean()
  withMeet?: boolean;

  @ApiPropertyOptional({ description: 'IANA timezone for the times, e.g. Europe/London' })
  @IsOptional()
  @IsString()
  timezone?: string;
}
