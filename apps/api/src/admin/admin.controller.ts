import { Body, Controller, Get, Param, Patch, Post, Query, Request, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@anchor/database';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminIpGuard } from '../common/guards/admin-ip.guard';
import { AdminService } from './admin.service';
import { SetUserPlanDto } from './dto/set-user-plan.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(AdminIpGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: '[Admin] List all users on the platform' })
  @ApiResponse({ status: 200, description: 'List of users' })
  listUsers() {
    return this.adminService.listUsers();
  }

  @Get('stats')
  @ApiOperation({ summary: '[Admin] Platform-wide usage statistics' })
  @ApiResponse({ status: 200, description: 'Platform stats' })
  getStats() {
    return this.adminService.getStats();
  }

  @Get('audit-logs')
  @ApiOperation({ summary: '[Admin] Platform-wide audit log (logins, password resets, etc.)' })
  @ApiResponse({ status: 200, description: 'Audit log entries' })
  getAuditLogs(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.adminService.getAuditLogs(limit ? Number(limit) : undefined, offset ? Number(offset) : undefined);
  }

  @Get('audit-logs/export')
  @ApiOperation({ summary: '[Admin] Download the platform-wide audit log as CSV' })
  @ApiResponse({ status: 200, description: 'CSV file' })
  async exportAuditLogs(@Res() res: Response) {
    const csv = await this.adminService.exportAuditLogsCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${Date.now()}.csv"`);
    res.send(csv);
  }

  @Patch('users/:id/plan')
  @ApiOperation({ summary: '[Admin] Override a user\'s plan without touching Stripe (comp account, downgrade, etc.)' })
  @ApiResponse({ status: 200, description: 'Plan updated' })
  setUserPlan(@Request() req: any, @Param('id') id: string, @Body() dto: SetUserPlanDto) {
    return this.adminService.setUserPlan(req.user.id, id, dto.planId);
  }

  @Post('users/:id/impersonate')
  @ApiOperation({ summary: '[Admin] Start a short-lived (15m) impersonation session for a user' })
  @ApiResponse({ status: 200, description: 'Impersonation access token issued' })
  impersonate(@Request() req: any, @Param('id') id: string) {
    return this.adminService.impersonate(req.user.id, id);
  }
}
