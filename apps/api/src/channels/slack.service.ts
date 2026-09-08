import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';
import { ChannelLinkingService } from './channel-linking.service';
import { ChannelCredentialsService } from './channel-credentials.service';
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
    private readonly channelCredentials: ChannelCredentialsService,
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
    return this.verifySignatureWithSecret(
      this.configService.get<string>('SLACK_SIGNING_SECRET'),
      rawBody,
      timestamp,
      signature,
    );
  }

  /**
   * Verifies against a specific signing secret - per-user webhooks must be
   * checked against *that user's* secret, never the platform's, or a request
   * signed by one workspace would validate against another's endpoint.
   */
  verifySignatureWithSecret(
    signingSecret: string | null | undefined,
    rawBody: string,
    timestamp: string,
    signature: string,
  ): boolean {
    if (!signingSecret || !timestamp || !signature) return false;

    // Reject requests older than 5 minutes to prevent replay attacks.
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

    const expected =
      'v0=' +
      createHmac('sha256', signingSecret).update(`v0:${timestamp}:${rawBody}`).digest('hex');
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signature);
    return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
  }

  /**
   * Entry point for a per-user Slack webhook. Resolves whose app this is from
   * the opaque routing key, then verifies the signature against that user's
   * own signing secret before touching the payload.
   */
  async handleEventForRoutingKey(
    routingKey: string,
    payload: any,
    rawBody: string,
    timestamp: string,
    signature: string,
  ): Promise<{ ok?: boolean; challenge?: string; error?: string }> {
    const credential = await this.channelCredentials.getByRoutingKey(routingKey);
    if (!credential) {
      this.logger.warn('Received Slack event for unknown routing key');
      return { ok: true };
    }

    // The url_verification handshake happens once, when the user first points
    // their app's Event Subscriptions at this URL - Slack sends it before the
    // app is fully configured, and it carries nothing sensitive.
    if (payload?.type === 'url_verification') {
      return { challenge: payload.challenge };
    }

    if (!this.verifySignatureWithSecret(credential.secondaryToken, rawBody, timestamp, signature)) {
      this.logger.warn(
        `Rejected Slack event with an invalid signature for user ${credential.userId}`,
      );
      return { error: 'invalid_signature' };
    }

    return this.handleEvent(payload, credential.token);
  }

  /** botToken defaults to the shared platform app; per-user webhooks pass in the resolved user's own token. */
  async handleEvent(payload: any, botToken?: string) {
    if (payload.type === 'url_verification') {
      return { challenge: payload.challenge };
    }

    const event = payload.event;
    if (event?.type === 'message' && event.channel_type === 'im' && !event.bot_id && event.text) {
      await this.processMessage(event, botToken);
    }

    return { ok: true };
  }

  private async processMessage(event: any, botToken?: string) {
    const { user: slackUserId, text, channel, ts: externalId } = event;
    const body = (text || '').trim();

    const linkMatch = LINK_CODE_PATTERN.exec(body);
    if (linkMatch) {
      await this.handleLinkCode(slackUserId, channel, linkMatch[1], botToken);
      return;
    }

    const dbChannel = await this.findOrCreateChannel(slackUserId);
    if (!dbChannel) {
      this.logger.warn(
        `Ignoring Slack DM from unlinked user ${slackUserId} - no account has linked it yet`,
      );
      await this.trySendMessage(
        channel,
        "I don't recognize you yet. Open Zoorzio, go to your Profile, and link your Slack account first.",
        botToken,
      );
      return;
    }

    await this.prisma.channelMessage.create({
      data: {
        channelId: dbChannel.id,
        externalId,
        content: body,
        type: 'TEXT',
        direction: 'INBOUND',
        metadata: { slackChannel: channel },
      },
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

  private async handleLinkCode(
    slackUserId: string,
    dmChannelId: string,
    code: string,
    botToken?: string,
  ) {
    const userId = await this.channelLinking.consumeSlackLinkCode(code, slackUserId);
    if (userId) {
      this.logger.log(`Linked Slack user ${slackUserId} to user ${userId}`);
      await this.trySendMessage(
        dmChannelId,
        "You're linked! I'll remember what you send me here from now on.",
        botToken,
      );
    } else {
      await this.trySendMessage(
        dmChannelId,
        'That code is invalid or expired. Generate a new one from your Zoorzio Profile page.',
        botToken,
      );
    }
  }

  private async trySendMessage(channelId: string, text: string, overrideToken?: string) {
    const botToken = overrideToken || this.configService.get('SLACK_BOT_TOKEN');
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
    const ownCredential = await this.channelCredentials.getDecryptedToken(
      userId,
      ChannelType.SLACK,
    );
    const botToken = ownCredential?.token || this.configService.get('SLACK_BOT_TOKEN');
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
      this.logger.error(
        `Failed to send Slack message: ${axiosError?.response?.status} ${JSON.stringify(axiosError?.response?.data ?? axiosError?.message)}`,
      );
      throw error;
    }

    const channel = await this.prisma.channel.findFirst({
      where: { userId, type: 'SLACK', externalId: slackUserId },
    });
    if (channel) {
      await this.prisma.channelMessage.create({
        data: {
          channelId: channel.id,
          externalId: messageId,
          content: message,
          type: 'TEXT',
          direction: 'OUTBOUND',
        },
      });
    }

    return { success: true, messageId };
  }

  private async findOrCreateChannel(slackUserId: string) {
    return this.prisma.channel.findFirst({ where: { type: 'SLACK', externalId: slackUserId } });
  }
}
