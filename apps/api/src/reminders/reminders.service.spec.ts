import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppSenderService } from '../channels/whatsapp-sender.service';
import { TelegramService } from '../channels/telegram.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';
import { RecurrenceFrequency } from './dto/create-reminder.dto';

describe('RemindersService', () => {
  let service: RemindersService;
  let prisma: any;
  let whatsappService: any;
  let telegramService: any;
  let planLimits: any;
  let notificationsService: any;
  let configValues: Record<string, string | undefined>;

  beforeEach(async () => {
    prisma = {
      reminder: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn(),
      },
      channel: {
        findMany: jest.fn(),
      },
    };
    whatsappService = {
      sendMessage: jest.fn(),
      sendButtons: jest.fn(),
      sendTemplate: jest.fn(),
      // Default: the user messaged recently, so reply buttons are allowed.
      isWithinCustomerServiceWindow: jest.fn().mockResolvedValue(true),
    };
    configValues = {
      WHATSAPP_REMINDER_TEMPLATE_NAME: 'zoorzio_reminder',
      WHATSAPP_REMINDER_TEMPLATE_LANGUAGE: 'en',
    };
    telegramService = { sendMessage: jest.fn(), sendButtons: jest.fn() };
    planLimits = { assertCanCreate: jest.fn() };
    notificationsService = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemindersService,
        { provide: PrismaService, useValue: prisma },
        { provide: WhatsAppSenderService, useValue: whatsappService },
        { provide: TelegramService, useValue: telegramService },
        { provide: PlanLimitsService, useValue: planLimits },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: ConfigService, useValue: { get: jest.fn((key: string) => configValues[key]) } },
      ],
    }).compile();

    service = module.get<RemindersService>(RemindersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a one-off reminder without recurrence', async () => {
      prisma.reminder.create.mockResolvedValue({ id: 'r1' });

      await service.create('user1', {
        title: 'Take medicine',
        scheduledAt: '2026-08-25T10:00:00.000Z',
      });

      expect(prisma.reminder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user1',
          title: 'Take medicine',
          recurrence: undefined,
        }),
      });
    });

    it('should check the plan limit before creating', async () => {
      prisma.reminder.create.mockResolvedValue({ id: 'r1' });

      await service.create('user1', {
        title: 'Take medicine',
        scheduledAt: '2026-08-25T10:00:00.000Z',
      });

      expect(planLimits.assertCanCreate).toHaveBeenCalledWith('user1', 'reminders');
    });

    it('should propagate ForbiddenException when the plan limit is reached', async () => {
      planLimits.assertCanCreate.mockRejectedValue(new ForbiddenException('limit reached'));

      await expect(
        service.create('user1', {
          title: 'Take medicine',
          scheduledAt: '2026-08-25T10:00:00.000Z',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.reminder.create).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if reminder belongs to another user', async () => {
      prisma.reminder.findUnique.mockResolvedValue({ id: 'r1', userId: 'other-user' });

      await expect(service.findOne('user1', 'r1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if reminder does not exist', async () => {
      prisma.reminder.findUnique.mockResolvedValue(null);

      await expect(service.findOne('user1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('complete', () => {
    it('should set completedAt on the reminder', async () => {
      prisma.reminder.findUnique.mockResolvedValue({ id: 'r1', userId: 'user1' });
      prisma.reminder.update.mockResolvedValue({ id: 'r1', completedAt: new Date() });

      await service.complete('user1', 'r1');

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'COMPLETED', completedAt: expect.any(Date) },
      });
    });
  });

  describe('computeNextOccurrence', () => {
    it('should advance by one day for DAILY', () => {
      const from = new Date('2026-08-25T10:00:00.000Z');
      const next = service.computeNextOccurrence(from, { freq: RecurrenceFrequency.DAILY });
      expect(next.toISOString()).toBe('2026-08-26T10:00:00.000Z');
    });

    it('should advance by N weeks for WEEKLY with interval', () => {
      const from = new Date('2026-08-25T10:00:00.000Z');
      const next = service.computeNextOccurrence(from, {
        freq: RecurrenceFrequency.WEEKLY,
        interval: 2,
      });
      expect(next.toISOString()).toBe('2026-09-08T10:00:00.000Z');
    });

    it('should advance by one month for MONTHLY', () => {
      const from = new Date('2026-08-25T10:00:00.000Z');
      const next = service.computeNextOccurrence(from, { freq: RecurrenceFrequency.MONTHLY });
      expect(next.toISOString()).toBe('2026-09-25T10:00:00.000Z');
    });
  });

  describe('processDueReminders', () => {
    const dueReminder = (overrides: Record<string, unknown> = {}) => ({
      id: 'r1',
      userId: 'user1',
      title: 'Take medicine',
      message: null,
      scheduledAt: new Date('2026-08-25T09:00:00.000Z'),
      status: 'SCHEDULED',
      snoozeCount: 0,
      lastTriggeredAt: null,
      recurrence: null,
      ...overrides,
    });

    const whatsappChannel = {
      id: 'c1',
      userId: 'user1',
      type: 'WHATSAPP',
      externalId: '923001234567',
      isActive: true,
    };

    it('offers Done / snooze / stop buttons when delivering over WhatsApp', async () => {
      prisma.reminder.findMany.mockResolvedValue([dueReminder()]);
      prisma.channel.findMany.mockResolvedValue([whatsappChannel]);

      await service.processDueReminders();

      expect(whatsappService.sendButtons).toHaveBeenCalledWith(
        'user1',
        '923001234567',
        expect.stringContaining('Take medicine'),
        [
          { id: 'remind:r1:done', title: 'Done' },
          { id: 'remind:r1:snooze', title: 'In an hour' },
          { id: 'remind:r1:stop', title: "Don't remind me" },
        ],
      );
      expect(notificationsService.create).toHaveBeenCalledWith(
        'user1',
        'REMINDER_DUE',
        'Take medicine',
        expect.any(String),
        'REMINDER',
        'r1',
      );
    });

    it('leaves a reminder awaiting an answer once buttons have gone out', async () => {
      prisma.reminder.findMany.mockResolvedValue([dueReminder()]);
      prisma.channel.findMany.mockResolvedValue([whatsappChannel]);

      await service.processDueReminders();

      // Claimed as TRIGGERED, and deliberately not completed - the user still
      // has to tap something, which is what keeps the snooze loop alive.
      expect(prisma.reminder.updateMany).toHaveBeenCalledWith({
        where: { id: 'r1', status: 'SCHEDULED', scheduledAt: { lte: expect.any(Date) } },
        data: { status: 'TRIGGERED', lastTriggeredAt: expect.any(Date) },
      });
      expect(prisma.reminder.update).not.toHaveBeenCalled();
    });

    it('completes a one-off reminder when there is no way for the user to answer', async () => {
      prisma.reminder.findMany.mockResolvedValue([
        dueReminder({ id: 'r4', title: 'Water the plants' }),
      ]);
      prisma.channel.findMany.mockResolvedValue([]);

      await service.processDueReminders();

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'r4' },
        data: { status: 'COMPLETED', completedAt: expect.any(Date) },
      });
      expect(notificationsService.create).toHaveBeenCalledWith(
        'user1',
        'REMINDER_DUE',
        'Water the plants',
        expect.any(String),
        'REMINDER',
        'r4',
      );
    });

    it('reschedules a recurring reminder instead of completing it', async () => {
      prisma.reminder.findMany.mockResolvedValue([
        dueReminder({
          id: 'r2',
          title: 'Daily standup',
          recurrence: { freq: RecurrenceFrequency.DAILY, interval: 1 },
        }),
      ]);
      prisma.channel.findMany.mockResolvedValue([]);

      await service.processDueReminders();

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'r2' },
        data: {
          status: 'SCHEDULED',
          scheduledAt: new Date('2026-08-26T09:00:00.000Z'),
        },
      });
    });

    it('sends nothing when another instance has already claimed the reminder', async () => {
      // Two API instances run this cron; both read the same due row, so the
      // claim is what decides. Losing it must produce no second message.
      prisma.reminder.findMany.mockResolvedValue([dueReminder()]);
      prisma.reminder.updateMany.mockResolvedValue({ count: 0 });
      prisma.channel.findMany.mockResolvedValue([whatsappChannel]);

      await service.processDueReminders();

      expect(whatsappService.sendButtons).not.toHaveBeenCalled();
      expect(whatsappService.sendMessage).not.toHaveBeenCalled();
      expect(notificationsService.create).not.toHaveBeenCalled();
      expect(prisma.reminder.update).not.toHaveBeenCalled();
    });
  });

  describe('snooze', () => {
    it('reschedules an hour out and counts the snooze', async () => {
      prisma.reminder.findUnique.mockResolvedValue({ id: 'r1', userId: 'user1' });
      prisma.reminder.update.mockResolvedValue({ id: 'r1', scheduledAt: new Date() });

      await service.snooze('user1', 'r1');

      const call = prisma.reminder.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'r1' });
      expect(call.data.snoozeCount).toEqual({ increment: 1 });

      const delayMs = call.data.scheduledAt.getTime() - Date.now();
      expect(delayMs).toBeGreaterThan(59 * 60 * 1000);
      expect(delayMs).toBeLessThanOrEqual(60 * 60 * 1000);
    });

    it('putting it back to SCHEDULED is what lets it fire again', async () => {
      // The recursive loop has no timer behind it: snoozing only rewrites the
      // row, and the ordinary cron pass picks it up again at the new time.
      prisma.reminder.findUnique.mockResolvedValue({ id: 'r1', userId: 'user1' });
      prisma.reminder.update.mockResolvedValue({ id: 'r1', scheduledAt: new Date() });

      await service.snooze('user1', 'r1');

      expect(prisma.reminder.update.mock.calls[0][0].data.status).toBe('SCHEDULED');
    });

    it('honours a custom delay', async () => {
      prisma.reminder.findUnique.mockResolvedValue({ id: 'r1', userId: 'user1' });
      prisma.reminder.update.mockResolvedValue({ id: 'r1', scheduledAt: new Date() });

      await service.snooze('user1', 'r1', 15 * 60 * 1000);

      const delayMs =
        prisma.reminder.update.mock.calls[0][0].data.scheduledAt.getTime() - Date.now();
      expect(delayMs).toBeLessThanOrEqual(15 * 60 * 1000);
      expect(delayMs).toBeGreaterThan(14 * 60 * 1000);
    });

    it('refuses to snooze a reminder belonging to someone else', async () => {
      prisma.reminder.findUnique.mockResolvedValue({ id: 'r1', userId: 'someone-else' });

      await expect(service.snooze('user1', 'r1')).rejects.toThrow(NotFoundException);
      expect(prisma.reminder.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('marks the reminder cancelled so it never fires again', async () => {
      prisma.reminder.findUnique.mockResolvedValue({ id: 'r1', userId: 'user1' });
      prisma.reminder.update.mockResolvedValue({ id: 'r1' });

      await service.cancel('user1', 'r1');

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
      });
    });

    it('refuses to cancel a reminder belonging to someone else', async () => {
      prisma.reminder.findUnique.mockResolvedValue({ id: 'r1', userId: 'someone-else' });

      await expect(service.cancel('user1', 'r1')).rejects.toThrow(NotFoundException);
      expect(prisma.reminder.update).not.toHaveBeenCalled();
    });
  });

  describe('delivery outside the WhatsApp 24-hour window', () => {
    const reminder = (overrides: Record<string, unknown> = {}) => ({
      id: 'r1',
      userId: 'user1',
      title: 'Submit application',
      message: null,
      scheduledAt: new Date('2026-08-25T09:00:00.000Z'),
      status: 'SCHEDULED',
      snoozeCount: 0,
      lastTriggeredAt: null,
      recurrence: null,
      metadata: {},
      ...overrides,
    });

    const whatsappChannel = {
      id: 'c1',
      userId: 'user1',
      type: 'WHATSAPP',
      externalId: '447700900000',
      isActive: true,
    };

    beforeEach(() => {
      prisma.channel.findMany.mockResolvedValue([whatsappChannel]);
      whatsappService.isWithinCustomerServiceWindow.mockResolvedValue(false);
    });

    it('sends the approved template instead of reply buttons', async () => {
      prisma.reminder.findMany.mockResolvedValue([reminder()]);

      await service.processDueReminders();

      expect(whatsappService.sendButtons).not.toHaveBeenCalled();
      expect(whatsappService.sendTemplate).toHaveBeenCalledWith('user1', '447700900000', {
        name: 'zoorzio_reminder',
        language: 'en',
        bodyParameters: ['Submit application'],
        quickReplyPayloads: ['remind:r1:done', 'remind:r1:snooze', 'remind:r1:stop'],
      });
    });

    it('puts the reminder detail into the template text', async () => {
      prisma.reminder.findMany.mockResolvedValue([reminder({ message: 'Portal closes at 6' })]);

      await service.processDueReminders();

      expect(whatsappService.sendTemplate.mock.calls[0][2].bodyParameters).toEqual([
        'Submit application — Portal closes at 6',
      ]);
    });

    it('waits for a tap on the template exactly as it would for buttons', async () => {
      prisma.reminder.findMany.mockResolvedValue([reminder()]);

      await service.processDueReminders();

      expect(prisma.reminder.update).not.toHaveBeenCalled();
    });

    it('retries later rather than completing a reminder nobody received', async () => {
      // Outside the window with no template configured, nothing can be sent.
      configValues.WHATSAPP_REMINDER_TEMPLATE_NAME = undefined;
      prisma.reminder.findMany.mockResolvedValue([reminder()]);

      await service.processDueReminders();

      expect(whatsappService.sendTemplate).not.toHaveBeenCalled();
      const { data } = prisma.reminder.update.mock.calls[0][0];
      expect(data.status).toBe('SCHEDULED');
      expect(data.metadata).toEqual({ deliveryAttempts: 1 });
      const delayMs = data.scheduledAt.getTime() - Date.now();
      expect(delayMs).toBeGreaterThan(4 * 60 * 1000);
      expect(delayMs).toBeLessThanOrEqual(5 * 60 * 1000);
    });

    it('retries when WhatsApp rejects the send', async () => {
      whatsappService.sendTemplate.mockRejectedValue(new Error('Template not approved'));
      prisma.reminder.findMany.mockResolvedValue([reminder()]);

      await service.processDueReminders();

      const { data } = prisma.reminder.update.mock.calls[0][0];
      expect(data.status).toBe('SCHEDULED');
      expect(data.metadata).toEqual({ deliveryAttempts: 1 });
    });

    it('marks the reminder FAILED once the last attempt fails', async () => {
      whatsappService.sendTemplate.mockRejectedValue(new Error('Template not approved'));
      prisma.reminder.findMany.mockResolvedValue([reminder({ metadata: { deliveryAttempts: 2 } })]);

      await service.processDueReminders();

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'FAILED', metadata: { deliveryAttempts: 3 } },
      });
    });

    it('does not send a second in-app notification on a retry', async () => {
      prisma.reminder.findMany.mockResolvedValue([reminder({ metadata: { deliveryAttempts: 1 } })]);

      await service.processDueReminders();

      expect(notificationsService.create).not.toHaveBeenCalled();
    });

    it('clears the attempt count once a retry gets through', async () => {
      prisma.reminder.findMany.mockResolvedValue([reminder({ metadata: { deliveryAttempts: 2 } })]);

      await service.processDueReminders();

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { metadata: { deliveryAttempts: 0 } },
      });
    });

    it('prompts on Telegram with the same action buttons when WhatsApp fails', async () => {
      whatsappService.sendTemplate.mockRejectedValue(new Error('Template not approved'));
      prisma.channel.findMany.mockResolvedValue([
        whatsappChannel,
        { id: 'c2', userId: 'user1', type: 'TELEGRAM', externalId: '12345', isActive: true },
      ]);
      prisma.reminder.findMany.mockResolvedValue([reminder()]);

      await service.processDueReminders();

      expect(telegramService.sendButtons).toHaveBeenCalledWith('user1', 12345, expect.any(String), [
        { id: 'remind:r1:done', title: 'Done' },
        { id: 'remind:r1:snooze', title: 'In an hour' },
        { id: 'remind:r1:stop', title: "Don't remind me" },
      ]);
      // Buttons are out, so it waits for a tap instead of being closed unseen.
      expect(prisma.reminder.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }),
      );
    });
  });
});
