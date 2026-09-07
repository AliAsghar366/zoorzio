import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { ShareResourceType, SharePermission } from '@anchor/database';

export class CreateShareDto {
  @ApiProperty({ enum: ShareResourceType })
  @IsIn(['LIST', 'REMINDER'])
  resourceType: ShareResourceType;

  @ApiProperty({ description: 'ID of the List or Reminder to share' })
  @IsString()
  resourceId: string;

  @ApiProperty({ description: 'Email of the Zoorzio user to share with' })
  @IsEmail()
  targetEmail: string;

  @ApiPropertyOptional({ enum: SharePermission, default: 'VIEW' })
  @IsEnum(SharePermission)
  @IsOptional()
  permission?: SharePermission;
}
