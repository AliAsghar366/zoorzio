import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class CreateVoiceMemoryDto {
  @ApiProperty({ description: 'Base64-encoded audio recording' })
  @IsString()
  @IsNotEmpty({ message: 'audioBase64 is required' })
  audioBase64: string;

  @ApiPropertyOptional({ description: 'Tags to attach to the resulting memory', type: [String] })
  @IsArray()
  @IsOptional()
  tags?: string[];
}
