import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ListType } from '@anchor/database';

export { ListType };

export class CreateListDto {
  @ApiProperty({ description: 'List name', example: 'Groceries' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'List type', enum: ListType, default: ListType.CUSTOM })
  @IsEnum(ListType)
  @IsOptional()
  type?: ListType;
}
