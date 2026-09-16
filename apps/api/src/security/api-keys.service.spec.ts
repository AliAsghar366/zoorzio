import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from './encryption.service';
import { AuditService } from './audit.service';

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let prisma: any;
  let encryption: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      apiKey: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    encryption = {
      generateApiKey: jest
        .fn()
        .mockResolvedValue({ key: 'raw-key', hash: 'hashed', prefix: 'raw-key1' }),
    };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        { provide: PrismaService, useValue: prisma },
        { provide: EncryptionService, useValue: encryption },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<ApiKeysService>(ApiKeysService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should default to read-only and return the raw key exactly once', async () => {
      prisma.apiKey.create.mockResolvedValue({
        id: 'key1',
        name: 'My Key',
        prefix: 'raw-key1',
        permissions: { read: true, write: false },
        expiresAt: null,
        createdAt: new Date(),
      });

      const result = await service.create('user1', { name: 'My Key' });

      expect(prisma.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user1',
            permissions: { read: true, write: false },
            expiresAt: null,
          }),
        }),
      );
      expect(result.key).toBe('raw-key');
      expect(audit.log).toHaveBeenCalledWith(
        'user1',
        'API_KEY_CREATED',
        'api_key',
        expect.any(Object),
      );
    });

    it('should grant write access only when explicitly requested', async () => {
      prisma.apiKey.create.mockResolvedValue({
        id: 'key1',
        permissions: { read: true, write: true },
      });

      await service.create('user1', { name: 'Full access key', write: true });

      expect(prisma.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ permissions: { read: true, write: true } }),
        }),
      );
    });

    it('should compute expiresAt from expiresInDays', async () => {
      prisma.apiKey.create.mockResolvedValue({ id: 'key1' });
      const before = Date.now();

      await service.create('user1', { name: 'Temp key', expiresInDays: 30 });

      const call = prisma.apiKey.create.mock.calls[0][0];
      const expiresAt = call.data.expiresAt as Date;
      expect(expiresAt.getTime()).toBeGreaterThan(before + 29 * 24 * 60 * 60 * 1000);
    });
  });

  describe('list', () => {
    it('should never select the key hash', async () => {
      prisma.apiKey.findMany.mockResolvedValue([]);
      await service.list('user1');

      const call = prisma.apiKey.findMany.mock.calls[0][0];
      expect(call.select.keyHash).toBeUndefined();
      expect(call.where).toEqual({ userId: 'user1' });
    });
  });

  describe('revoke', () => {
    it('should throw NotFoundException when the key belongs to another user', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key1',
        userId: 'other-user',
        isActive: true,
      });
      await expect(service.revoke('user1', 'key1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when the key does not exist', async () => {
      prisma.apiKey.findUnique.mockResolvedValue(null);
      await expect(service.revoke('user1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when the key is already revoked', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ id: 'key1', userId: 'user1', isActive: false });
      await expect(service.revoke('user1', 'key1')).rejects.toThrow(ForbiddenException);
    });

    it('should deactivate an active, owned key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key1',
        userId: 'user1',
        isActive: true,
        name: 'x',
        prefix: 'p',
      });
      prisma.apiKey.update.mockResolvedValue({});

      const result = await service.revoke('user1', 'key1');

      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key1' },
        data: { isActive: false },
      });
      expect(result).toEqual({ success: true });
    });
  });
});
