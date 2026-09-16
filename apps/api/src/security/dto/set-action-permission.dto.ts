import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ActionPermissionMode } from '@anchor/database';

export class SetActionPermissionDto {
  @ApiProperty({
    enum: ActionPermissionMode,
    description: 'AUTO runs the action straight away; CONFIRM asks you first.',
  })
  @IsEnum(ActionPermissionMode)
  mode: ActionPermissionMode;
}
