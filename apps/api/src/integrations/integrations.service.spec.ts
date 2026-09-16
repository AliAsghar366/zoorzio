import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsOAuthService } from './integrations-oauth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../security/encryption.service';
import { IntegrationType } from '@anchor/database';

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let prisma: any;
  let oauthService: any;
  let encryption: any;

  beforeEach(async () => {
    prisma = {
      integration: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      calendar: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
    };

    oauthService = { refreshGoogleToken: jest.fn() };

    // A visible, reversible stand-in for real AES so tests can assert that a
    // value was encrypted before being stored, not just that it round-trips.
    encryption = {
      encrypt: jest.fn(async (value: string) => `enc(${value})`),
      decryptIfEncrypted: jest.fn(async (value: unknown) => {
        if (typeof value !== 'string' || !value) return undefined;
        const match = /^enc\((.*)\)$/.exec(value);
        return match ? match[1] : value;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: IntegrationsOAuthService, useValue: oauthService },
        { provide: EncryptionService, useValue: encryption },
      ],
    }).compile();

    service = module.get(IntegrationsService);
  });

  describe('listForUser', () => {
    it('returns all six catalog cards, all disconnected, when nothing is connected', async () => {
      const result = await service.listForUser('user123');

      expect(result).toHaveLength(6);
      expect(result.every((card) => card.isConnected === false)).toBe(true);
      expect(result.map((c) => c.key)).toEqual([
        'google_workspace',
        'google_calendar',
        'outlook_calendar',
        'github',
        'notion',
        'slack',
      ]);
    });

    it('marks Google Calendar connected when a GOOGLE calendar row exists', async () => {
      const connectedAt = new Date('2026-01-01');
      prisma.calendar.findMany.mockResolvedValue([
        { id: 'c1', provider: 'GOOGLE', createdAt: connectedAt },
      ]);

      const result = await service.listForUser('user123');
      const card = result.find((c) => c.key === 'google_calendar')!;

      expect(card.isConnected).toBe(true);
      expect(card.connectedAt).toEqual(connectedAt);
      // Outlook and the separate Google Workspace integration stay unaffected.
      expect(result.find((c) => c.key === 'outlook_calendar')!.isConnected).toBe(false);
      expect(result.find((c) => c.key === 'google_workspace')!.isConnected).toBe(false);
    });

    it('marks GitHub connected when an Integration row of type GITHUB exists', async () => {
      prisma.integration.findMany.mockResolvedValue([
        { type: IntegrationType.GITHUB, createdAt: new Date('2026-02-01') },
      ]);

      const result = await service.listForUser('user123');

      expect(result.find((c) => c.key === 'github')!.isConnected).toBe(true);
      expect(result.find((c) => c.key === 'notion')!.isConnected).toBe(false);
    });
  });

  describe('connectOAuth', () => {
    it('upserts an Integration row keyed by userId+type', async () => {
      prisma.integration.upsert.mockResolvedValue({ id: 'i1' });

      await service.connectOAuth('user123', 'github', 'gh-token', '');

      expect(prisma.integration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_type: { userId: 'user123', type: IntegrationType.GITHUB } },
          create: expect.objectContaining({
            metadata: { accessToken: 'enc(gh-token)', refreshToken: '' },
          }),
        }),
      );
    });
  });

  describe('credential storage', () => {
    it('never writes an access or refresh token to the database in plaintext', async () => {
      prisma.integration.upsert.mockResolvedValue({ id: 'i1' });

      await service.connectOAuth('user123', 'google_workspace', 'g-token', 'r-token', 3600);

      const { create } = prisma.integration.upsert.mock.calls[0][0];
      expect(create.metadata.accessToken).not.toBe('g-token');
      expect(create.metadata.refreshToken).not.toBe('r-token');
      expect(encryption.encrypt).toHaveBeenCalledWith('g-token');
      expect(encryption.encrypt).toHaveBeenCalledWith('r-token');
    });

    it('decrypts a stored token on the way back out', async () => {
      prisma.integration.findUnique.mockResolvedValue({
        id: 'i1',
        isActive: true,
        metadata: { accessToken: 'enc(gh-token)' },
      });

      await expect(service.getValidAccessToken('user123', 'github')).resolves.toBe('gh-token');
    });
  });

  describe('getValidAccessToken', () => {
    it('throws if the provider is not connected', async () => {
      prisma.integration.findUnique.mockResolvedValue(null);
      await expect(service.getValidAccessToken('user123', 'github')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns the stored token as-is for providers that do not expire (GitHub)', async () => {
      prisma.integration.findUnique.mockResolvedValue({
        id: 'i1',
        isActive: true,
        metadata: { accessToken: 'gh-token' },
      });

      const token = await service.getValidAccessToken('user123', 'github');

      expect(token).toBe('gh-token');
      expect(oauthService.refreshGoogleToken).not.toHaveBeenCalled();
    });

    it('returns the stored Google token as-is when it has not expired yet', async () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      prisma.integration.findUnique.mockResolvedValue({
        id: 'i1',
        isActive: true,
        metadata: { accessToken: 'g-token', refreshToken: 'r-token', expiresAt: future },
      });

      const token = await service.getValidAccessToken('user123', 'google_workspace');

      expect(token).toBe('g-token');
      expect(oauthService.refreshGoogleToken).not.toHaveBeenCalled();
    });

    it('refreshes an expired Google token and persists the new one', async () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      prisma.integration.findUnique.mockResolvedValue({
        id: 'i1',
        isActive: true,
        metadata: { accessToken: 'old-token', refreshToken: 'r-token', expiresAt: past },
      });
      oauthService.refreshGoogleToken.mockResolvedValue({
        accessToken: 'new-token',
        expiresIn: 3600,
      });

      const token = await service.getValidAccessToken('user123', 'google_workspace');

      expect(token).toBe('new-token');
      expect(oauthService.refreshGoogleToken).toHaveBeenCalledWith('r-token');
      expect(prisma.integration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'i1' },
          data: expect.objectContaining({
            metadata: expect.objectContaining({ accessToken: 'enc(new-token)' }),
          }),
        }),
      );
    });
  });

  describe('disconnect', () => {
    it('deletes the Google calendar row for the google_calendar key', async () => {
      await service.disconnect('user123', 'google_calendar');
      expect(prisma.calendar.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user123', provider: 'GOOGLE' },
      });
    });

    it('deletes the Outlook calendar row for the outlook_calendar key', async () => {
      await service.disconnect('user123', 'outlook_calendar');
      expect(prisma.calendar.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user123', provider: 'OUTLOOK' },
      });
    });

    it('deletes the matching Integration row for an OAuth-backed key', async () => {
      await service.disconnect('user123', 'notion');
      expect(prisma.integration.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user123', type: IntegrationType.NOTION },
      });
    });
  });
});
