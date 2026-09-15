import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PlanLimitsService } from './plan-limits.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PlanLimitsService', () => {
  let service: PlanLimitsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      subscription: { findUnique: jest.fn() },
      list: { count: jest.fn() },
      reminder: { count: jest.fn() },
      memory: { count: jest.fn() },
      task: { count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PlanLimitsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PlanLimitsService>(PlanLimitsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assertCanCreate — no subscription (free tier)', () => {
    it('should allow creation under the free-tier limit', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.list.count.mockResolvedValue(2);
      await expect(service.assertCanCreate('user1', 'lists')).resolves.toBeUndefined();
    });

    it('should block creation once the free-tier limit is reached', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.list.count.mockResolvedValue(3);
      await expect(service.assertCanCreate('user1', 'lists')).rejects.toThrow(ForbiddenException);
    });

    it('should apply free-tier limits to memories and tasks too', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.memory.count.mockResolvedValue(10);
      prisma.task.count.mockResolvedValue(9);

      await expect(service.assertCanCreate('user1', 'memories')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.assertCanCreate('user1', 'tasks')).resolves.toBeUndefined();
    });

    it('should treat a canceled/past-due subscription the same as no subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ status: 'CANCELED' });
      prisma.reminder.count.mockResolvedValue(5);
      await expect(service.assertCanCreate('user1', 'reminders')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('assertCanCreate — active paid subscription', () => {
    it('should never cap lists/reminders/memories/tasks on any active plan, matching the "unlimited" pricing copy', async () => {
      for (const slug of ['starter', 'pro', 'ultimate']) {
        prisma.subscription.findUnique.mockResolvedValue({ status: 'ACTIVE', plan: { slug } });
        await expect(service.assertCanCreate('user1', 'lists')).resolves.toBeUndefined();
      }
      expect(prisma.list.count).not.toHaveBeenCalled();
    });

    it('should treat a trialing subscription the same as active', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        status: 'TRIALING',
        plan: { slug: 'pro' },
      });
      await expect(service.assertCanCreate('user1', 'memories')).resolves.toBeUndefined();
      expect(prisma.memory.count).not.toHaveBeenCalled();
    });
  });
});
