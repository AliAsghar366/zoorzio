import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, MinLength, MaxLength, IsOptional, Matches, IsBoolean, Equals } from 'class-validator';

// Generous enough for a compressed profile-photo data URI (roughly a 1.5MB
// image once base64-encoded), small enough to reject someone pasting an
// unreasonably large payload into this field.
const MAX_AVATAR_DATA_URI_LENGTH = 2_000_000;

export class RegisterDto {
  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password', example: 'SecureP@ssw0rd' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;

  @ApiPropertyOptional({ description: 'User name', example: 'John Doe' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+923001234567' })
  @IsString()
  @IsOptional()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format',
  })
  phone?: string;

  @ApiPropertyOptional({ description: 'City/region, shown on the profile', example: 'Karachi, Pakistan' })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ description: 'Optional profile picture as a data URI' })
  @IsString()
  @MaxLength(MAX_AVATAR_DATA_URI_LENGTH)
  @IsOptional()
  avatar?: string;

  // Enforced server-side, not just in the signup form's UI - a request that
  // omits this or sends anything other than `true` is rejected before an
  // account is ever created (see AuthService.register). This is what makes
  // the checkbox a real gate rather than a decoration a direct API call
  // could bypass.
  @ApiProperty({
    description: 'Must be true - confirms the user has read and accepted the Privacy Policy. Registration is rejected otherwise.',
    example: true,
  })
  @IsBoolean()
  @Equals(true, { message: 'You must accept the Privacy Policy to create an account' })
  acceptedPrivacyPolicy: boolean;
}
