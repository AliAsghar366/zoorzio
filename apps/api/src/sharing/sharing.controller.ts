import { Body, Controller, Delete, Get, Param, Post, Query, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ShareResourceType } from '@anchor/database';
import { SharingService } from './sharing.service';
import { CreateShareDto } from './dto/create-share.dto';

@ApiTags('sharing')
@ApiBearerAuth()
@Controller('sharing')
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @Post()
  @ApiOperation({ summary: 'Share a List or Reminder with another Zoorzio user by email' })
  @ApiResponse({ status: 201, description: 'Share created' })
  share(@Request() req: any, @Body() dto: CreateShareDto) {
    return this.sharingService.share(req.user.id, dto);
  }

  @Get('shared-with-me')
  @ApiOperation({ summary: 'List resources other users have shared with you' })
  @ApiResponse({ status: 200, description: 'Shared resources' })
  sharedWithMe(@Request() req: any, @Query('resourceType') resourceType?: ShareResourceType) {
    return this.sharingService.listSharedWithMe(req.user.id, resourceType);
  }

  @Get('resource/:resourceType/:resourceId')
  @ApiOperation({ summary: 'List who a resource you own is shared with' })
  @ApiResponse({ status: 200, description: 'Shares for the resource' })
  sharesForResource(
    @Request() req: any,
    @Param('resourceType') resourceType: ShareResourceType,
    @Param('resourceId') resourceId: string,
  ) {
    return this.sharingService.listSharesForResource(req.user.id, resourceType, resourceId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a share you created' })
  @ApiResponse({ status: 200, description: 'Share revoked' })
  revoke(@Request() req: any, @Param('id') id: string) {
    return this.sharingService.revoke(req.user.id, id);
  }
}
