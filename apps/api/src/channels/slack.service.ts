import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';
import { ChannelLinkingService } from './channel-linking.service';
import { ChannelType } from '@anchor/database';

const LINK_CODE_PATTERN = /^LINK\s+([A-Z0-9]{6})$/i;
const SLACK_API = 'https://slack.com/api';

/** Slack Events API (HTTP push model) - DMs to the app arrive as `message` events. */
@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private memoryService: MemoryService,
    private readonly http: HttpService,
    private readonly channelLinking: ChannelLinkingService,
  ) {}

  async initialize() {
    const botToken = this.configService.get('SLACK_BOT_TOKEN');
    return { status: botToken ? 'initialized' : 'not configured' };
  }

  /**
   * Slack signs every request with HMAC-SHA256 over `v0:{timestamp}:{rawBody}`
   * using the app's signing secret - verifying this is how we know a webhook
   * call actually came from Slack and not a forged request.
   */
  verifySignature(rawBody: string, timestamp: string, signature: string): boolean {
    const signingSecret = this.configService.get<string>('SLACK_SIGNING_SECRET');
    if (!signingSecret || !timestamp || !signature) return false;

    // Reject requests older than 5 minutes to prevent replay attacks.
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

    const expected = 'v0=' + createHmac('sha256', signingSecret).update(`v0:${timestamp}:${rawBody}`).digest('hex');
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signature);
    return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
  }

  async handleEvent(payload: any) {
    if (payload.type === 'url_verification') {
      return { challenge: payload.challenge };
    }

    const event = payload.event;
    if (event?.type === 'message' && event.channel_type === 'im' && !event.bot_id && event.text) {
      await this.processMessage(event);
    }

    return { ok: true };
  }

  private async processMessage(event: any) {
    const { user: slackUserId, text, channel, ts: externalId } = event;
    const body = (text || '').trim();

    const linkMatch = LINK_CODE_PATTERN.exec(body);
    if (linkMatch) {
      await this.handleLinkCode(slackUserId, channel, linkMatch[1]);
      return;
    }

    const dbChannel = await this.findOrCreateChannel(slackUserId);
    if (!dbChannel) {
      this.logger.warn(`Ignoring Slack DM from unlinked user ${slackUserId} - no account has linked it yet`);
      await this.trySendMessage(channel, "I don't recognize you yet. Open Zoorzio, go to your Profile, and link your Slack account first.");
      return;
    }

    await this.prisma.channelMessage.create({
      data: { channelId: dbChannel.id, externalId, content: body, type: 'TEXT', direction: 'INBOUND', metadata: { slackChannel: channel } },
    });

    await this.memoryService.create(dbChannel.userId, {
      content: body,
      type: 'MESSAGE',
      source: ChannelType.SLACK,
      metadata: { senderId: slackUserId },
      tags: ['slack'],
    });

    this.logger.log(`Processed Slack DM from ${slackUserId}`);
  }

  private async handleLinkCode(slackUserId: string, dmChannelId: string, code: string) {
    const userId = await this.channelLinking.consumeSlackLinkCode(code, slackUserId);
    if (userId) {
      this.logger.log(`Linked Slack user ${slackUserId} to user ${userId}`);
      await this.trySendMessage(dmChannelId, "You're linked! I'll remember what you send me here from now on.");
    } else {
      await this.trySendMessage(dmChannelId, 'That code is invalid or expired. Generate a new one from your Zoorzio Profile page.');
    }
  }

  private async trySendMessage(channelId: string, text: string) {
    const botToken = this.configService.get('SLACK_BOT_TOKEN');
    if (!botToken) return;
    try {
      await firstValueFrom(
        this.http.post(
          `${SLACK_API}/chat.postMessage`,
          { channel: channelId, text },
          { headers: { Authorization: `Bearer ${botToken}` } },
        ),
      );
    } catch (error) {
      this.logger.error('Failed to send Slack reply', error);
    }
  }

  /** Sends a DM to a user by their Slack user id, opening the DM conversation first. */
  async sendMessage(userId: string, slackUserId: string, message: string) {
    const botToken = this.configService.get('SLACK_BOT_TOKEN');
    let messageId = `local_${Date.now()}`;
    let dmChannelId: string | undefined;

    try {
      const openResponse = await firstValueFrom(
        this.http.post(
          `${SLACK_API}/conversations.open`,
          { users: slackUserId },
          { headers: { Authorization: `Bearer ${botToken}` } },
        ),
      );
      dmChannelId = openResponse.data?.channel?.id;

      const sendResponse = await firstValueFrom(
        this.http.post(
          `${SLACK_API}/chat.postMessage`,
          { channel: dmChannelId, text: message },
          { headers: { Authorization: `Bearer ${botToken}` } },
        ),
      );
      messageId = sendResponse.data?.ts ?? messageId;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(`Failed to send Slack message: ${axiosError?.response?.status} ${JSON.stringify(axiosError?.response?.data ?? axiosError?.message)}`);
      throw error;
    }

    const channel = await this.prisma.channel.findFirst({ where: { userId, type: 'SLACK', externalId: slackUserId } });
    if (channel) {
      await this.prisma.channelMessage.create({
        data: { channelId: channel.id, externalId: messageId, content: message, type: 'TEXT', direction: 'OUTBOUND' },
      });
    }

    return { success: true, messageId };
  }

  private async findOrCreateChannel(slackUserId: string) {
    return this.prisma.channel.findFirst({ where: { type: 'SLACK', externalId: slackUserId } });
  }
}
