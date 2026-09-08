import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ChannelType as DiscordChannelType,
} from 'discord.js';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';
import { ChannelLinkingService } from './channel-linking.service';
import { ChannelCredentialsService } from './channel-credentials.service';
import { ChannelType, ChannelCredentialStatus } from '@anchor/database';

const LINK_CODE_PATTERN = /^LINK\s+([A-Z0-9]{6})$/i;
const DEFAULT_MAX_USER_BOTS = 100;

/**
 * Discord has no configurable "call this URL for every DM" webhook the way
 * WhatsApp/Telegram/Slack do - receiving arbitrary messages requires a
 * persistent Gateway (WebSocket) connection, which is what discord.js's
 * Client manages (heartbeating, reconnects, etc).
 *
 * That makes Discord the one channel where "bring your own bot" costs real
 * resources: every user who connects their own bot needs its own live socket,
 * held open for as long as the credential is active. Two consequences worth
 * knowing about:
 *
 *  - Connections don't survive a restart, so onModuleInit re-establishes every
 *    active user's bot (see reconnectUserBots).
 *  - The pool is capped (MAX_DISCORD_USER_BOTS) so one process can't be pushed
 *    into holding an unbounded number of sockets.
 *
 * The shared platform bot (DISCORD_BOT_TOKEN) still runs alongside these and
 * serves every user who hasn't brought their own; it's optional, and when it
 * isn't configured only per-user bots run.
 */
@Injectable()
export class DiscordService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordService.name);

  /** The platform-wide bot. Serves any linked user; null when not configured. */
  private sharedClient: Client | null = null;

  /** One live Gateway connection per user who has connected their own bot, keyed by userId. */
  private readonly userClients = new Map<string, Client>();

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private memoryService: MemoryService,
    private readonly channelLinking: ChannelLinkingService,
    private readonly channelCredentials: ChannelCredentialsService,
  ) {}

  private get maxUserBots(): number {
    const configured = Number(this.configService.get('MAX_DISCORD_USER_BOTS'));
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_USER_BOTS;
  }

  async onModuleInit() {
    const token = this.configService.get<string>('DISCORD_BOT_TOKEN');
    if (token) {
      this.sharedClient = await this.startClient(token, null);
      if (this.sharedClient) this.logger.log('Discord Gateway connected (shared bot)');
    } else {
      this.logger.log('DISCORD_BOT_TOKEN not configured - shared Discord bot disabled');
    }

    await this.reconnectUserBots();
  }

  async onModuleDestroy() {
    const clients = [...this.userClients.values()];
    this.userClients.clear();
    await Promise.all(
      [this.sharedClient?.destroy(), ...clients.map((c) => c.destroy())].filter(Boolean),
    );
    this.sharedClient = null;
  }

  async initialize() {
    return {
      status: this.configService.get('DISCORD_BOT_TOKEN') ? 'initialized' : 'not configured',
    };
  }

  /**
   * A Gateway connection dies with the process, so every user who had their own
   * bot running needs it re-established on boot - without this they'd silently
   * stop receiving messages after any restart or redeploy until they re-saved
   * their token.
   */
  private async reconnectUserBots() {
    let records: { userId: string }[] = [];
    try {
      records = await this.prisma.channelCredential.findMany({
        where: { type: ChannelType.DISCORD, status: ChannelCredentialStatus.ACTIVE },
        select: { userId: true },
      });
    } catch (error) {
      this.logger.error('Failed to load Discord credentials for reconnect', error);
      return;
    }

    if (!records.length) return;
    this.logger.log(`Reconnecting ${records.length} user Discord bot(s)`);

    for (const { userId } of records) {
      try {
        await this.connectUserBot(userId);
      } catch (error) {
        this.logger.error(`Failed to reconnect Discord bot for user ${userId}`, error);
      }
    }
  }

  /**
   * Opens (or re-opens) the Gateway connection for one user's own bot. Safe to
   * call repeatedly - an existing connection is torn down first, so re-saving a
   * token swaps the connection rather than leaking the old socket.
   */
  async connectUserBot(userId: string): Promise<boolean> {
    await this.disconnectUserBot(userId);

    if (this.userClients.size >= this.maxUserBots) {
      const message = 'This server is at its limit for connected Discord bots';
      this.logger.warn(
        `Refusing Discord bot for user ${userId} - pool at capacity (${this.maxUserBots})`,
      );
      await this.channelCredentials.markStatus(
        userId,
        ChannelType.DISCORD,
        ChannelCredentialStatus.DISCONNECTED,
        message,
      );
      return false;
    }

    const credential = await this.channelCredentials.getDecryptedToken(userId, ChannelType.DISCORD);
    if (!credential) return false;

    const client = await this.startClient(credential.token, userId);
    if (!client) {
      await this.channelCredentials.markStatus(
        userId,
        ChannelType.DISCORD,
        ChannelCredentialStatus.INVALID,
        'Could not connect to Discord with this token',
      );
      return false;
    }

    this.userClients.set(userId, client);
    await this.channelCredentials.markStatus(
      userId,
      ChannelType.DISCORD,
      ChannelCredentialStatus.ACTIVE,
    );
    this.logger.log(`Discord Gateway connected for user ${userId}`);
    return true;
  }

  /** Closes a user's own bot connection - called when they remove or replace the credential. */
  async disconnectUserBot(userId: string): Promise<void> {
    const client = this.userClients.get(userId);
    if (!client) return;

    this.userClients.delete(userId);
    try {
      await client.destroy();
      this.logger.log(`Discord Gateway disconnected for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to close Discord connection for user ${userId}`, error);
    }
  }

  /** Number of live per-user connections - useful for capacity monitoring. */
  get connectedUserBotCount(): number {
    return this.userClients.size;
  }

  /**
   * ownerUserId is null for the shared bot and the owning userId for a personal
   * one; it's what lets processMessage tell whose bot received a given DM.
   */
  private async startClient(token: string, ownerUserId: string | null): Promise<Client | null> {
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    client.on(Events.MessageCreate, (message) => {
      if (message.author.bot || message.channel.type !== DiscordChannelType.DM) return;
      this.processMessage(
        message.author.id,
        message.author.username,
        message.content,
        message.id,
        ownerUserId,
      ).catch((error) => this.logger.error('Failed to process Discord message', error));
    });

    client.on(Events.Error, (error) => this.logger.error('Discord client error', error));

    try {
      await client.login(token);
      return client;
    } catch (error) {
      // Logged without the token - discord.js errors don't embed it, and this
      // must never be the thing that writes a user's secret to the log.
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(
        `Failed to connect to Discord Gateway${ownerUserId ? ` for user ${ownerUserId}` : ''}: ${reason}`,
      );
      return null;
    }
  }

  /** The connection a given bot owner sends on; the shared bot when ownerUserId is null. */
  private clientFor(ownerUserId: string | null): Client | null {
    return ownerUserId ? (this.userClients.get(ownerUserId) ?? null) : this.sharedClient;
  }

  private async processMessage(
    discordUserId: string,
    username: string,
    text: string,
    externalId: string,
    ownerUserId: string | null = null,
  ) {
    const body = (text || '').trim();

    const linkMatch = LINK_CODE_PATTERN.exec(body);
    if (linkMatch) {
      await this.handleLinkCode(discordUserId, username, linkMatch[1], ownerUserId);
      return;
    }

    const channel = await this.findOrCreateChannel(discordUserId);
    if (!channel) {
      this.logger.warn(
        `Ignoring Discord DM from unlinked user ${discordUserId} - no account has linked it yet`,
      );
      await this.trySendMessage(
        discordUserId,
        "I don't recognize you yet. Open Zoorzio, go to your Profile, and link your Discord account first.",
        ownerUserId,
      );
      return;
    }

    // A personal bot serves exactly one account. If someone else DMs it, refuse
    // rather than relaying a stranger's messages through another person's bot -
    // the message would be stored against the sender's own account, but it
    // would have travelled through a bot its owner never agreed to share.
    if (ownerUserId && channel.userId !== ownerUserId) {
      this.logger.warn(
        `Refusing Discord DM: bot belongs to user ${ownerUserId} but sender ${discordUserId} is linked to user ${channel.userId}`,
      );
      await this.trySendMessage(
        discordUserId,
        "This bot is connected to someone else's Zoorzio account, so it can't save messages for you. Connect your own bot from your Zoorzio Profile.",
        ownerUserId,
      );
      return;
    }

    await this.prisma.channelMessage.create({
      data: {
        channelId: channel.id,
        externalId,
        content: body,
        type: 'TEXT',
        direction: 'INBOUND',
        metadata: {},
      },
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

  private async handleLinkCode(
    discordUserId: string,
    username: string,
    code: string,
    ownerUserId: string | null = null,
  ) {
    // On a personal bot, only its owner's codes are accepted - otherwise someone
    // could complete their own linking through a bot that isn't theirs.
    const userId = await this.channelLinking.consumeDiscordLinkCode(
      code,
      discordUserId,
      username,
      ownerUserId,
    );
    if (userId) {
      this.logger.log(`Linked Discord user ${discordUserId} to user ${userId}`);
      await this.trySendMessage(
        discordUserId,
        "You're linked! I'll remember what you send me here from now on.",
        ownerUserId,
      );
    } else {
      await this.trySendMessage(
        discordUserId,
        'That code is invalid or expired. Generate a new one from your Zoorzio Profile page.',
        ownerUserId,
      );
    }
  }

  private async trySendMessage(
    discordUserId: string,
    text: string,
    ownerUserId: string | null = null,
  ) {
    const client = this.clientFor(ownerUserId);
    if (!client) return;
    try {
      const user = await client.users.fetch(discordUserId);
      await user.send(text);
    } catch (error) {
      this.logger.error('Failed to send Discord reply', error);
    }
  }

  async sendMessage(userId: string, discordUserId: string, message: string) {
    // Prefer the user's own bot; fall back to the shared one for users who
    // haven't connected theirs.
    const client = this.userClients.get(userId) ?? this.sharedClient;
    if (!client) {
      throw new Error('Discord is not configured on this server');
    }

    const user = await client.users.fetch(discordUserId);
    const sent = await user.send(message);

    const channel = await this.prisma.channel.findFirst({
      where: { userId, type: 'DISCORD', externalId: discordUserId },
    });
    if (channel) {
      await this.prisma.channelMessage.create({
        data: {
          channelId: channel.id,
          externalId: sent.id,
          content: message,
          type: 'TEXT',
          direction: 'OUTBOUND',
        },
      });
    }

    return { success: true, messageId: sent.id };
  }

  private async findOrCreateChannel(discordUserId: string) {
    return this.prisma.channel.findFirst({ where: { type: 'DISCORD', externalId: discordUserId } });
  }
}
