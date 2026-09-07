import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CheckoutDto {
  @ApiProperty({ description: 'ID of the plan to subscribe to' })
  @IsString()
  planId: string;
}
