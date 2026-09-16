import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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
  @ApiOperation({
    summary:
      '[Admin] Status of the unofficial QR-linked WhatsApp connection, including the QR code while pairing',
  })
  @ApiResponse({ status: 200, description: 'Connection status' })
  getStatus() {
    return this.service.getStatus();
  }

  @Post('connect')
  @ApiOperation({
    summary:
      '[Admin] Start pairing (or resume an existing session) - poll GET status for the QR code',
  })
  @ApiResponse({ status: 201, description: 'Pairing started' })
  async connect() {
    await this.service.connect();
    return this.service.getStatus();
  }

  @Post('reconnect')
  @ApiOperation({
    summary:
      '[Admin] Drop the current socket and reconnect using the stored session - for when status says CONNECTED but nothing is arriving',
  })
  @ApiResponse({ status: 201, description: 'Reconnect attempted' })
  async reconnect() {
    // connect() returns immediately while a socket handle exists, so a stale
    // one left the only remedy as unlink-and-rescan. This forces a fresh
    // socket from the credentials already stored - no QR needed.
    await this.service.connect(true);
    return this.service.getStatus();
  }

  @Post('test-message')
  @ApiOperation({
    summary: '[Admin] Send a message to a number to check the outbound path works',
  })
  @ApiResponse({ status: 201, description: 'Message sent' })
  async testMessage(@Body() body: { to: string; message?: string }) {
    // Deliberately not wrapped: a failure here should surface, since the whole
    // point is to find out why replies are not arriving.
    return this.service.sendTestMessage(
      body.to,
      body.message || 'Test message from Zoorzio - outbound is working.',
    );
  }

  @Post('logout')
  @ApiOperation({ summary: '[Admin] Unlink the device and clear all stored session data' })
  @ApiResponse({ status: 201, description: 'Logged out' })
  async logout() {
    await this.service.logout();
    return this.service.getStatus();
  }
}
