import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../security/audit.service';
import { AuthService } from '../auth/auth.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;
  let auditService: any;
  let authService: any;

  beforeEach(async () => {
    prisma = {
      user: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
      subscription: {
        count: jest.fn(),
        groupBy: jest.fn(),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
      plan: { findUnique: jest.fn() },
      memory: { count: jest.fn() },
      task: { count: jest.fn() },
      reminder: { count: jest.fn() },
    };

    auditService = { getAllLogs: jest.fn(), log: jest.fn() };
    authService = { impersonate: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listUsers', () => {
    it('should return users with subscription/plan and usage counts', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'a@b.com' }]);

      const result = await service.listUsers();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
      expect(result).toEqual([{ id: 'u1', email: 'a@b.com' }]);
    });
  });

  describe('getStats', () => {
    it('should aggregate platform-wide counts', async () => {
      prisma.user.count.mockResolvedValue(5);
      prisma.subscription.count.mockResolvedValue(3);
      prisma.memory.count.mockResolvedValue(10);
      prisma.task.count.mockResolvedValue(7);
      prisma.reminder.count.mockResolvedValue(4);
      prisma.subscription.groupBy.mockResolvedValue([{ planId: 'p1', _count: 3 }]);

      const result = await service.getStats();

      expect(result).toEqual({
        totalUsers: 5,
        activeSubscriptions: 3,
        totalMemories: 10,
        totalTasks: 7,
        totalReminders: 4,
        planBreakdown: [{ planId: 'p1', _count: 3 }],
      });
    });
  });

  describe('getAuditLogs', () => {
    it('should delegate to AuditService.getAllLogs with defaults', async () => {
      auditService.getAllLogs.mockResolvedValue([{ id: 'log1', action: 'LOGIN_SUCCESS' }]);

      const result = await service.getAuditLogs();

      expect(auditService.getAllLogs).toHaveBeenCalledWith(100, 0);
      expect(result).toEqual([{ id: 'log1', action: 'LOGIN_SUCCESS' }]);
    });

    it('should pass through explicit limit/offset', async () => {
      auditService.getAllLogs.mockResolvedValue([]);

      await service.getAuditLogs(20, 40);

      expect(auditService.getAllLogs).toHaveBeenCalledWith(20, 40);
    });
  });

  describe('exportAuditLogsCsv', () => {
    it('should render logs as a CSV with a header row', async () => {
      auditService.getAllLogs.mockResolvedValue([
        {
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          user: { email: 'a@b.com' },
          action: 'LOGIN_SUCCESS',
          resource: 'auth',
          ipAddress: '127.0.0.1',
        },
      ]);

      const csv = await service.exportAuditLogsCsv();

      expect(csv.split('\n')[0]).toBe('When,User,Action,Resource,IP Address');
      expect(csv).toContain('a@b.com,LOGIN_SUCCESS,auth,127.0.0.1');
    });

    it('should quote fields containing commas so the CSV does not misalign', async () => {
      auditService.getAllLogs.mockResolvedValue([
        {
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          user: { email: 'a@b.com' },
          action: 'SUSPICIOUS_INPUT_DETECTED',
          resource: '/lists, archived',
          ipAddress: null,
        },
      ]);

      const csv = await service.exportAuditLogsCsv();
      expect(csv).toContain('"/lists, archived"');
    });
  });

  describe('setUserPlan', () => {
    it('should throw NotFoundException when the target user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.setUserPlan('admin1', 'ghost', 'plan1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should clear the subscription when planId is omitted', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user1' });
      prisma.subscription.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.setUserPlan('admin1', 'user1');

      expect(prisma.subscription.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user1' } });
      expect(auditService.log).toHaveBeenCalledWith(
        'admin1',
        'ADMIN_PLAN_OVERRIDE',
        'subscription',
        expect.objectContaining({ targetUserId: 'user1', planId: null }),
      );
      expect(result).toEqual({ success: true, subscription: null });
    });

    it('should throw NotFoundException for an unknown or inactive plan', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user1' });
      prisma.plan.findUnique.mockResolvedValue(null);
      await expect(service.setUserPlan('admin1', 'user1', 'bad-plan')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should upsert an active subscription for a valid plan', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user1' });
      prisma.plan.findUnique.mockResolvedValue({ id: 'plan1', slug: 'pro', isActive: true });
      prisma.subscription.upsert.mockResolvedValue({
        userId: 'user1',
        planId: 'plan1',
        status: 'ACTIVE',
      });

      const result = await service.setUserPlan('admin1', 'user1', 'plan1');

      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user1' },
          update: { planId: 'plan1', status: 'ACTIVE' },
          create: { userId: 'user1', planId: 'plan1', status: 'ACTIVE' },
        }),
      );
      expect(result.success).toBe(true);
    });
  });

  describe('impersonate', () => {
    it('should delegate to AuthService.impersonate', async () => {
      authService.impersonate.mockResolvedValue({ accessToken: 'tok', user: { id: 'user1' } });

      const result = await service.impersonate('admin1', 'user1');

      expect(authService.impersonate).toHaveBeenCalledWith('admin1', 'user1');
      expect(result).toEqual({ accessToken: 'tok', user: { id: 'user1' } });
    });
  });
});
