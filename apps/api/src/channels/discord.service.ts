import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, GatewayIntentBits, Partials, Events, ChannelType as DiscordChannelType } from 'discord.js';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';
import { ChannelLinkingService } from './channel-linking.service';
import { ChannelType } from '@anchor/database';

const LINK_CODE_PATTERN = /^LINK\s+([A-Z0-9]{6})$/i;

/**
 * Discord has no configurable "call this URL for every DM" webhook the way
 * WhatsApp/Telegram/Slack do - receiving arbitrary messages requires a
 * persistent Gateway (WebSocket) connection, which is what discord.js's
 * Client manages (heartbeating, reconnects, etc). Only started when
 * DISCORD_BOT_TOKEN is configured; otherwise this is a complete no-op.
 */
@Injectable()
export class DiscordService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordService.name);
  private client: Client | null = null;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private memoryService: MemoryService,
    private readonly channelLinking: ChannelLinkingService,
  ) {}

  async onModuleInit() {
    const token = this.configService.get<string>('DISCORD_BOT_TOKEN');
    if (!token) {
      this.logger.log('DISCORD_BOT_TOKEN not configured - Discord channel disabled');
      return;
    }

    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
      partials: [Partials.Channel, Partials.Message],
    });

    this.client.on(Events.MessageCreate, (message) => {
      if (message.author.bot || message.channel.type !== DiscordChannelType.DM) return;
      this.processMessage(message.author.id, message.author.username, message.content, message.id).catch((error) =>
        this.logger.error('Failed to process Discord message', error),
      );
    });

    this.client.on(Events.Error, (error) => this.logger.error('Discord client error', error));

    try {
      await this.client.login(token);
      this.logger.log('Discord Gateway connected');
    } catch (error) {
      this.logger.error('Failed to connect to Discord Gateway', error);
      this.client = null;
    }
  }

  async onModuleDestroy() {
    await this.client?.destroy();
  }

  async initialize() {
    return { status: this.configService.get('DISCORD_BOT_TOKEN') ? 'initialized' : 'not configured' };
  }

  private async processMessage(discordUserId: string, username: string, text: string, externalId: string) {
    const body = (text || '').trim();

    const linkMatch = LINK_CODE_PATTERN.exec(body);
    if (linkMatch) {
      await this.handleLinkCode(discordUserId, username, linkMatch[1]);
      return;
    }

    const channel = await this.findOrCreateChannel(discordUserId);
    if (!channel) {
      this.logger.warn(`Ignoring Discord DM from unlinked user ${discordUserId} - no account has linked it yet`);
      await this.trySendMessage(discordUserId, "I don't recognize you yet. Open Zoorzio, go to your Profile, and link your Discord account first.");
      return;
    }

    await this.prisma.channelMessage.create({
      data: { channelId: channel.id, externalId, content: body, type: 'TEXT', direction: 'INBOUND', metadata: {} },
    });

    await this.memoryService.create(channel.userId, {
      content: body,
      type: 'MESSAGE',
      source: ChannelType.DISCORD,
      metadata: { senderId: discordUserId, username },
      tags: ['discord'],
    });

    this.logger.log(`Processed Discord message from ${discordUserId}`);
  }

  private async handleLinkCode(discordUserId: string, username: string, code: string) {
    const userId = await this.channelLinking.consumeDiscordLinkCode(code, discordUserId, username);
    if (userId) {
      this.logger.log(`Linked Discord user ${discordUserId} to user ${userId}`);
      await this.trySendMessage(discordUserId, "You're linked! I'll remember what you send me here from now on.");
    } else {
      await this.trySendMessage(discordUserId, 'That code is invalid or expired. Generate a new one from your Zoorzio Profile page.');
    }
  }

  private async trySendMessage(discordUserId: string, text: string) {
    if (!this.client) return;
    try {
      const user = await this.client.users.fetch(discordUserId);
      await user.send(text);
    } catch (error) {
      this.logger.error('Failed to send Discord reply', error);
    }
  }

  async sendMessage(userId: string, discordUserId: string, message: string) {
    if (!this.client) {
      throw new Error('Discord is not configured on this server');
    }

    const user = await this.client.users.fetch(discordUserId);
    const sent = await user.send(message);

    const channel = await this.prisma.channel.findFirst({ where: { userId, type: 'DISCORD', externalId: discordUserId } });
    if (channel) {
      await this.prisma.channelMessage.create({
        data: { channelId: channel.id, externalId: sent.id, content: message, type: 'TEXT', direction: 'OUTBOUND' },
      });
    }

    return { success: true, messageId: sent.id };
  }

  private async findOrCreateChannel(discordUserId: string) {
    return this.prisma.channel.findFirst({ where: { type: 'DISCORD', externalId: discordUserId } });
  }
}
