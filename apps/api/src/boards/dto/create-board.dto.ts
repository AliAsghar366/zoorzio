import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBoardDto {
  @ApiProperty({ description: 'Board name', example: 'Weekend trip' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}
