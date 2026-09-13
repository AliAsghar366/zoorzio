import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const NUMERIC_ID = /^\d+$/;

export class ConnectWhatsAppBusinessDto {
  @ApiProperty({ description: 'Code returned by Embedded Signup - valid for about 30 seconds' })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  code: string;

  @ApiProperty({ description: 'phone_number_id from the Embedded Signup session event' })
  @Matches(NUMERIC_ID, { message: 'phoneNumberId must be numeric' })
  phoneNumberId: string;

  @ApiProperty({ description: 'waba_id from the Embedded Signup session event' })
  @Matches(NUMERIC_ID, { message: 'wabaId must be numeric' })
  wabaId: string;

  @ApiPropertyOptional({ description: 'business_id from the Embedded Signup session event' })
  @IsOptional()
  @Matches(NUMERIC_ID, { message: 'businessId must be numeric' })
  businessId?: string;
}
