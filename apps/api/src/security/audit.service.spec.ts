import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: any;
  let config: any;

  beforeEach(async () => {
    prisma = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      session: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    config = { get: jest.fn((key: string, fallback?: unknown) => fallback) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should create audit log', async () => {
      const userId = 'user123';
      const action = 'LOGIN_SUCCESS';
      const resource = 'auth';
      const metadata = { email: 'test@example.com' };

      prisma.auditLog.create.mockResolvedValue({});

      await service.log(userId, action, resource, metadata);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId,
          action,
          resource,
          metadata,
        },
      });
    });
  });

  describe('getLogs', () => {
    it('should return audit logs', async () => {
      const userId = 'user123';
      const expectedLogs = [
        { id: 'log1', action: 'LOGIN_SUCCESS' },
        { id: 'log2', action: 'MEMORY_CREATED' },
      ];

      prisma.auditLog.findMany.mockResolvedValue(expectedLogs);

      const result = await service.getLogs(userId);

      expect(result).toEqual(expectedLogs);
    });

    it('should support pagination', async () => {
      const userId = 'user123';
      const limit = 10;
      const offset = 20;

      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.getLogs(userId, limit, offset);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });
    });
  });

  describe('getAllLogs', () => {
    it('should return logs across every user with the acting user attached', async () => {
      const expectedLogs = [
        { id: 'log1', action: 'LOGIN_SUCCESS', user: { email: 'a@b.com', name: 'A' } },
      ];
      prisma.auditLog.findMany.mockResolvedValue(expectedLogs);

      const result = await service.getAllLogs();

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        take: 100,
        skip: 0,
        include: { user: { select: { email: true, name: true } } },
      });
      expect(result).toEqual(expectedLogs);
    });

    it('should return an empty array instead of throwing on a database error', async () => {
      prisma.auditLog.findMany.mockRejectedValue(new Error('db down'));

      const result = await service.getAllLogs();

      expect(result).toEqual([]);
    });
  });

  describe('getSecurityEvents', () => {
    it('should return security events', async () => {
      const userId = 'user123';
      const expectedEvents = [
        { id: 'log1', action: 'LOGIN_SUCCESS' },
        { id: 'log2', action: 'LOGIN_FAILED' },
      ];

      prisma.auditLog.findMany.mockResolvedValue(expectedEvents);

      const result = await service.getSecurityEvents(userId);

      expect(result).toEqual(expectedEvents);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          action: { in: expect.arrayContaining(['LOGIN_SUCCESS', 'LOGIN_FAILED']) },
        },
        orderBy: { createdAt: 'desc' },
        take: expect.any(Number),
      });
    });
  });

  describe('revokeAllSessions', () => {
    it('should revoke all sessions', async () => {
      const userId = 'user123';

      prisma.session.deleteMany.mockResolvedValue({ count: 3 });
      prisma.auditLog.create.mockResolvedValue({});

      await service.revokeAllSessions(userId);

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('purgeOldLogs', () => {
    it('should delete logs older than the default 365-day retention window', async () => {
      config.get.mockImplementation((key: string, fallback?: unknown) => fallback);
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 5 });

      await service.purgeOldLogs();

      const call = prisma.auditLog.deleteMany.mock.calls[0][0];
      const cutoff: Date = call.where.createdAt.lt;
      const daysAgo = (Date.now() - cutoff.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysAgo).toBeGreaterThan(364);
      expect(daysAgo).toBeLessThan(366);
    });

    it('should respect a configured AUDIT_LOG_RETENTION_DAYS override', async () => {
      config.get.mockImplementation((key: string) =>
        key === 'AUDIT_LOG_RETENTION_DAYS' ? '30' : undefined,
      );
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 1 });

      await service.purgeOldLogs();

      const call = prisma.auditLog.deleteMany.mock.calls[0][0];
      const cutoff: Date = call.where.createdAt.lt;
      const daysAgo = (Date.now() - cutoff.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysAgo).toBeGreaterThan(29);
      expect(daysAgo).toBeLessThan(31);
    });

    it('should swallow errors instead of throwing', async () => {
      prisma.auditLog.deleteMany.mockRejectedValue(new Error('db down'));
      await expect(service.purgeOldLogs()).resolves.toBeUndefined();
    });
  });
});
