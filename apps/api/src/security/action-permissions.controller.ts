import { Body, Controller, Get, Param, Put, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ActionPolicyService } from './action-policy.service';
import { SetActionPermissionDto } from './dto/set-action-permission.dto';

@ApiTags('action-permissions')
@ApiBearerAuth()
@Controller('action-permissions')
export class ActionPermissionsController {
  constructor(private readonly actionPolicy: ActionPolicyService) {}

  @Get()
  @ApiOperation({ summary: 'List which actions run automatically and which ask first' })
  @ApiResponse({ status: 200, description: 'Action permissions' })
  list(@Request() req: any) {
    return this.actionPolicy.listForUser(req.user.id);
  }

  @Put(':toolName')
  @ApiOperation({ summary: 'Set whether an action runs automatically or asks for confirmation' })
  @ApiResponse({ status: 200, description: 'Permission updated' })
  setMode(
    @Request() req: any,
    @Param('toolName') toolName: string,
    @Body() dto: SetActionPermissionDto,
  ) {
    return this.actionPolicy.setMode(req.user.id, toolName, dto.mode);
  }
}
