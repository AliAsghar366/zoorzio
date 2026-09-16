import { Test, TestingModule } from '@nestjs/testing';
import { DiscordService } from './discord.service';
import { ChannelLinkingService } from './channel-linking.service';
import { ChannelCredentialsService } from './channel-credentials.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';

const handlers: Record<string, (...args: any[]) => void> = {};
/** Every messageCreate handler registered, in client-creation order. */
const messageHandlers: ((...args: any[]) => void)[] = [];

const mockUserSend = jest.fn();
const mockUsersFetch = jest.fn().mockResolvedValue({ send: mockUserSend });
const mockLogin = jest.fn().mockResolvedValue(undefined);
const mockDestroy = jest.fn().mockResolvedValue(undefined);

jest.mock('discord.js', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      on: (event: string, handler: (...args: any[]) => void) => {
        handlers[event] = handler;
        if (event === 'messageCreate') messageHandlers.push(handler);
      },
      login: mockLogin,
      destroy: mockDestroy,
      users: { fetch: mockUsersFetch },
    })),
    GatewayIntentBits: { Guilds: 1, DirectMessages: 2, MessageContent: 4 },
    Partials: { Channel: 'CHANNEL', Message: 'MESSAGE' },
    Events: { MessageCreate: 'messageCreate', Error: 'error' },
    ChannelType: { DM: 'DM' },
  };
});

describe('DiscordService', () => {
  let service: DiscordService;
  let prisma: any;
  let memoryService: any;
  let channelLinking: any;
  let channelCredentials: any;
  let config: Record<string, string>;

  beforeEach(async () => {
    for (const key of Object.keys(handlers)) delete handlers[key];
    messageHandlers.length = 0;
    mockUserSend.mockClear();
    mockUsersFetch.mockClear();
    mockLogin.mockClear();
    mockDestroy.mockClear();

    prisma = {
      channel: { findFirst: jest.fn() },
      channelMessage: { create: jest.fn() },
      channelCredential: { findMany: jest.fn().mockResolvedValue([]) },
    };
    memoryService = { create: jest.fn() };
    channelLinking = { consumeDiscordLinkCode: jest.fn() };
    channelCredentials = {
      getDecryptedToken: jest.fn().mockResolvedValue(null),
      markStatus: jest.fn(),
    };
    config = { DISCORD_BOT_TOKEN: 'test-bot-token' };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordService,
        { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
        { provide: PrismaService, useValue: prisma },
        { provide: MemoryService, useValue: memoryService },
        { provide: ChannelLinkingService, useValue: channelLinking },
        { provide: ChannelCredentialsService, useValue: channelCredentials },
      ],
    }).compile();

    service = module.get(DiscordService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('onModuleInit', () => {
    it('does nothing when DISCORD_BOT_TOKEN is not configured', async () => {
      config.DISCORD_BOT_TOKEN = '';
      await service.onModuleInit();
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('connects to the Gateway when configured', async () => {
      await service.onModuleInit();
      expect(mockLogin).toHaveBeenCalledWith('test-bot-token');
      expect(handlers['messageCreate']).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('reports status based on configuration', async () => {
      expect(await service.initialize()).toEqual({ status: 'initialized' });
      config.DISCORD_BOT_TOKEN = '';
      expect(await service.initialize()).toEqual({ status: 'not configured' });
    });
  });

  function fakeMessage(content: string, authorId = 'discord-user-1', bot = false) {
    return {
      author: { id: authorId, username: 'tester', bot },
      channel: { type: 'DM' },
      content,
      id: 'msg-1',
    };
  }

  describe('message handling', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('ignores messages from bots', async () => {
      await handlers['messageCreate'](fakeMessage('Hello', 'bot-1', true));
      await new Promise(process.nextTick);
      expect(memoryService.create).not.toHaveBeenCalled();
    });

    it('processes a DM from an already-linked user', async () => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'chan1', userId: 'user123' });

      await handlers['messageCreate'](fakeMessage('Hello'));
      await new Promise(process.nextTick);

      expect(memoryService.create).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({ content: 'Hello' }),
      );
    });

    it('ignores a DM from an unlinked user and replies with guidance', async () => {
      prisma.channel.findFirst.mockResolvedValue(null);

      await handlers['messageCreate'](fakeMessage('Hello'));
      await new Promise(process.nextTick);

      expect(memoryService.create).not.toHaveBeenCalled();
      expect(mockUsersFetch).toHaveBeenCalledWith('discord-user-1');
      expect(mockUserSend).toHaveBeenCalledWith(
        expect.stringContaining('link your Discord account'),
      );
    });

    it('consumes a LINK code without creating a memory', async () => {
      channelLinking.consumeDiscordLinkCode.mockResolvedValue('user123');

      await handlers['messageCreate'](fakeMessage('LINK AB12CD'));
      await new Promise(process.nextTick);

      // The 4th arg scopes the code to a bot's owner - null on the shared bot.
      expect(channelLinking.consumeDiscordLinkCode).toHaveBeenCalledWith(
        'AB12CD',
        'discord-user-1',
        'tester',
        null,
      );
      expect(memoryService.create).not.toHaveBeenCalled();
      expect(mockUserSend).toHaveBeenCalledWith(expect.stringContaining("You're linked"));
    });
  });

  describe('per-user bots', () => {
    beforeEach(() => {
      channelCredentials.getDecryptedToken.mockResolvedValue({
        userId: 'user123',
        token: 'user-own-bot-token',
        secondaryToken: null,
        metadata: {},
      });
    });

    it("opens a Gateway connection with the user's own token and marks it active", async () => {
      const connected = await service.connectUserBot('user123');

      expect(connected).toBe(true);
      expect(mockLogin).toHaveBeenCalledWith('user-own-bot-token');
      expect(service.connectedUserBotCount).toBe(1);
      expect(channelCredentials.markStatus).toHaveBeenCalledWith('user123', 'DISCORD', 'ACTIVE');
    });

    it('marks the credential invalid when the token is rejected', async () => {
      mockLogin.mockRejectedValueOnce(new Error('An invalid token was provided'));

      const connected = await service.connectUserBot('user123');

      expect(connected).toBe(false);
      expect(service.connectedUserBotCount).toBe(0);
      expect(channelCredentials.markStatus).toHaveBeenCalledWith(
        'user123',
        'DISCORD',
        'INVALID',
        expect.any(String),
      );
    });

    it('does nothing when the user has no credential of their own', async () => {
      channelCredentials.getDecryptedToken.mockResolvedValue(null);

      expect(await service.connectUserBot('user123')).toBe(false);
      expect(service.connectedUserBotCount).toBe(0);
    });

    it('replaces rather than leaks a connection when a token is re-saved', async () => {
      await service.connectUserBot('user123');
      await service.connectUserBot('user123');

      expect(mockDestroy).toHaveBeenCalledTimes(1);
      expect(service.connectedUserBotCount).toBe(1);
    });

    it('closes the connection on disconnect so a removed bot stops receiving', async () => {
      await service.connectUserBot('user123');
      await service.disconnectUserBot('user123');

      expect(mockDestroy).toHaveBeenCalled();
      expect(service.connectedUserBotCount).toBe(0);
    });

    it('refuses to exceed the connection cap', async () => {
      config.MAX_DISCORD_USER_BOTS = '1';

      expect(await service.connectUserBot('user123')).toBe(true);
      expect(await service.connectUserBot('user456')).toBe(false);
      expect(service.connectedUserBotCount).toBe(1);
      expect(channelCredentials.markStatus).toHaveBeenCalledWith(
        'user456',
        'DISCORD',
        'DISCONNECTED',
        expect.stringContaining('limit'),
      );
    });

    it('reconnects every active user bot on startup, since sockets die with the process', async () => {
      config.DISCORD_BOT_TOKEN = '';
      prisma.channelCredential.findMany.mockResolvedValue([
        { userId: 'user123' },
        { userId: 'user456' },
      ]);

      await service.onModuleInit();

      expect(service.connectedUserBotCount).toBe(2);
    });
  });

  describe('cross-user isolation', () => {
    /** Drives the handler belonging to the most recently created client. */
    async function dmNewestBot(content: string, authorId = 'discord-user-2') {
      await messageHandlers[messageHandlers.length - 1](fakeMessage(content, authorId));
      await new Promise(process.nextTick);
    }

    beforeEach(async () => {
      config.DISCORD_BOT_TOKEN = '';
      channelCredentials.getDecryptedToken.mockResolvedValue({
        userId: 'owner-user',
        token: 'owner-bot-token',
        secondaryToken: null,
        metadata: {},
      });
      await service.connectUserBot('owner-user');
    });

    it("refuses to relay a stranger's DM through someone else's personal bot", async () => {
      // The sender is linked, but to a *different* account than the bot's owner.
      prisma.channel.findFirst.mockResolvedValue({ id: 'chan1', userId: 'someone-else' });

      await dmNewestBot('Hello');

      expect(memoryService.create).not.toHaveBeenCalled();
      expect(mockUserSend).toHaveBeenCalledWith(
        expect.stringContaining("someone else's Zoorzio account"),
      );
    });

    it("processes the owner's own DM through their bot", async () => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'chan1', userId: 'owner-user' });

      await dmNewestBot('Hello');

      expect(memoryService.create).toHaveBeenCalledWith(
        'owner-user',
        expect.objectContaining({ content: 'Hello' }),
      );
    });

    it("scopes link codes to the bot's owner", async () => {
      channelLinking.consumeDiscordLinkCode.mockResolvedValue(null);

      await dmNewestBot('LINK AB12CD');

      expect(channelLinking.consumeDiscordLinkCode).toHaveBeenCalledWith(
        'AB12CD',
        'discord-user-2',
        'tester',
        'owner-user',
      );
    });
  });

  describe('sendMessage', () => {
    it('throws when Discord is not configured', async () => {
      config.DISCORD_BOT_TOKEN = '';
      await expect(service.sendMessage('user123', 'discord-user-1', 'Hi')).rejects.toThrow(
        'not configured',
      );
    });

    it('sends a DM and records the outbound message', async () => {
      await service.onModuleInit();
      prisma.channel.findFirst.mockResolvedValue({ id: 'chan1', userId: 'user123' });
      mockUserSend.mockResolvedValue({ id: 'sent-msg-1' });

      const result = await service.sendMessage('user123', 'discord-user-1', 'Hi there');

      expect(result).toEqual({ success: true, messageId: 'sent-msg-1' });
      expect(prisma.channelMessage.create).toHaveBeenCalled();
    });
  });
});
