import { Test, TestingModule } from '@nestjs/testing';
import { ActionPermissionMode } from '@anchor/database';
import { ActionPolicyService, CONFIGURABLE_TOOLS } from './action-policy.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ActionPolicyService', () => {
  let service: ActionPolicyService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      actionPermission: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ActionPolicyService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ActionPolicyService);
  });

  describe('defaults', () => {
    it('requires confirmation before cancelling an event on someone else’s behalf', async () => {
      await expect(service.requiresConfirmation('user1', 'delete_calendar_event')).resolves.toBe(
        true,
      );
    });

    it('lets low-risk actions run unattended', async () => {
      await expect(service.requiresConfirmation('user1', 'create_reminder')).resolves.toBe(false);
      await expect(service.requiresConfirmation('user1', 'create_calendar_event')).resolves.toBe(
        false,
      );
    });

    it('treats an unknown tool as automatic rather than failing', async () => {
      await expect(service.getMode('user1', 'some_new_tool')).resolves.toBe(
        ActionPermissionMode.AUTO,
      );
    });
  });

  describe('per-user overrides', () => {
    it('prefers the user’s setting over the default', async () => {
      prisma.actionPermission.findUnique.mockResolvedValue({
        mode: ActionPermissionMode.CONFIRM,
      });

      await expect(service.requiresConfirmation('user1', 'send_gmail_message')).resolves.toBe(true);
    });

    it('can relax a default that normally confirms', async () => {
      prisma.actionPermission.findUnique.mockResolvedValue({ mode: ActionPermissionMode.AUTO });

      await expect(service.requiresConfirmation('user1', 'delete_calendar_event')).resolves.toBe(
        false,
      );
    });

    it('looks the override up scoped to the asking user', async () => {
      await service.getMode('user1', 'send_gmail_message');

      expect(prisma.actionPermission.findUnique).toHaveBeenCalledWith({
        where: { userId_toolName: { userId: 'user1', toolName: 'send_gmail_message' } },
      });
    });
  });

  describe('listForUser', () => {
    it('returns every configurable tool with its effective mode', async () => {
      const result = await service.listForUser('user1');

      expect(result).toHaveLength(CONFIGURABLE_TOOLS.length);
      expect(result.find((t) => t.name === 'delete_calendar_event')).toMatchObject({
        mode: ActionPermissionMode.CONFIRM,
        isDefault: true,
      });
    });

    it('marks a tool the user has actually configured as no longer default', async () => {
      prisma.actionPermission.findMany.mockResolvedValue([
        { toolName: 'send_gmail_message', mode: ActionPermissionMode.CONFIRM },
      ]);

      const result = await service.listForUser('user1');

      expect(result.find((t) => t.name === 'send_gmail_message')).toMatchObject({
        mode: ActionPermissionMode.CONFIRM,
        isDefault: false,
      });
    });
  });

  describe('setMode', () => {
    it('stores the choice against the user', async () => {
      await service.setMode('user1', 'send_gmail_message', ActionPermissionMode.CONFIRM);

      expect(prisma.actionPermission.upsert).toHaveBeenCalledWith({
        where: { userId_toolName: { userId: 'user1', toolName: 'send_gmail_message' } },
        update: { mode: ActionPermissionMode.CONFIRM },
        create: {
          userId: 'user1',
          toolName: 'send_gmail_message',
          mode: ActionPermissionMode.CONFIRM,
        },
      });
    });

    it('refuses a tool name that is not configurable', async () => {
      // Otherwise a request could seed rows for arbitrary strings, and a typo
      // would silently look like a saved setting that does nothing.
      await expect(
        service.setMode('user1', 'drop_everything', ActionPermissionMode.AUTO),
      ).rejects.toThrow();
      expect(prisma.actionPermission.upsert).not.toHaveBeenCalled();
    });
  });
});
