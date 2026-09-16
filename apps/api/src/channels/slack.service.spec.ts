import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { createHmac } from 'crypto';
import { SlackService } from './slack.service';
import { ChannelLinkingService } from './channel-linking.service';
import { ChannelCredentialsService } from './channel-credentials.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';

describe('SlackService', () => {
  let service: SlackService;
  let prisma: any;
  let memoryService: any;
  let http: any;
  let channelLinking: any;
  let channelCredentials: any;
  let config: Record<string, string>;

  beforeEach(async () => {
    prisma = {
      channel: { findFirst: jest.fn() },
      channelMessage: { create: jest.fn() },
    };
    memoryService = { create: jest.fn() };
    channelLinking = { consumeSlackLinkCode: jest.fn() };
    http = {
      post: jest
        .fn()
        .mockReturnValue(of({ data: { ok: true, channel: { id: 'D123' }, ts: '1111.2222' } })),
    };
    config = { SLACK_BOT_TOKEN: 'xoxb-test', SLACK_SIGNING_SECRET: 'test-signing-secret' };
    channelCredentials = {
      getDecryptedToken: jest.fn().mockResolvedValue(null),
      getByRoutingKey: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackService,
        { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
        { provide: PrismaService, useValue: prisma },
        { provide: MemoryService, useValue: memoryService },
        { provide: HttpService, useValue: http },
        { provide: ChannelLinkingService, useValue: channelLinking },
        { provide: ChannelCredentialsService, useValue: channelCredentials },
      ],
    }).compile();

    service = module.get(SlackService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialize', () => {
    it('reports initialized when a bot token is set', async () => {
      expect(await service.initialize()).toEqual({ status: 'initialized' });
    });
  });

  describe('verifySignature', () => {
    function sign(body: string, timestamp: string) {
      return (
        'v0=' +
        createHmac('sha256', config.SLACK_SIGNING_SECRET)
          .update(`v0:${timestamp}:${body}`)
          .digest('hex')
      );
    }

    it('accepts a correctly-signed request within the time window', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = '{"type":"event_callback"}';
      expect(service.verifySignature(body, timestamp, sign(body, timestamp))).toBe(true);
    });

    it('rejects a request with a forged signature', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      expect(service.verifySignature('{"type":"event_callback"}', timestamp, 'v0=deadbeef')).toBe(
        false,
      );
    });

    it('rejects a request signed for different body content', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signatureForOtherBody = sign('{"type":"something_else"}', timestamp);
      expect(
        service.verifySignature('{"type":"event_callback"}', timestamp, signatureForOtherBody),
      ).toBe(false);
    });

    it('rejects a replayed request older than 5 minutes', () => {
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
      const body = '{"type":"event_callback"}';
      expect(service.verifySignature(body, oldTimestamp, sign(body, oldTimestamp))).toBe(false);
    });

    it('rejects when no signing secret is configured', () => {
      config.SLACK_SIGNING_SECRET = '';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      expect(service.verifySignature('{}', timestamp, 'v0=anything')).toBe(false);
    });
  });

  describe('handleEvent', () => {
    it('echoes the challenge back for url_verification', async () => {
      const result = await service.handleEvent({ type: 'url_verification', challenge: 'abc123' });
      expect(result).toEqual({ challenge: 'abc123' });
    });

    it('processes a DM message event from an already-linked user', async () => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'chan1', userId: 'user123' });

      await service.handleEvent({
        type: 'event_callback',
        event: {
          type: 'message',
          channel_type: 'im',
          user: 'U1',
          text: 'Hello',
          channel: 'D1',
          ts: '1.1',
        },
      });

      expect(memoryService.create).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({ content: 'Hello' }),
      );
    });

    it('ignores messages from bots to avoid loops', async () => {
      await service.handleEvent({
        type: 'event_callback',
        event: {
          type: 'message',
          channel_type: 'im',
          user: 'U1',
          text: 'Hello',
          channel: 'D1',
          ts: '1.1',
          bot_id: 'B1',
        },
      });
      expect(memoryService.create).not.toHaveBeenCalled();
    });

    it('ignores channel messages (only DMs are captured)', async () => {
      await service.handleEvent({
        type: 'event_callback',
        event: {
          type: 'message',
          channel_type: 'channel',
          user: 'U1',
          text: 'Hello',
          channel: 'C1',
          ts: '1.1',
        },
      });
      expect(memoryService.create).not.toHaveBeenCalled();
    });

    it('ignores a DM from an unlinked user and replies with guidance', async () => {
      prisma.channel.findFirst.mockResolvedValue(null);

      await service.handleEvent({
        type: 'event_callback',
        event: {
          type: 'message',
          channel_type: 'im',
          user: 'U1',
          text: 'Hello',
          channel: 'D1',
          ts: '1.1',
        },
      });

      expect(memoryService.create).not.toHaveBeenCalled();
      expect(http.post).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({ channel: 'D1' }),
        expect.any(Object),
      );
    });

    it('consumes a LINK code without creating a memory', async () => {
      channelLinking.consumeSlackLinkCode.mockResolvedValue('user123');

      await service.handleEvent({
        type: 'event_callback',
        event: {
          type: 'message',
          channel_type: 'im',
          user: 'U1',
          text: 'LINK AB12CD',
          channel: 'D1',
          ts: '1.1',
        },
      });

      expect(channelLinking.consumeSlackLinkCode).toHaveBeenCalledWith('AB12CD', 'U1');
      expect(memoryService.create).not.toHaveBeenCalled();
    });
  });

  describe('handleEventForRoutingKey', () => {
    const OWN_SECRET = 'user-own-signing-secret';

    function signWith(secret: string, body: string, timestamp: string) {
      return 'v0=' + createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex');
    }

    function linkedCredential() {
      return {
        userId: 'user123',
        token: 'xoxb-user-own',
        secondaryToken: OWN_SECRET,
        metadata: {},
      };
    }

    it('ignores an event for an unknown routing key without processing it', async () => {
      channelCredentials.getByRoutingKey.mockResolvedValue(null);

      const result = await service.handleEventForRoutingKey(
        'unknown-key',
        { type: 'event_callback' },
        '{}',
        '123',
        'sig',
      );

      expect(result).toEqual({ ok: true });
      expect(memoryService.create).not.toHaveBeenCalled();
    });

    it('answers the url_verification handshake before requiring a signature', async () => {
      channelCredentials.getByRoutingKey.mockResolvedValue(linkedCredential());

      const result = await service.handleEventForRoutingKey(
        'key1',
        { type: 'url_verification', challenge: 'abc123' },
        '{}',
        '',
        '',
      );

      expect(result).toEqual({ challenge: 'abc123' });
    });

    it("verifies against the resolved user's own signing secret, not the platform's", async () => {
      channelCredentials.getByRoutingKey.mockResolvedValue(linkedCredential());
      prisma.channel.findFirst.mockResolvedValue({ id: 'channel123', userId: 'user123' });

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          channel_type: 'im',
          user: 'U1',
          text: 'hi',
          ts: '1.1',
          channel: 'D1',
        },
      };
      const rawBody = JSON.stringify(payload);

      const result = await service.handleEventForRoutingKey(
        'key1',
        payload,
        rawBody,
        timestamp,
        signWith(OWN_SECRET, rawBody, timestamp),
      );

      expect(result).toEqual({ ok: true });
      expect(memoryService.create).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({ content: 'hi' }),
      );
    });

    it("rejects an event signed with the platform's secret instead of the owner's", async () => {
      channelCredentials.getByRoutingKey.mockResolvedValue(linkedCredential());

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = {
        type: 'event_callback',
        event: { type: 'message', channel_type: 'im', user: 'U1', text: 'hi' },
      };
      const rawBody = JSON.stringify(payload);

      const result = await service.handleEventForRoutingKey(
        'key1',
        payload,
        rawBody,
        timestamp,
        signWith(config.SLACK_SIGNING_SECRET, rawBody, timestamp),
      );

      expect(result).toEqual({ error: 'invalid_signature' });
      expect(memoryService.create).not.toHaveBeenCalled();
    });

    it('rejects a forged signature', async () => {
      channelCredentials.getByRoutingKey.mockResolvedValue(linkedCredential());
      const timestamp = Math.floor(Date.now() / 1000).toString();

      const result = await service.handleEventForRoutingKey(
        'key1',
        { type: 'event_callback' },
        '{}',
        timestamp,
        'v0=deadbeef',
      );

      expect(result).toEqual({ error: 'invalid_signature' });
      expect(memoryService.create).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('opens a DM conversation and posts the message', async () => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'chan1', userId: 'user123' });

      const result = await service.sendMessage('user123', 'U1', 'Hi there');

      expect(result).toEqual({ success: true, messageId: '1111.2222' });
      expect(http.post).toHaveBeenCalledWith(
        'https://slack.com/api/conversations.open',
        { users: 'U1' },
        expect.any(Object),
      );
      expect(http.post).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        { channel: 'D123', text: 'Hi there' },
        expect.any(Object),
      );
    });
  });
});
