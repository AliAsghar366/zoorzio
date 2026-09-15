import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import {
  InteractiveReplyService,
  confirmButtonId,
  reminderButtonId,
} from './interactive-reply.service';
import { RemindersService } from '../reminders/reminders.service';
import { ChatService } from '../chat/chat.service';

describe('InteractiveReplyService', () => {
  let service: InteractiveReplyService;
  let reminders: any;
  let chat: any;

  beforeEach(async () => {
    reminders = {
      completeFromReminderAction: jest.fn(),
      cancelFromReminderAction: jest.fn(),
      snooze: jest.fn().mockResolvedValue({
        id: 'r1',
        title: 'Submit application',
        scheduledAt: new Date('2026-09-03T17:00:00.000Z'),
      }),
    };
    chat = {
      runConfirmedAction: jest.fn().mockResolvedValue('Done.'),
      cancelPendingAction: jest.fn().mockResolvedValue('Left it alone.'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InteractiveReplyService,
        { provide: RemindersService, useValue: reminders },
        { provide: ChatService, useValue: chat },
      ],
    }).compile();

    service = module.get(InteractiveReplyService);
  });

  describe('button id round-trip', () => {
    it('builds ids this service can read back', async () => {
      await service.handle('user1', reminderButtonId('r1', 'done'));
      expect(reminders.completeFromReminderAction).toHaveBeenCalledWith('user1', 'r1');
    });

    it('builds confirmation ids this service can read back', async () => {
      await service.handle('user1', confirmButtonId('exec1', 'yes'));
      expect(chat.runConfirmedAction).toHaveBeenCalledWith('user1', 'exec1');
    });
  });

  describe('reminder actions', () => {
    it('completes the reminder on Done', async () => {
      const reply = await service.handle('user1', 'remind:r1:done');

      expect(reminders.completeFromReminderAction).toHaveBeenCalledWith('user1', 'r1');
      expect(reply).toContain('done');
    });

    it('reschedules on snooze and says when it will return', async () => {
      const reply = await service.handle('user1', 'remind:r1:snooze');

      expect(reminders.snooze).toHaveBeenCalledWith('user1', 'r1');
      expect(reply).toMatch(/\d{2}:\d{2}/);
    });

    it('cancels for good on stop', async () => {
      const reply = await service.handle('user1', 'remind:r1:stop');

      expect(reminders.cancelFromReminderAction).toHaveBeenCalledWith('user1', 'r1');
      expect(reply).toContain('again');
    });

    it('keeps snoozing indefinitely - the loop has no built-in end', async () => {
      await service.handle('user1', 'remind:r1:snooze');
      await service.handle('user1', 'remind:r1:snooze');
      await service.handle('user1', 'remind:r1:snooze');

      expect(reminders.snooze).toHaveBeenCalledTimes(3);
    });
  });

  describe('ownership', () => {
    it("will not act on another user's reminder", async () => {
      // RemindersService is the thing that owns this check; the service must
      // surface its refusal rather than swallowing it and reporting success.
      reminders.completeFromReminderAction.mockRejectedValue(new NotFoundException());

      const reply = await service.handle('attacker', 'remind:victims-reminder:done');

      expect(reply).not.toContain('done');
      expect(reply).toContain("couldn't");
    });

    it('passes the acting user through, never a user id from the button', async () => {
      await service.handle('user1', 'remind:r1:done');

      const [actingUser] = reminders.completeFromReminderAction.mock.calls[0];
      expect(actingUser).toBe('user1');
    });
  });

  describe('malformed input', () => {
    it('ignores a button id that is not in the expected shape', async () => {
      expect(await service.handle('user1', 'garbage')).toBeNull();
      expect(reminders.completeFromReminderAction).not.toHaveBeenCalled();
    });

    it('ignores an unknown prefix', async () => {
      expect(await service.handle('user1', 'unknown:r1:done')).toBeNull();
    });

    it('ignores an unknown reminder action', async () => {
      expect(await service.handle('user1', 'remind:r1:explode')).toBeNull();
      expect(reminders.completeFromReminderAction).not.toHaveBeenCalled();
      expect(reminders.cancelFromReminderAction).not.toHaveBeenCalled();
    });
  });
});
