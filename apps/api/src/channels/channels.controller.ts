import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Request,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';
import { WhatsAppService } from './whatsapp.service';
import { TelegramService } from './telegram.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { DiscordService } from './discord.service';
import { SlackService } from './slack.service';
import { ChannelLinkingService } from './channel-linking.service';
import { ChannelCredentialsService } from './channel-credentials.service';
import { SaveChannelCredentialDto } from './dto/save-channel-credential.dto';
import { Public } from '../common/decorators/public.decorator';
import { ChannelType } from '@anchor/database';

const CREDENTIAL_TYPES: Record<string, ChannelType> = {
  telegram: ChannelType.TELEGRAM,
  discord: ChannelType.DISCORD,
  slack: ChannelType.SLACK,
  whatsapp: ChannelType.WHATSAPP,
  email: ChannelType.EMAIL,
};

@ApiTags('Channels')
@Controller('channels')
export class ChannelsController {
  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly telegramService: TelegramService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly discordService: DiscordService,
    private readonly slackService: SlackService,
    private readonly channelLinking: ChannelLinkingService,
    private readonly channelCredentials: ChannelCredentialsService,
  ) {}

  private resolveCredentialType(type: string): ChannelType {
    const resolved = CREDENTIAL_TYPES[type.toLowerCase()];
    if (!resolved) throw new ForbiddenException(`Unsupported platform: ${type}`);
    return resolved;
  }

  // --- Per-user "bring your own bot" credentials ---

  @ApiBearerAuth()
  @Get('credentials')
  @ApiOperation({
    summary: 'List your own connected bot/API credentials (never returns the raw secret)',
  })
  @ApiResponse({ status: 200, description: 'List of saved credentials' })
  async listCredentials(@Request() req: any) {
    return this.channelCredentials.list(req.user.id);
  }

  @ApiBearerAuth()
  @Post(':type/credential')
  @ApiOperation({ summary: 'Save your own bot token/API key for a platform' })
  @ApiResponse({ status: 201, description: 'Credential saved' })
  async saveCredential(
    @Request() req: any,
    @Param('type') type: string,
    @Body() dto: SaveChannelCredentialDto,
  ) {
    const channelType = this.resolveCredentialType(type);
    const saved = await this.channelCredentials.saveCredential(req.user.id, channelType, dto);

    // Bring the credential live immediately, so saving a token is all the user
    // has to do. Telegram registers a webhook; Discord opens a Gateway socket.
    if (channelType === ChannelType.TELEGRAM) {
      await this.telegramService.registerWebhook(req.user.id);
    } else if (channelType === ChannelType.DISCORD) {
      await this.discordService.connectUserBot(req.user.id);
    }

    // Re-read so the response carries the status the connection attempt just
    // produced (ACTIVE / INVALID), not the PENDING snapshot from before it.
    return (await this.channelCredentials.getPublicCredential(req.user.id, channelType)) ?? saved;
  }

  @ApiBearerAuth()
  @Post(':type/credential/test')
  @ApiOperation({ summary: 'Test that your saved credential for a platform actually works' })
  @ApiResponse({ status: 200, description: 'Test result' })
  async testCredential(@Request() req: any, @Param('type') type: string) {
    return this.channelCredentials.testCredential(req.user.id, this.resolveCredentialType(type));
  }

  @ApiBearerAuth()
  @Delete(':type/credential')
  @ApiOperation({ summary: 'Remove your own bot/API credential for a platform' })
  @ApiResponse({ status: 200, description: 'Credential removed' })
  async removeCredential(@Request() req: any, @Param('type') type: string) {
    const channelType = this.resolveCredentialType(type);

    // Tear down the live connection *before* deleting the row, so a removed
    // credential can't keep receiving or sending after the user believes it's
    // gone.
    if (channelType === ChannelType.TELEGRAM) {
      await this.telegramService.unregisterWebhook(req.user.id);
    } else if (channelType === ChannelType.DISCORD) {
      await this.discordService.disconnectUserBot(req.user.id);
    }

    return this.channelCredentials.removeCredential(req.user.id, channelType);
  }

  // Per-user Telegram webhook - routed by an opaque, non-guessable key rather
  // than trusting anything in the request body, so this can't be spoofed into
  // resolving a different user's bot.
  @Public()
  @Post('telegram/webhook/:routingKey')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Per-user Telegram webhook handler' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handlePerUserTelegramWebhook(
    @Param('routingKey') routingKey: string,
    @Body() payload: any,
  ) {
    return this.telegramService.handleWebhookForRoutingKey(routingKey, payload);
  }

  // Per-user Slack Events API endpoint. Signature verification happens inside
  // the service, against the resolved user's own signing secret - a request
  // signed for one workspace must never validate against another's endpoint.
  @Public()
  @Post('slack/events/:routingKey')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Per-user Slack Events API webhook handler' })
  @ApiResponse({ status: 200, description: 'Event processed' })
  async handlePerUserSlackEvent(
    @Param('routingKey') routingKey: string,
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Body() payload: any,
    @Headers('x-slack-request-timestamp') timestamp: string,
    @Headers('x-slack-signature') signature: string,
  ) {
    const rawBody = (req.rawBody as Buffer)?.toString('utf8') ?? '';
    const result = await this.slackService.handleEventForRoutingKey(
      routingKey,
      payload,
      rawBody,
      timestamp,
      signature,
    );

    if (result.error === 'invalid_signature') {
      throw new ForbiddenException('Invalid Slack signature');
    }

    return result;
  }

  @ApiBearerAuth()
  @Get('linked')
  @ApiOperation({ summary: 'List the WhatsApp/Telegram channels linked to your account' })
  @ApiResponse({ status: 200, description: 'Linked channels' })
  async getLinkedChannels(@Request() req: any) {
    return this.channelLinking.getLinkedChannels(req.user.id);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Unlink a WhatsApp/Telegram channel from your account' })
  @ApiResponse({ status: 200, description: 'Channel unlinked' })
  async unlinkChannel(@Request() req: any, @Param('id') id: string) {
    return this.channelLinking.unlinkChannel(req.user.id, id);
  }

  @ApiBearerAuth()
  @Post('whatsapp/link')
  @ApiOperation({ summary: 'Generate a one-time code to link your WhatsApp number' })
  @ApiResponse({ status: 201, description: 'Returns a code and a wa.me link that sends it' })
  async createWhatsAppLink(@Request() req: any) {
    return this.channelLinking.createWhatsAppLinkCode(req.user.id);
  }

  @ApiBearerAuth()
  @Post('telegram/link')
  @ApiOperation({ summary: 'Generate a one-time deep link to link your Telegram account' })
  @ApiResponse({ status: 201, description: 'Returns a t.me deep link' })
  async createTelegramLink(@Request() req: any) {
    return this.channelLinking.createTelegramLinkToken(req.user.id);
  }

  @ApiBearerAuth()
  @Post('sms/link')
  @ApiOperation({ summary: 'Generate a one-time code to link your SMS number' })
  @ApiResponse({ status: 201, description: 'Returns a code and an sms: link that sends it' })
  async createSmsLink(@Request() req: any) {
    return this.channelLinking.createSmsLinkCode(req.user.id);
  }

  @ApiBearerAuth()
  @Post('discord/link')
  @ApiOperation({ summary: 'Generate a one-time code to link your Discord account' })
  @ApiResponse({ status: 201, description: 'Returns a code to DM the bot' })
  async createDiscordLink(@Request() req: any) {
    return this.channelLinking.createDiscordLinkCode(req.user.id);
  }

  @ApiBearerAuth()
  @Post('slack/link')
  @ApiOperation({ summary: 'Generate a one-time code to link your Slack account' })
  @ApiResponse({ status: 201, description: 'Returns a code to DM the app' })
  async createSlackLink(@Request() req: any) {
    return this.channelLinking.createSlackLinkCode(req.user.id);
  }

  // WhatsApp Webhook Verification (called by Meta, not an authenticated user)
  @Public()
  @Get('whatsapp/webhook')
  @ApiOperation({ summary: 'WhatsApp webhook verification' })
  @ApiResponse({ status: 200, description: 'Webhook verified' })
  async verifyWhatsAppWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return challenge;
    }
    throw new ForbiddenException('Invalid verification token');
  }

  // WhatsApp Webhook Handler (called by Meta)
  @Public()
  @Post('whatsapp/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WhatsApp webhook handler' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleWhatsAppWebhook(@Body() payload: any) {
    return this.whatsappService.handleWebhook(payload);
  }

  // Telegram Webhook (called by Telegram)
  @Public()
  @Post('telegram/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Telegram webhook handler' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleTelegramWebhook(@Body() payload: any) {
    return this.telegramService.handleWebhook(payload);
  }

  // Send WhatsApp Message - userId comes from the authenticated session, never the body,
  // so an authenticated user can't send "as" another user by passing a different id.
  @ApiBearerAuth()
  @Post('whatsapp/send')
  @ApiOperation({ summary: 'Send WhatsApp message' })
  @ApiResponse({ status: 200, description: 'Message sent' })
  async sendWhatsAppMessage(@Request() req: any, @Body() body: { to: string; message: string }) {
    return this.whatsappService.sendMessage(req.user.id, body.to, body.message);
  }

  // Send Telegram Message
  @ApiBearerAuth()
  @Post('telegram/send')
  @ApiOperation({ summary: 'Send Telegram message' })
  @ApiResponse({ status: 200, description: 'Message sent' })
  async sendTelegramMessage(
    @Request() req: any,
    @Body() body: { chatId: number; message: string },
  ) {
    return this.telegramService.sendMessage(req.user.id, body.chatId, body.message);
  }

  // Twilio SMS Webhook (form-urlencoded, called by Twilio)
  @Public()
  @Post('sms/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Twilio SMS webhook handler' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleSmsWebhook(@Body() payload: any, @Res() res: Response) {
    await this.smsService.handleWebhook(payload);
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  }

  // Send SMS
  @ApiBearerAuth()
  @Post('sms/send')
  @ApiOperation({ summary: 'Send SMS message' })
  @ApiResponse({ status: 200, description: 'Message sent' })
  async sendSms(@Request() req: any, @Body() body: { to: string; message: string }) {
    return this.smsService.sendMessage(req.user.id, body.to, body.message);
  }

  // Send Discord message
  @ApiBearerAuth()
  @Post('discord/send')
  @ApiOperation({ summary: 'Send a Discord DM' })
  @ApiResponse({ status: 200, description: 'Message sent' })
  async sendDiscordMessage(
    @Request() req: any,
    @Body() body: { discordUserId: string; message: string },
  ) {
    return this.discordService.sendMessage(req.user.id, body.discordUserId, body.message);
  }

  // Slack Events API (called by Slack) - signature-verified using the raw request body.
  @Public()
  @Post('slack/events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Slack Events API webhook handler' })
  @ApiResponse({ status: 200, description: 'Event processed' })
  async handleSlackEvent(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Body() payload: any,
    @Headers('x-slack-request-timestamp') timestamp: string,
    @Headers('x-slack-signature') signature: string,
  ) {
    // The URL verification handshake happens once, when the event subscription
    // is first configured in Slack's app settings - allow it through even
    // before a signing secret is set, since there's nothing sensitive in it.
    if (payload?.type === 'url_verification') {
      return this.slackService.handleEvent(payload);
    }

    const rawBody = (req.rawBody as Buffer)?.toString('utf8') ?? '';
    if (!this.slackService.verifySignature(rawBody, timestamp, signature)) {
      throw new ForbiddenException('Invalid Slack signature');
    }

    return this.slackService.handleEvent(payload);
  }

  // Send Slack message
  @ApiBearerAuth()
  @Post('slack/send')
  @ApiOperation({ summary: 'Send a Slack DM' })
  @ApiResponse({ status: 200, description: 'Message sent' })
  async sendSlackMessage(
    @Request() req: any,
    @Body() body: { slackUserId: string; message: string },
  ) {
    return this.slackService.sendMessage(req.user.id, body.slackUserId, body.message);
  }

  // Inbound Email Webhook (Postmark/SendGrid inbound parse)
  @Public()
  @Post('email/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inbound email webhook handler' })
  @ApiResponse({ status: 200, description: 'Email processed' })
  async handleEmailWebhook(@Body() payload: any) {
    return this.emailService.handleInboundEmail(payload);
  }

  // Send Email
  @ApiBearerAuth()
  @Post('email/send')
  @ApiOperation({ summary: 'Send email' })
  @ApiResponse({ status: 200, description: 'Email sent' })
  async sendEmail(
    @Request() req: any,
    @Body() body: { to: string; subject: string; body: string },
  ) {
    // A user-initiated send, so it goes out on the user's own SendGrid key if
    // they've connected one. System mail (password resets, briefings) stays on
    // the platform key - see SendEmailOptions.
    return this.emailService.sendEmail(req.user.id, body.to, body.subject, body.body, {
      preferUserCredential: true,
    });
  }

  // Health Check
  @ApiBearerAuth()
  @Get('health')
  @ApiOperation({ summary: 'Check channels health' })
  @ApiResponse({ status: 200, description: 'Health status' })
  async healthCheck() {
    const [whatsapp, telegram, sms, discord, slack] = await Promise.all([
      this.whatsappService.initialize(),
      this.telegramService.initialize(),
      this.smsService.initialize(),
      this.discordService.initialize(),
      this.slackService.initialize(),
    ]);

    return {
      whatsapp: whatsapp.status,
      telegram: telegram.status,
      sms: sms.status,
      discord: discord.status,
      slack: slack.status,
    };
  }
}
