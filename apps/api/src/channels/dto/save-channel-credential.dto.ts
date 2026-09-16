import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class SaveChannelCredentialDto {
  @IsString()
  @MinLength(10)
  token!: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  secondaryToken?: string;

  @IsOptional()
  @IsEmail()
  fromEmail?: string;

  /** WhatsApp only: the Business phone number id this token sends/receives on. */
  @IsOptional()
  @IsString()
  phoneNumberId?: string;
}
