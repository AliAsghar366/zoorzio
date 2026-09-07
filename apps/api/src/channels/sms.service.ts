import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';
import { ChannelLinkingService } from './channel-linking.service';
import { ChannelType } from '@anchor/database';

const LINK_CODE_PATTERN = /^LINK\s+([A-Z0-9]{6})$/i;

/** Plain SMS via Twilio - same "code you text us" linking pattern as WhatsApp. */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private memoryService: MemoryService,
    private readonly http: HttpService,
    private readonly channelLinking: ChannelLinkingService,
  ) {}

  async initialize() {
    const accountSid = this.configService.get('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get('TWILIO_AUTH_TOKEN');
    return { status: accountSid && authToken ? 'initialized' : 'not configured' };
  }

  /** Twilio posts application/x-www-form-urlencoded with From/Body/MessageSid fields. */
  async handleWebhook(payload: { From: string; Body: string; MessageSid: string }) {
    const { From: from, Body: body, MessageSid: externalId } = payload;
    const text = (body || '').trim();

    const linkMatch = LINK_CODE_PATTERN.exec(text);
    if (linkMatch) {
      await this.handleLinkCode(from, linkMatch[1]);
      return;
    }

    const channel = await this.findOrCreateChannel(from);
    if (!channel) {
      this.logger.warn(`Ignoring SMS from unlinked number ${from} - no account has linked it yet`);
      await this.trySendMessage(from, "I don't recognize this number yet. Open Zoorzio, go to your Profile, and link your number first.");
      return;
    }

    await this.prisma.channelMessage.create({
      data: { channelId: channel.id, externalId, content: text, type: 'TEXT', direction: 'INBOUND', metadata: {} },
    });

    await this.memoryService.create(channel.userId, {
      content: text,
      type: 'MESSAGE',
      source: ChannelType.SMS,
      metadata: { senderPhone: from },
      tags: ['sms'],
    });

    this.logger.log(`Processed SMS from ${from}`);
  }

  private async handleLinkCode(from: string, code: string) {
    const userId = await this.channelLinking.consumeSmsLinkCode(code, from);
    if (userId) {
      this.logger.log(`Linked SMS number ${from} to user ${userId}`);
      await this.trySendMessage(from, "You're linked! I'll remember what you text me here from now on.");
    } else {
      await this.trySendMessage(from, 'That code is invalid or expired. Generate a new one from your Zoorzio Profile page.');
    }
  }

  private async trySendMessage(to: string, body: string) {
    try {
      await this.sendRaw(to, body);
    } catch (error) {
      this.logger.error('Failed to send SMS reply', error);
    }
  }

  async sendMessage(userId: string, to: string, message: string) {
    const messageId = await this.sendRaw(to, message);

    const channel = await this.prisma.channel.findFirst({ where: { userId, type: 'SMS', externalId: to } });
    if (channel) {
      await this.prisma.channelMessage.create({
        data: { channelId: channel.id, externalId: messageId, content: message, type: 'TEXT', direction: 'OUTBOUND' },
      });
    }

    return { success: true, messageId };
  }

  private async sendRaw(to: string, body: string): Promise<string> {
    const accountSid = this.configService.get('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get('TWILIO_AUTH_TOKEN');
    const from = this.configService.get('TWILIO_PHONE_NUMBER');

    try {
      const response = await firstValueFrom(
        this.http.post(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          new URLSearchParams({ To: to, From: from, Body: body }).toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            auth: { username: accountSid, password: authToken },
          },
        ),
      );
      return response.data?.sid ?? `local_${Date.now()}`;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(`Failed to send SMS: ${axiosError?.response?.status} ${JSON.stringify(axiosError?.response?.data ?? axiosError?.message)}`);
      throw error;
    }
  }

  /** Only returns a channel a user has proven ownership of via the LINK code flow - never guesses. */
  private async findOrCreateChannel(phoneNumber: string) {
    return this.prisma.channel.findFirst({ where: { type: 'SMS', externalId: phoneNumber } });
  }
}
