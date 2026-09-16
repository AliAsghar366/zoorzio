import { IsString, IsOptional, IsDateString, MinLength, MaxLength } from 'class-validator';

export class SendFriendReminderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}
