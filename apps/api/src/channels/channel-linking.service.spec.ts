import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { ChannelLinkingService } from './channel-linking.service';
import { ChannelCredentialsService } from './channel-credentials.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelType } from '@anchor/database';

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('ChannelLinkingService', () => {
  let service: ChannelLinkingService;
  let prisma: any;
  let config: Record<string, string>;

  beforeEach(async () => {
    prisma = {
      channelVerification: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      channel: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
        upsert: jest.fn(),
      },
      // The QR-linked session: no number until pairing completes.
      whatsAppUnofficialSession: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };

    config = {
      WHATSAPP_BUSINESS_PHONE_NUMBER: '',
      TELEGRAM_BOT_USERNAME: '',
      TWILIO_PHONE_NUMBER: '',
      DISCORD_BOT_TOKEN: '',
      SLACK_BOT_TOKEN: '',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelLinkingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
        {
          provide: ChannelCredentialsService,
          useValue: { getDecryptedToken: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    service = module.get(ChannelLinkingService);
  });

  describe('createWhatsAppLinkCode', () => {
    it('stores a hashed code and reports not-configured when no business number is set', async () => {
      const result = await service.createWhatsAppLinkCode('user123');

      expect(result.code).toMatch(/^[A-Z0-9]{6}$/);
      expect(result.configured).toBe(false);
      expect(result.waLink).toBeNull();
      expect(prisma.channelVerification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user123', channelType: ChannelType.WHATSAPP }),
        }),
      );
      // The raw code is never persisted - only its hash.
      const persisted = prisma.channelVerification.create.mock.calls[0][0].data;
      expect(persisted.codeHash).not.toBe(result.code);
    });

    it('builds the deep link from the QR-linked number when no env var is set', async () => {
      // Scanning the QR is the whole setup; the paired number is already known,
      // so it must not also need restating in WHATSAPP_BUSINESS_PHONE_NUMBER.
      prisma.whatsAppUnofficialSession.findUnique.mockResolvedValue({
        status: 'CONNECTED',
        connectedNumber: '447848472822',
      });
      const result = await service.createWhatsAppLinkCode('user123');

      expect(result.configured).toBe(true);
      expect(result.waLink).toBe(
        `https://wa.me/447848472822?text=${encodeURIComponent(`LINK ${result.code}`)}`,
      );
    });

    it('does not advertise a session that is not actually connected', async () => {
      prisma.whatsAppUnofficialSession.findUnique.mockResolvedValue({
        status: 'CONNECTING',
        connectedNumber: '447848472822',
      });
      const result = await service.createWhatsAppLinkCode('user123');

      expect(result.configured).toBe(false);
      expect(result.waLink).toBeNull();
    });

    it('builds a wa.me deep link when a business number is configured', async () => {
      config.WHATSAPP_BUSINESS_PHONE_NUMBER = '+1 (234) 567-8900';
      const result = await service.createWhatsAppLinkCode('user123');

      expect(result.configured).toBe(true);
      expect(result.waLink).toBe(
        `https://wa.me/12345678900?text=${encodeURIComponent(`LINK ${result.code}`)}`,
      );
    });
  });

  describe('createTelegramLinkToken', () => {
    it('reports not-configured when no bot username is set', async () => {
      const result = await service.createTelegramLinkToken('user123');
      expect(result.configured).toBe(false);
      expect(result.deepLink).toBeNull();
    });

    it('builds a t.me deep link when a bot username is configured', async () => {
      config.TELEGRAM_BOT_USERNAME = 'zoorzio_bot';
      const result = await service.createTelegramLinkToken('user123');
      expect(result.configured).toBe(true);
      expect(result.deepLink).toMatch(/^https:\/\/t\.me\/zoorzio_bot\?start=[0-9a-f]{32}$/);
    });
  });

  describe('consumeWhatsAppLinkCode', () => {
    it('links the phone number to the verified user and marks the code used', async () => {
      prisma.channelVerification.findUnique.mockResolvedValue({
        id: 'v1',
        userId: 'user123',
        channelType: ChannelType.WHATSAPP,
        codeHash: hash('AB12CD'),
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.channel.findUnique.mockResolvedValue(null);

      const userId = await service.consumeWhatsAppLinkCode('ab12cd', '923001234567');

      expect(userId).toBe('user123');
      expect(prisma.channel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type_externalId: { type: ChannelType.WHATSAPP, externalId: '923001234567' } },
          create: expect.objectContaining({
            userId: 'user123',
            type: ChannelType.WHATSAPP,
            externalId: '923001234567',
          }),
        }),
      );
      expect(prisma.channelVerification.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('returns null for an unknown code', async () => {
      prisma.channelVerification.findUnique.mockResolvedValue(null);
      expect(await service.consumeWhatsAppLinkCode('ZZZZZZ', '923001234567')).toBeNull();
      expect(prisma.channel.upsert).not.toHaveBeenCalled();
    });

    it('returns null for an expired code', async () => {
      prisma.channelVerification.findUnique.mockResolvedValue({
        id: 'v1',
        userId: 'user123',
        channelType: ChannelType.WHATSAPP,
        codeHash: hash('AB12CD'),
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      expect(await service.consumeWhatsAppLinkCode('AB12CD', '923001234567')).toBeNull();
      expect(prisma.channel.upsert).not.toHaveBeenCalled();
    });

    it('returns null for an already-used code (no replay)', async () => {
      prisma.channelVerification.findUnique.mockResolvedValue({
        id: 'v1',
        userId: 'user123',
        channelType: ChannelType.WHATSAPP,
        codeHash: hash('AB12CD'),
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });
      expect(await service.consumeWhatsAppLinkCode('AB12CD', '923001234567')).toBeNull();
    });

    it('refuses to relink a number that already belongs to a different account', async () => {
      prisma.channelVerification.findUnique.mockResolvedValue({
        id: 'v1',
        userId: 'user123',
        channelType: ChannelType.WHATSAPP,
        codeHash: hash('AB12CD'),
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.channel.findUnique.mockResolvedValue({ id: 'existing-chan', userId: 'someone-else' });

      const userId = await service.consumeWhatsAppLinkCode('AB12CD', '923001234567');

      expect(userId).toBeNull();
      expect(prisma.channel.upsert).not.toHaveBeenCalled();
    });

    it('is case- and whitespace-insensitive when matching the typed code', async () => {
      prisma.channelVerification.findUnique.mockResolvedValue({
        id: 'v1',
        userId: 'user123',
        channelType: ChannelType.WHATSAPP,
        codeHash: hash('AB12CD'),
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.channel.findUnique.mockResolvedValue(null);

      const userId = await service.consumeWhatsAppLinkCode('  ab12cd  ', '923001234567');
      expect(userId).toBe('user123');
    });
  });

  describe('consumeTelegramLinkToken', () => {
    it('links the chat to the verified user', async () => {
      prisma.channelVerification.findUnique.mockResolvedValue({
        id: 'v1',
        userId: 'user123',
        channelType: ChannelType.TELEGRAM,
        codeHash: hash('sometoken'),
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.channel.findUnique.mockResolvedValue(null);

      const userId = await service.consumeTelegramLinkToken('sometoken', '987654321', 'Jane Doe');

      expect(userId).toBe('user123');
      expect(prisma.channel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            userId: 'user123',
            type: ChannelType.TELEGRAM,
            externalId: '987654321',
            name: 'Jane Doe',
          }),
        }),
      );
    });

    it('does not accept a WhatsApp code as a Telegram token (type-scoped)', async () => {
      prisma.channelVerification.findUnique.mockResolvedValue({
        id: 'v1',
        userId: 'user123',
        channelType: ChannelType.WHATSAPP,
        codeHash: hash('sometoken'),
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      expect(await service.consumeTelegramLinkToken('sometoken', '987654321')).toBeNull();
    });
  });

  describe('createSmsLinkCode', () => {
    it('reports not-configured with no Twilio number set', async () => {
      const result = await service.createSmsLinkCode('user123');
      expect(result.configured).toBe(false);
      expect(result.smsLink).toBeNull();
    });

    it('builds an sms: deep link when a Twilio number is configured', async () => {
      config.TWILIO_PHONE_NUMBER = '+1 (234) 567-8900';
      const result = await service.createSmsLinkCode('user123');
      expect(result.configured).toBe(true);
      expect(result.smsLink).toBe(
        `sms:+12345678900?body=${encodeURIComponent(`LINK ${result.code}`)}`,
      );
    });
  });

  describe('createDiscordLinkCode', () => {
    it('reports configuration status based on DISCORD_BOT_TOKEN', async () => {
      expect((await service.createDiscordLinkCode('user123')).configured).toBe(false);
      config.DISCORD_BOT_TOKEN = 'token';
      expect((await service.createDiscordLinkCode('user123')).configured).toBe(true);
    });
  });

  describe('createSlackLinkCode', () => {
    it('reports configuration status based on SLACK_BOT_TOKEN', async () => {
      expect((await service.createSlackLinkCode('user123')).configured).toBe(false);
      config.SLACK_BOT_TOKEN = 'token';
      expect((await service.createSlackLinkCode('user123')).configured).toBe(true);
    });
  });

  describe('consumeSmsLinkCode / consumeDiscordLinkCode / consumeSlackLinkCode', () => {
    it('links an SMS number to the verified user', async () => {
      prisma.channelVerification.findUnique.mockResolvedValue({
        id: 'v1',
        userId: 'user123',
        channelType: ChannelType.SMS,
        codeHash: hash('AB12CD'),
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.channel.findUnique.mockResolvedValue(null);

      expect(await service.consumeSmsLinkCode('ab12cd', '+15551234567')).toBe('user123');
    });

    it('links a Discord user id to the verified user', async () => {
      prisma.channelVerification.findUnique.mockResolvedValue({
        id: 'v1',
        userId: 'user123',
        channelType: ChannelType.DISCORD,
        codeHash: hash('AB12CD'),
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.channel.findUnique.mockResolvedValue(null);

      expect(await service.consumeDiscordLinkCode('AB12CD', 'discord-1', 'Someone')).toBe(
        'user123',
      );
      expect(prisma.channel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            type: ChannelType.DISCORD,
            externalId: 'discord-1',
            name: 'Someone',
          }),
        }),
      );
    });

    it('links a Slack user id to the verified user', async () => {
      prisma.channelVerification.findUnique.mockResolvedValue({
        id: 'v1',
        userId: 'user123',
        channelType: ChannelType.SLACK,
        codeHash: hash('AB12CD'),
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.channel.findUnique.mockResolvedValue(null);

      expect(await service.consumeSlackLinkCode('AB12CD', 'U1')).toBe('user123');
    });

    it('does not cross-accept a code between different channel types', async () => {
      prisma.channelVerification.findUnique.mockResolvedValue({
        id: 'v1',
        userId: 'user123',
        channelType: ChannelType.SMS,
        codeHash: hash('AB12CD'),
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      expect(await service.consumeDiscordLinkCode('AB12CD', 'discord-1')).toBeNull();
      expect(await service.consumeSlackLinkCode('AB12CD', 'U1')).toBeNull();
    });
  });

  describe('getLinkedChannels', () => {
    it('returns only the messaging-channel types for the given user', async () => {
      prisma.channel.findMany.mockResolvedValue([{ id: 'c1', type: ChannelType.WHATSAPP }]);
      const result = await service.getLinkedChannels('user123');
      expect(result).toEqual([{ id: 'c1', type: ChannelType.WHATSAPP }]);
      expect(prisma.channel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user123',
            type: {
              in: [
                ChannelType.WHATSAPP,
                ChannelType.TELEGRAM,
                ChannelType.SMS,
                ChannelType.DISCORD,
                ChannelType.SLACK,
              ],
            },
          },
        }),
      );
    });
  });

  describe('unlinkChannel', () => {
    it('deletes a channel owned by the caller', async () => {
      prisma.channel.findUnique.mockResolvedValue({ id: 'c1', userId: 'user123' });
      const result = await service.unlinkChannel('user123', 'c1');
      expect(result).toEqual({ success: true });
      expect(prisma.channel.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });

    it('throws NotFoundException for a channel that does not exist', async () => {
      prisma.channel.findUnique.mockResolvedValue(null);
      await expect(service.unlinkChannel('user123', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the channel belongs to someone else', async () => {
      prisma.channel.findUnique.mockResolvedValue({ id: 'c1', userId: 'someone-else' });
      await expect(service.unlinkChannel('user123', 'c1')).rejects.toThrow(ForbiddenException);
    });
  });
});
