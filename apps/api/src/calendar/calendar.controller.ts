import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Request,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { CalendarService } from './calendar.service';
import { CalendarOAuthService } from './calendar-oauth.service';
import { Public } from '../common/decorators/public.decorator';
import { CreateEventDto } from './dto/create-event.dto';

@ApiTags('Calendar')
@ApiBearerAuth()
@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly oauthService: CalendarOAuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('google/authorize')
  @ApiOperation({ summary: 'Get the Google consent-screen URL to connect Google Calendar' })
  @ApiResponse({ status: 200, description: 'Returns the URL to redirect the browser to' })
  googleAuthorize(@Request() req: any) {
    return { url: this.oauthService.buildGoogleAuthUrl(req.user.id) };
  }

  @Get('google/callback')
  @Public()
  @ApiOperation({ summary: 'Google OAuth redirect target - exchanges the code and connects the calendar' })
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    if (error) {
      return res.redirect(`${frontendUrl}/calendar?provider=google&status=error&message=${encodeURIComponent(error)}`);
    }
    try {
      const { userId } = this.oauthService.verifyState(state);
      const tokens = await this.oauthService.exchangeGoogleCode(code);
      await this.calendarService.connectGoogleCalendar(userId, tokens.accessToken, tokens.refreshToken);
      return res.redirect(`${frontendUrl}/calendar?provider=google&status=connected`);
    } catch (err: any) {
      return res.redirect(
        `${frontendUrl}/calendar?provider=google&status=error&message=${encodeURIComponent(err?.message || 'Connection failed')}`,
      );
    }
  }

  @Get('outlook/authorize')
  @ApiOperation({ summary: 'Get the Microsoft consent-screen URL to connect Outlook Calendar' })
  @ApiResponse({ status: 200, description: 'Returns the URL to redirect the browser to' })
  outlookAuthorize(@Request() req: any) {
    return { url: this.oauthService.buildOutlookAuthUrl(req.user.id) };
  }

  @Get('outlook/callback')
  @Public()
  @ApiOperation({ summary: 'Outlook OAuth redirect target - exchanges the code and connects the calendar' })
  async outlookCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    if (error) {
      return res.redirect(`${frontendUrl}/calendar?provider=outlook&status=error&message=${encodeURIComponent(error)}`);
    }
    try {
      const { userId } = this.oauthService.verifyState(state);
      const tokens = await this.oauthService.exchangeOutlookCode(code);
      await this.calendarService.connectOutlookCalendar(userId, tokens.accessToken, tokens.refreshToken);
      return res.redirect(`${frontendUrl}/calendar?provider=outlook&status=connected`);
    } catch (err: any) {
      return res.redirect(
        `${frontendUrl}/calendar?provider=outlook&status=error&message=${encodeURIComponent(err?.message || 'Connection failed')}`,
      );
    }
  }

  @Post('google/connect')
  @ApiOperation({ summary: 'Connect Google Calendar' })
  @ApiResponse({ status: 201, description: 'Google Calendar connected' })
  async connectGoogle(
    @Request() req: any,
    @Body() body: { accessToken: string; refreshToken: string },
  ) {
    return this.calendarService.connectGoogleCalendar(
      req.user.id,
      body.accessToken,
      body.refreshToken,
    );
  }

  @Post('outlook/connect')
  @ApiOperation({ summary: 'Connect Outlook Calendar' })
  @ApiResponse({ status: 201, description: 'Outlook Calendar connected' })
  async connectOutlook(
    @Request() req: any,
    @Body() body: { accessToken: string; refreshToken: string },
  ) {
    return this.calendarService.connectOutlookCalendar(
      req.user.id,
      body.accessToken,
      body.refreshToken,
    );
  }

  @Post('google/sync')
  @ApiOperation({ summary: 'Sync Google Calendar' })
  @ApiResponse({ status: 200, description: 'Calendar synced' })
  async syncGoogle(@Request() req: any) {
    return this.calendarService.syncGoogleCalendar(req.user.id);
  }

  @Post('outlook/sync')
  @ApiOperation({ summary: 'Sync Outlook Calendar' })
  @ApiResponse({ status: 200, description: 'Calendar synced' })
  async syncOutlook(@Request() req: any) {
    return this.calendarService.syncOutlookCalendar(req.user.id);
  }

  @Post('apple/connect')
  @ApiOperation({
    summary: 'Connect Apple/iCloud Calendar via CalDAV',
    description:
      'Requires an app-specific password generated at appleid.apple.com (Apple has no OAuth API for third-party calendar access).',
  })
  @ApiResponse({ status: 201, description: 'Apple Calendar connected' })
  async connectApple(@Request() req: any, @Body() body: { username: string; appPassword: string }) {
    return this.calendarService.connectAppleCalendar(req.user.id, body.username, body.appPassword);
  }

  @Post('apple/sync')
  @ApiOperation({ summary: 'Sync Apple Calendar' })
  @ApiResponse({ status: 200, description: 'Calendar synced' })
  async syncApple(@Request() req: any) {
    return this.calendarService.syncAppleCalendar(req.user.id);
  }

  @Get('events')
  @ApiOperation({ summary: 'Get calendar events' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date' })
  @ApiResponse({ status: 200, description: 'Return calendar events' })
  async getEvents(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.calendarService.getEvents(
      req.user.id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's events" })
  @ApiResponse({ status: 200, description: "Return today's events" })
  async getToday(@Request() req: any) {
    return this.calendarService.getTodayEvents(req.user.id);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming events' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days' })
  @ApiResponse({ status: 200, description: 'Return upcoming events' })
  async getUpcoming(@Request() req: any, @Query('days') days?: number) {
    return this.calendarService.getUpcomingEvents(req.user.id, days || 7);
  }

  @Get('health')
  @ApiOperation({ summary: 'Get calendar sync health' })
  @ApiResponse({ status: 200, description: 'Return sync health status' })
  async getHealth(@Request() req: any) {
    return this.calendarService.getCalendarHealth(req.user.id);
  }

  @Post('events')
  @ApiOperation({ summary: 'Create calendar event' })
  @ApiResponse({ status: 201, description: 'Event created' })
  async createEvent(@Request() req: any, @Body() body: CreateEventDto) {
    return this.calendarService.createEvent(req.user.id, body.calendarId, body);
  }

  @Delete('events/:id')
  @ApiOperation({ summary: 'Delete calendar event' })
  @ApiResponse({ status: 200, description: 'Event deleted' })
  async deleteEvent(@Request() req: any, @Param('id') id: string) {
    return this.calendarService.deleteEvent(req.user.id, id);
  }
}
