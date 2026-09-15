import { Test, TestingModule } from '@nestjs/testing';
import { ToolExecutionStatus } from '@anchor/database';
import { ToolExecutionService } from './tool-execution.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ToolExecutionService', () => {
  let service: ToolExecutionService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      toolExecution: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ToolExecutionService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ToolExecutionService);
  });

  describe('hashArgs', () => {
    it('produces the same hash regardless of key order', async () => {
      // The model does not emit arguments in a stable order, so the hash has to
      // ignore ordering or the idempotency guard would never match a retry.
      const a = service.hashArgs('send_gmail_message', { to: 'a@b.com', subject: 'Hi' });
      const b = service.hashArgs('send_gmail_message', { subject: 'Hi', to: 'a@b.com' });

      expect(a).toBe(b);
    });

    it('distinguishes different arguments', () => {
      const a = service.hashArgs('send_gmail_message', { to: 'a@b.com' });
      const b = service.hashArgs('send_gmail_message', { to: 'c@d.com' });

      expect(a).not.toBe(b);
    });

    it('distinguishes the same arguments to a different tool', () => {
      const a = service.hashArgs('create_calendar_event', { title: 'Sync' });
      const b = service.hashArgs('delete_calendar_event', { title: 'Sync' });

      expect(a).not.toBe(b);
    });

    it('handles nested objects and arrays', () => {
      const a = service.hashArgs('create_calendar_event', {
        title: 'Sync',
        attendees: ['a@b.com'],
        meta: { withMeet: true },
      });
      const b = service.hashArgs('create_calendar_event', {
        meta: { withMeet: true },
        attendees: ['a@b.com'],
        title: 'Sync',
      });

      expect(a).toBe(b);
    });
  });

  describe('findRecentSuccess', () => {
    it('only matches a successful run for the same user, tool and arguments', async () => {
      await service.findRecentSuccess('user1', 'send_gmail_message', 'hash1');

      expect(prisma.toolExecution.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user1',
            toolName: 'send_gmail_message',
            argsHash: 'hash1',
            status: ToolExecutionStatus.SUCCESS,
          }),
        }),
      );
    });

    it('bounds the match to a recent window', async () => {
      await service.findRecentSuccess('user1', 'send_gmail_message', 'hash1');

      const { where } = prisma.toolExecution.findFirst.mock.calls[0][0];
      expect(where.createdAt.gte).toBeInstanceOf(Date);
      expect(where.createdAt.gte.getTime()).toBeLessThan(Date.now());
    });
  });

  describe('claimPendingConfirmation', () => {
    it('refuses an execution belonging to someone else', async () => {
      prisma.toolExecution.findUnique.mockResolvedValue({
        id: 'exec1',
        userId: 'victim',
        status: ToolExecutionStatus.AWAITING_CONFIRMATION,
      });

      await expect(service.claimPendingConfirmation('attacker', 'exec1')).resolves.toBeNull();
      expect(prisma.toolExecution.updateMany).not.toHaveBeenCalled();
    });

    it('refuses one that is not awaiting an answer', async () => {
      prisma.toolExecution.findUnique.mockResolvedValue({
        id: 'exec1',
        userId: 'user1',
        status: ToolExecutionStatus.SUCCESS,
      });

      await expect(service.claimPendingConfirmation('user1', 'exec1')).resolves.toBeNull();
    });

    it('claims a genuine pending confirmation', async () => {
      prisma.toolExecution.findUnique.mockResolvedValue({
        id: 'exec1',
        userId: 'user1',
        status: ToolExecutionStatus.AWAITING_CONFIRMATION,
      });

      await expect(service.claimPendingConfirmation('user1', 'exec1')).resolves.toMatchObject({
        id: 'exec1',
      });
    });

    it('only lets one of two simultaneous taps through', async () => {
      // Double-tapping "Yes" must not send two emails, so the claim is a
      // conditional write and the loser gets nothing back.
      prisma.toolExecution.findUnique.mockResolvedValue({
        id: 'exec1',
        userId: 'user1',
        status: ToolExecutionStatus.AWAITING_CONFIRMATION,
      });
      prisma.toolExecution.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.claimPendingConfirmation('user1', 'exec1')).resolves.toBeNull();
    });
  });

  describe('markFailed', () => {
    it('truncates a long provider error rather than storing it whole', async () => {
      await service.markFailed('exec1', 'x'.repeat(2000));

      const { data } = prisma.toolExecution.update.mock.calls[0][0];
      expect(data.errorMessage.length).toBeLessThanOrEqual(500);
    });
  });

  describe('findPendingConfirmation', () => {
    it('scopes the lookup to the asking user', async () => {
      await service.findPendingConfirmation('user1');

      expect(prisma.toolExecution.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user1',
            status: ToolExecutionStatus.AWAITING_CONFIRMATION,
          }),
        }),
      );
    });
  });
});
