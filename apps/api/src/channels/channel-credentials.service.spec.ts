import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { ChannelCredentialsService } from './channel-credentials.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../security/encryption.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ChannelType, ChannelCredentialStatus } from '@anchor/database';

describe('ChannelCredentialsService', () => {
  let service: ChannelCredentialsService;
  let prisma: any;
  let encryption: any;
  let http: any;
  let apiUrl: string | undefined;

  beforeEach(async () => {
    prisma = {
      channelCredential: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    encryption = {
      encrypt: jest.fn((v: string) => Promise.resolve(`enc:${v}`)),
      decrypt: jest.fn((v: string) => Promise.resolve(v.replace(/^enc:/, ''))),
    };

    http = { get: jest.fn(), post: jest.fn() };
    apiUrl = 'https://api.example.com';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelCredentialsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EncryptionService, useValue: encryption },
        { provide: HttpService, useValue: http },
        { provide: ConfigService, useValue: { get: () => apiUrl } },
      ],
    }).compile();

    service = module.get<ChannelCredentialsService>(ChannelCredentialsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('saveCredential', () => {
    it('encrypts the token before persisting and never returns it', async () => {
      prisma.channelCredential.findUnique.mockResolvedValue(null);
      prisma.channelCredential.upsert.mockResolvedValue({
        type: ChannelType.TELEGRAM,
        status: ChannelCredentialStatus.PENDING,
        metadata: {},
        lastVerifiedAt: null,
        lastError: null,
        createdAt: new Date(),
      });

      const result = await service.saveCredential('user1', ChannelType.TELEGRAM, {
        token: 'my-bot-token',
      } as any);

      expect(encryption.encrypt).toHaveBeenCalledWith('my-bot-token');
      const call = prisma.channelCredential.upsert.mock.calls[0][0];
      expect(call.create.encryptedToken).toBe('enc:my-bot-token');
      expect(call.create.webhookRoutingKey).toEqual(expect.any(String));
      expect(result).not.toHaveProperty('encryptedToken');
      expect(result).not.toHaveProperty('token');
    });

    it('does not generate a webhook routing key for platforms without a webhook (Discord)', async () => {
      prisma.channelCredential.findUnique.mockResolvedValue(null);
      prisma.channelCredential.upsert.mockResolvedValue({
        type: ChannelType.DISCORD,
        status: ChannelCredentialStatus.PENDING,
        metadata: {},
        lastVerifiedAt: null,
        lastError: null,
        createdAt: new Date(),
      });

      await service.saveCredential('user1', ChannelType.DISCORD, { token: 'discord-token' } as any);

      const call = prisma.channelCredential.upsert.mock.calls[0][0];
      expect(call.create.webhookRoutingKey).toBeNull();
    });

    it('reuses the existing routing key on re-save instead of rotating it', async () => {
      prisma.channelCredential.findUnique.mockResolvedValue({ webhookRoutingKey: 'existing-key' });
      prisma.channelCredential.upsert.mockResolvedValue({
        type: ChannelType.TELEGRAM,
        status: ChannelCredentialStatus.PENDING,
        metadata: {},
        lastVerifiedAt: null,
        lastError: null,
        createdAt: new Date(),
      });

      await service.saveCredential('user1', ChannelType.TELEGRAM, { token: 'new-token' } as any);

      const call = prisma.channelCredential.upsert.mock.calls[0][0];
      expect(call.create.webhookRoutingKey).toBe('existing-key');
    });
  });

  describe('getDecryptedToken', () => {
    it('returns null when the user has no credential for that platform', async () => {
      prisma.channelCredential.findUnique.mockResolvedValue(null);
      const result = await service.getDecryptedToken('user1', ChannelType.TELEGRAM);
      expect(result).toBeNull();
    });

    it('returns null for an invalid credential instead of a broken token', async () => {
      prisma.channelCredential.findUnique.mockResolvedValue({
        userId: 'user1',
        encryptedToken: 'enc:bad',
        encryptedSecondaryToken: null,
        metadata: {},
        status: ChannelCredentialStatus.INVALID,
      });
      const result = await service.getDecryptedToken('user1', ChannelType.TELEGRAM);
      expect(result).toBeNull();
    });

    it('decrypts and returns an active credential', async () => {
      prisma.channelCredential.findUnique.mockResolvedValue({
        userId: 'user1',
        encryptedToken: 'enc:my-token',
        encryptedSecondaryToken: null,
        metadata: { botUsername: 'my_bot' },
        status: ChannelCredentialStatus.ACTIVE,
      });
      const result = await service.getDecryptedToken('user1', ChannelType.TELEGRAM);
      expect(result).toEqual({
        userId: 'user1',
        token: 'my-token',
        secondaryToken: null,
        metadata: { botUsername: 'my_bot' },
      });
    });
  });

  describe('getByRoutingKey', () => {
    it('resolves the owning user from an opaque routing key without needing a userId', async () => {
      prisma.channelCredential.findUnique.mockResolvedValue({
        userId: 'user1',
        encryptedToken: 'enc:my-token',
        encryptedSecondaryToken: null,
        metadata: {},
      });

      const result = await service.getByRoutingKey('opaque-key');

      expect(prisma.channelCredential.findUnique).toHaveBeenCalledWith({
        where: { webhookRoutingKey: 'opaque-key' },
      });
      expect(result?.userId).toBe('user1');
      expect(result?.token).toBe('my-token');
    });

    it('returns null for an unknown routing key', async () => {
      prisma.channelCredential.findUnique.mockResolvedValue(null);
      const result = await service.getByRoutingKey('unknown');
      expect(result).toBeNull();
    });
  });

  describe('testCredential', () => {
    it('marks the credential ACTIVE when the platform verification call succeeds', async () => {
      prisma.channelCredential.findUnique.mockResolvedValue({
        userId: 'user1',
        encryptedToken: 'enc:tok',
        encryptedSecondaryToken: null,
        metadata: {},
        status: ChannelCredentialStatus.PENDING,
      });
      http.get.mockReturnValue(of({ data: { ok: true } }));

      const result = await service.testCredential('user1', ChannelType.TELEGRAM);

      expect(result).toEqual({ success: true });
      expect(prisma.channelCredential.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ChannelCredentialStatus.ACTIVE }),
        }),
      );
    });

    it('marks the credential INVALID when the platform verification call fails', async () => {
      prisma.channelCredential.findUnique.mockResolvedValue({
        userId: 'user1',
        encryptedToken: 'enc:tok',
        encryptedSecondaryToken: null,
        metadata: {},
        status: ChannelCredentialStatus.PENDING,
      });
      http.get.mockReturnValue(throwError(() => new Error('401 Unauthorized')));

      const result = await service.testCredential('user1', ChannelType.TELEGRAM);

      expect(result.success).toBe(false);
      expect(prisma.channelCredential.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ChannelCredentialStatus.INVALID }),
        }),
      );
    });

    it('throws NotFoundException when there is nothing to test', async () => {
      prisma.channelCredential.findUnique.mockResolvedValue(null);
      await expect(service.testCredential('user1', ChannelType.TELEGRAM)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeCredential', () => {
    it('throws NotFoundException when the user has no credential for that platform', async () => {
      prisma.channelCredential.findUnique.mockResolvedValue(null);
      await expect(service.removeCredential('user1', ChannelType.TELEGRAM)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes an owned credential', async () => {
      prisma.channelCredential.findUnique.mockResolvedValue({ id: 'cred1' });
      prisma.channelCredential.delete.mockResolvedValue({});

      const result = await service.removeCredential('user1', ChannelType.TELEGRAM);

      expect(prisma.channelCredential.delete).toHaveBeenCalledWith({ where: { id: 'cred1' } });
      expect(result).toEqual({ success: true });
    });
  });

  describe('list', () => {
    function record(type: ChannelType, webhookRoutingKey: string | null) {
      return {
        type,
        status: ChannelCredentialStatus.ACTIVE,
        metadata: {},
        webhookRoutingKey,
        lastVerifiedAt: null,
        lastError: null,
        createdAt: new Date(),
        encryptedToken: 'enc:secret',
        encryptedSecondaryToken: 'enc:signing-secret',
      };
    }

    it('never includes the encrypted token or secondary secret in the returned view', async () => {
      prisma.channelCredential.findMany.mockResolvedValue([record(ChannelType.TELEGRAM, 'key1')]);

      const result = await service.list('user1');

      expect(result[0]).not.toHaveProperty('encryptedToken');
      expect(result[0]).not.toHaveProperty('encryptedSecondaryToken');
    });

    it('surfaces a Request URL for Slack, which the user must configure by hand', async () => {
      prisma.channelCredential.findMany.mockResolvedValue([record(ChannelType.SLACK, 'slack-key')]);

      const result = await service.list('user1');

      expect(result[0].webhookUrl).toBe('https://api.example.com/channels/slack/events/slack-key');
    });

    it('surfaces no URL at all when API_URL is unset, rather than a broken relative one', async () => {
      apiUrl = undefined;
      prisma.channelCredential.findMany.mockResolvedValue([record(ChannelType.SLACK, 'slack-key')]);

      const result = await service.list('user1');

      expect(result[0].webhookUrl).toBeNull();
    });

    it('does not surface a URL for Telegram, which registers its own webhook', async () => {
      prisma.channelCredential.findMany.mockResolvedValue([record(ChannelType.TELEGRAM, 'tg-key')]);

      const result = await service.list('user1');

      expect(result[0].webhookUrl).toBeNull();
    });
  });
});
