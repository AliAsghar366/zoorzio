import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@anchor/database';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminIpGuard } from '../common/guards/admin-ip.guard';
import { WhatsAppUnofficialService } from './whatsapp-unofficial.service';

/**
 * Admin-only controls for the unofficial, QR-linked WhatsApp connection - see
 * WhatsAppUnofficialService for what this actually is and the risk it carries.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AdminIpGuard)
@Controller('admin/whatsapp-unofficial')
export class WhatsAppUnofficialController {
  constructor(private readonly service: WhatsAppUnofficialService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Status of the unofficial QR-linked WhatsApp connection, including the QR code while pairing' })
  @ApiResponse({ status: 200, description: 'Connection status' })
  getStatus() {
    return this.service.getStatus();
  }

  @Post('connect')
  @ApiOperation({ summary: '[Admin] Start pairing (or resume an existing session) - poll GET status for the QR code' })
  @ApiResponse({ status: 201, description: 'Pairing started' })
  async connect() {
    await this.service.connect();
    return this.service.getStatus();
  }

  @Post('logout')
  @ApiOperation({ summary: '[Admin] Unlink the device and clear all stored session data' })
  @ApiResponse({ status: 201, description: 'Logged out' })
  async logout() {
    await this.service.logout();
    return this.service.getStatus();
  }
}
