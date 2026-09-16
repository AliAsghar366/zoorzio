import { Test, TestingModule } from '@nestjs/testing';
import { GamificationService } from './gamification.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GamificationService', () => {
  let service: GamificationService;
  let prisma: any;

  const zeroCounts = () => {
    prisma.memory.count.mockResolvedValue(0);
    prisma.list.count.mockResolvedValue(0);
    prisma.reminder.count.mockResolvedValue(0);
    prisma.task.count.mockResolvedValue(0);
    prisma.share.count.mockResolvedValue(0);
    prisma.channel.count.mockResolvedValue(0);
    prisma.calendar.count.mockResolvedValue(0);
    prisma.friendship.count.mockResolvedValue(0);
    prisma.friendReminder.count.mockResolvedValue(0);
    prisma.subscription.findUnique.mockResolvedValue(null);
  };

  beforeEach(async () => {
    prisma = {
      memory: { count: jest.fn() },
      list: { count: jest.fn() },
      reminder: { count: jest.fn() },
      task: { count: jest.fn() },
      share: { count: jest.fn() },
      channel: { count: jest.fn() },
      calendar: { count: jest.fn() },
      friendship: { count: jest.fn() },
      friendReminder: { count: jest.fn() },
      subscription: { findUnique: jest.fn() },
    };
    zeroCounts();

    const module: TestingModule = await Test.createTestingModule({
      providers: [GamificationService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should report exactly 21 total actions', async () => {
    const progress = await service.getProgress('user1');
    expect(progress.total).toBe(21);
    expect(progress.actions).toHaveLength(21);
  });

  it('should report 0 completed for a brand-new user with no activity', async () => {
    const progress = await service.getProgress('user1');
    expect(progress.completed).toBe(0);
    expect(progress.actions.every((a) => !a.completed)).toBe(true);
  });

  it('should report every action complete for a fully active user', async () => {
    prisma.memory.count.mockResolvedValueOnce(10).mockResolvedValueOnce(10); // memoryCount, keptMemoryCount
    prisma.list.count.mockResolvedValue(3);
    prisma.reminder.count.mockResolvedValue(10);
    prisma.task.count
      .mockResolvedValueOnce(5) // taskCount
      .mockResolvedValueOnce(5) // completedTaskCount
      .mockResolvedValueOnce(1) // taskWithDueDateCount
      .mockResolvedValueOnce(0); // overdueTaskCount
    prisma.share.count.mockResolvedValue(1);
    prisma.channel.count.mockResolvedValue(1);
    prisma.calendar.count.mockResolvedValue(1);
    prisma.friendship.count.mockResolvedValue(5);
    prisma.friendReminder.count.mockResolvedValue(1);
    prisma.subscription.findUnique.mockResolvedValue({ status: 'ACTIVE' });

    const progress = await service.getProgress('user1');

    expect(progress.completed).toBe(21);
  });

  it('should not count a canceled/past-due subscription as a paid plan', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ status: 'CANCELED' });
    const progress = await service.getProgress('user1');
    const upgrade = progress.actions.find((a) => a.key === 'upgrade_plan');
    expect(upgrade?.completed).toBe(false);
  });

  it('should treat a trialing subscription as a paid plan', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ status: 'TRIALING' });
    const progress = await service.getProgress('user1');
    const upgrade = progress.actions.find((a) => a.key === 'upgrade_plan');
    expect(upgrade?.completed).toBe(true);
  });

  it('should not award "clear all overdue tasks" to a user with zero tasks at all', async () => {
    // taskCount=0, overdueTaskCount=0 - completing nothing shouldn't count as "clearing" anything.
    const progress = await service.getProgress('user1');
    const cleared = progress.actions.find((a) => a.key === 'no_overdue_tasks');
    expect(cleared?.completed).toBe(false);
  });
});
