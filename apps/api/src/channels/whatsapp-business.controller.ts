import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@anchor/database';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminIpGuard } from '../common/guards/admin-ip.guard';
import { WhatsAppBusinessConnectionService } from './whatsapp-business-connection.service';
import { ConnectWhatsAppBusinessDto } from './dto/connect-whatsapp-business.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AdminIpGuard)
@Controller('admin/whatsapp-business')
export class WhatsAppBusinessController {
  constructor(private readonly connections: WhatsAppBusinessConnectionService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] WhatsApp Business numbers connected through Embedded Signup' })
  @ApiResponse({ status: 200, description: 'Connections (tokens are never returned)' })
  list() {
    return this.connections.listConnections();
  }

  @Post('connect')
  @ApiOperation({
    summary: '[Admin] Finish connecting a WhatsApp Business app number after Embedded Signup',
  })
  @ApiResponse({ status: 201, description: 'Number connected and syncs started' })
  connect(@Request() req: any, @Body() dto: ConnectWhatsAppBusinessDto) {
    return this.connections.connect(req.user.id, dto);
  }

  @Post(':id/sync/:kind')
  @ApiOperation({ summary: '[Admin] Retry a contacts or history sync that failed to start' })
  @ApiResponse({ status: 201, description: 'Sync requested' })
  startSync(@Param('id') id: string, @Param('kind') kind: string) {
    if (kind !== 'contacts' && kind !== 'history') {
      throw new BadRequestException('kind must be "contacts" or "history"');
    }
    return this.connections.startSync(id, kind);
  }
}
