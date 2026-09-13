import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateContactDto {
  @ApiProperty({ description: 'Who this is', example: 'Ahmed Khan' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({
    description: 'Email address, used when sending mail or inviting to a meeting',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number in international format',
    example: '+447848472822',
  })
  @IsString()
  @MaxLength(32)
  @IsOptional()
  phone?: string;
}
