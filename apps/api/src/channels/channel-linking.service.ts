import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelType } from '@anchor/database';

const LINK_TTL_MS = 10 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I - avoids typos

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Proves ownership of an external channel identity (a phone number, a
 * Telegram chat, a Discord/Slack user id) before linking it to an account.
 * WhatsApp/SMS/Discord/Slack all use a short-lived code the user sends *to*
 * the bot - simplest common denominator, and required for WhatsApp Business
 * specifically (a business-initiated message outside a customer-service
 * window needs a pre-approved template, so the user must message first).
 * Telegram is the exception: it supports a real deep link (/start) that
 * skips the copy-paste step entirely, so it uses a token instead of a code.
 */
@Injectable()
export class ChannelLinkingService {
  private readonly logger = new Logger(ChannelLinkingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isWhatsAppLinkingConfigured(): boolean {
    return !!this.config.get('WHATSAPP_BUSINESS_PHONE_NUMBER');
  }

  isTelegramLinkingConfigured(): boolean {
    return !!this.config.get('TELEGRAM_BOT_USERNAME');
  }

  isSmsLinkingConfigured(): boolean {
    return !!this.config.get('TWILIO_PHONE_NUMBER');
  }

  isDiscordLinkingConfigured(): boolean {
    return !!this.config.get('DISCORD_BOT_TOKEN');
  }

  isSlackLinkingConfigured(): boolean {
    return !!this.config.get('SLACK_BOT_TOKEN');
  }

  private async generateCode(userId: string, channelType: ChannelType): Promise<string> {
    const code = Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
    await this.storeVerification(userId, channelType, code);
    return code;
  }

  private async generateToken(userId: string, channelType: ChannelType): Promise<string> {
    const token = randomBytes(16).toString('hex');
    await this.storeVerification(userId, channelType, token);
    return token;
  }

  private async storeVerification(userId: string, channelType: ChannelType, raw: string) {
    await this.prisma.channelVerification.create({
      data: { userId, channelType, codeHash: hash(this.normalize(raw)), expiresAt: new Date(Date.now() + LINK_TTL_MS) },
    });
  }

  private normalize(raw: string): string {
    return raw.trim().toUpperCase();
  }

  async createWhatsAppLinkCode(userId: string): Promise<{ code: string; waLink: string | null; configured: boolean }> {
    const code = await this.generateCode(userId, ChannelType.WHATSAPP);

    const businessNumber = this.config.get<string>('WHATSAPP_BUSINESS_PHONE_NUMBER');
    const configured = !!businessNumber;
    const waLink = configured
      ? `https://wa.me/${businessNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`LINK ${code}`)}`
      : null;

    if (!configured) {
      this.logger.warn(`WHATSAPP_BUSINESS_PHONE_NUMBER not configured - link code for user ${userId}: LINK ${code}`);
    }

    return { code, waLink, configured };
  }

  async createTelegramLinkToken(userId: string): Promise<{ deepLink: string | null; configured: boolean }> {
    const token = await this.generateToken(userId, ChannelType.TELEGRAM);

    const botUsername = this.config.get<string>('TELEGRAM_BOT_USERNAME');
    const configured = !!botUsername;
    const deepLink = configured ? `https://t.me/${botUsername}?start=${token}` : null;

    if (!configured) {
      this.logger.warn(`TELEGRAM_BOT_USERNAME not configured - link token for user ${userId}: ${token}`);
    }

    return { deepLink, configured };
  }

  async createSmsLinkCode(userId: string): Promise<{ code: string; smsLink: string | null; configured: boolean }> {
    const code = await this.generateCode(userId, ChannelType.SMS);

    const businessNumber = this.config.get<string>('TWILIO_PHONE_NUMBER');
    const configured = !!businessNumber;
    const smsLink = configured
      ? `sms:${businessNumber.replace(/[^0-9+]/g, '')}?body=${encodeURIComponent(`LINK ${code}`)}`
      : null;

    if (!configured) {
      this.logger.warn(`TWILIO_PHONE_NUMBER not configured - link code for user ${userId}: LINK ${code}`);
    }

    return { code, smsLink, configured };
  }

  async createDiscordLinkCode(userId: string): Promise<{ code: string; configured: boolean }> {
    const code = await this.generateCode(userId, ChannelType.DISCORD);
    const configured = this.isDiscordLinkingConfigured();
    if (!configured) {
      this.logger.warn(`DISCORD_BOT_TOKEN not configured - link code for user ${userId}: LINK ${code}`);
    }
    return { code, configured };
  }

  async createSlackLinkCode(userId: string): Promise<{ code: string; configured: boolean }> {
    const code = await this.generateCode(userId, ChannelType.SLACK);
    const configured = this.isSlackLinkingConfigured();
    if (!configured) {
      this.logger.warn(`SLACK_BOT_TOKEN not configured - link code for user ${userId}: LINK ${code}`);
    }
    return { code, configured };
  }

  /** Returns the linked userId on success, or null if the code is unknown/expired/used. */
  async consumeWhatsAppLinkCode(rawCode: string, phoneNumber: string): Promise<string | null> {
    return this.consume(ChannelType.WHATSAPP, hash(this.normalize(rawCode)), phoneNumber, phoneNumber);
  }

  /** Returns the linked userId on success, or null if the token is unknown/expired/used. */
  async consumeTelegramLinkToken(rawToken: string, chatId: string, displayName?: string): Promise<string | null> {
    return this.consume(ChannelType.TELEGRAM, hash(rawToken.trim()), chatId, displayName ?? chatId);
  }

  async consumeSmsLinkCode(rawCode: string, phoneNumber: string): Promise<string | null> {
    return this.consume(ChannelType.SMS, hash(this.normalize(rawCode)), phoneNumber, phoneNumber);
  }

  async consumeDiscordLinkCode(rawCode: string, discordUserId: string, displayName?: string): Promise<string | null> {
    return this.consume(ChannelType.DISCORD, hash(this.normalize(rawCode)), discordUserId, displayName ?? discordUserId);
  }

  async consumeSlackLinkCode(rawCode: string, slackUserId: string, displayName?: string): Promise<string | null> {
    return this.consume(ChannelType.SLACK, hash(this.normalize(rawCode)), slackUserId, displayName ?? slackUserId);
  }

  private async consume(
    channelType: ChannelType,
    codeHash: string,
    externalId: string,
    displayName: string,
  ): Promise<string | null> {
    const verification = await this.prisma.channelVerification.findUnique({ where: { codeHash } });
    if (!verification || verification.channelType !== channelType || verification.usedAt || verification.expiresAt < new Date()) {
      return null;
    }

    // externalId is globally unique per channel type (see schema) - if this
    // number/chat is already linked to a different account, don't silently
    // reassign it; require an explicit unlink first.
    const existing = await this.prisma.channel.findUnique({
      where: { type_externalId: { type: channelType, externalId } },
    });
    if (existing && existing.userId !== verification.userId) {
      this.logger.warn(`${channelType} ${externalId} is already linked to a different account - refusing to relink`);
      return null;
    }

    await this.prisma.$transaction([
      this.prisma.channel.upsert({
        where: { type_externalId: { type: channelType, externalId } },
        update: { userId: verification.userId, name: displayName, isActive: true },
        create: { userId: verification.userId, type: channelType, externalId, name: displayName },
      }),
      this.prisma.channelVerification.update({ where: { id: verification.id }, data: { usedAt: new Date() } }),
    ]);

    return verification.userId;
  }

  async getLinkedChannels(userId: string) {
    return this.prisma.channel.findMany({
      where: {
        userId,
        type: { in: [ChannelType.WHATSAPP, ChannelType.TELEGRAM, ChannelType.SMS, ChannelType.DISCORD, ChannelType.SLACK] },
      },
      select: { id: true, type: true, externalId: true, name: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async unlinkChannel(userId: string, channelId: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('Channel not found');
    if (channel.userId !== userId) throw new ForbiddenException('Access denied');

    await this.prisma.channel.delete({ where: { id: channelId } });
    return { success: true };
  }
}
