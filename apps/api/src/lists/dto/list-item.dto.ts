import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';

export class CreateListItemDto {
  @ApiProperty({ description: 'Item content', example: 'Milk' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content: string;
}

export class UpdateListItemDto {
  @ApiPropertyOptional({ description: 'Item content' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ description: 'Whether the item is checked off' })
  @IsBoolean()
  @IsOptional()
  isChecked?: boolean;
}
