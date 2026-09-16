import { Test, TestingModule } from '@nestjs/testing';
import { BriefingService } from './briefing.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { CalendarService } from '../calendar/calendar.service';
import { WhatsAppSenderService } from '../channels/whatsapp-sender.service';
import { TelegramService } from '../channels/telegram.service';
import { EmailService } from '../channels/email.service';
import { ConfigService } from '@nestjs/config';

describe('BriefingService', () => {
  let service: BriefingService;
  let prisma: any;
  let tasksService: any;
  let calendarService: any;
  let whatsappService: any;
  let telegramService: any;
  let emailService: any;
  let configService: any;

  beforeEach(async () => {
    prisma = {
      channel: { findMany: jest.fn() },
      user: { findMany: jest.fn(), findUnique: jest.fn() },
      task: { findMany: jest.fn() },
    };
    tasksService = { getTasksDueToday: jest.fn(), getOverdueTasks: jest.fn() };
    calendarService = { getTodayEvents: jest.fn(), getUpcomingEvents: jest.fn() };
    whatsappService = { sendMessage: jest.fn() };
    telegramService = { sendMessage: jest.fn() };
    emailService = { sendEmail: jest.fn().mockResolvedValue({ success: true }) };
    configService = { get: jest.fn().mockReturnValue('') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BriefingService,
        { provide: PrismaService, useValue: prisma },
        { provide: TasksService, useValue: tasksService },
        { provide: CalendarService, useValue: calendarService },
        { provide: WhatsAppSenderService, useValue: whatsappService },
        { provide: TelegramService, useValue: telegramService },
        { provide: EmailService, useValue: emailService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<BriefingService>(BriefingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generate', () => {
    it('should aggregate tasks and events into a briefing with a formatted message', async () => {
      tasksService.getTasksDueToday.mockResolvedValue([{ title: 'Pay rent' }]);
      tasksService.getOverdueTasks.mockResolvedValue([{ title: 'File taxes' }]);
      calendarService.getTodayEvents.mockResolvedValue([{ title: 'Dentist appointment' }]);

      const result = await service.generate('user1');

      expect(result.tasksDueToday).toEqual([{ title: 'Pay rent' }]);
      expect(result.overdueTasks).toEqual([{ title: 'File taxes' }]);
      expect(result.events).toEqual([{ title: 'Dentist appointment' }]);
      expect(result.message).toContain('Pay rent');
      expect(result.message).toContain('File taxes');
      expect(result.message).toContain('Dentist appointment');
    });

    it('should note there is nothing on the plate when everything is empty', async () => {
      tasksService.getTasksDueToday.mockResolvedValue([]);
      tasksService.getOverdueTasks.mockResolvedValue([]);
      calendarService.getTodayEvents.mockResolvedValue([]);

      const result = await service.generate('user1');

      expect(result.message).toContain('Nothing on your plate today');
    });
  });

  describe('generateWeekly', () => {
    it("should aggregate overdue tasks, tasks due this week, and this week's events", async () => {
      tasksService.getOverdueTasks.mockResolvedValue([{ title: 'File taxes' }]);
      prisma.task.findMany.mockResolvedValue([{ title: 'Submit report' }]);
      calendarService.getUpcomingEvents.mockResolvedValue([{ title: 'Team offsite' }]);

      const result = await service.generateWeekly('user1');

      expect(calendarService.getUpcomingEvents).toHaveBeenCalledWith('user1', 7);
      expect(result.overdueTasks).toEqual([{ title: 'File taxes' }]);
      expect(result.upcomingTasks).toEqual([{ title: 'Submit report' }]);
      expect(result.upcomingEvents).toEqual([{ title: 'Team offsite' }]);
      expect(result.message).toContain('weekly briefing');
      expect(result.message).toContain('Submit report');
      expect(result.message).toContain('Team offsite');
      expect(result.message).toContain('File taxes');
    });

    it('should note there is nothing on the calendar when everything is empty', async () => {
      tasksService.getOverdueTasks.mockResolvedValue([]);
      prisma.task.findMany.mockResolvedValue([]);
      calendarService.getUpcomingEvents.mockResolvedValue([]);

      const result = await service.generateWeekly('user1');

      expect(result.message).toContain('Nothing on the calendar this week');
    });
  });

  describe('sendWeeklyBriefings', () => {
    it('should only query Pro/Ultimate subscribers, matching the pricing-page promise', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'user1' }]);
      tasksService.getOverdueTasks.mockResolvedValue([]);
      prisma.task.findMany.mockResolvedValue([]);
      calendarService.getUpcomingEvents.mockResolvedValue([]);
      prisma.channel.findMany.mockResolvedValue([
        { id: 'c1', userId: 'user1', type: 'TELEGRAM', externalId: '123456', isActive: true },
      ]);

      await service.sendWeeklyBriefings();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          subscription: {
            status: { in: ['ACTIVE', 'TRIALING'] },
            plan: { slug: { in: ['pro', 'ultimate'] } },
          },
        },
        select: { id: true },
      });
      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        'user1',
        123456,
        expect.stringContaining('weekly briefing'),
      );
    });
  });

  describe('sendDailyBriefings', () => {
    it('should generate and deliver a briefing to every eligible subscriber with an active channel', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'user1' }]);
      tasksService.getTasksDueToday.mockResolvedValue([]);
      tasksService.getOverdueTasks.mockResolvedValue([]);
      calendarService.getTodayEvents.mockResolvedValue([]);
      prisma.channel.findMany.mockResolvedValue([
        { id: 'c1', userId: 'user1', type: 'TELEGRAM', externalId: '123456', isActive: true },
      ]);

      await service.sendDailyBriefings();

      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        'user1',
        123456,
        expect.stringContaining('daily briefing'),
      );
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should fall back to email when the user has no active messaging channel', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'user1' }]);
      tasksService.getTasksDueToday.mockResolvedValue([]);
      tasksService.getOverdueTasks.mockResolvedValue([]);
      calendarService.getTodayEvents.mockResolvedValue([]);
      prisma.channel.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue({ email: 'user1@example.com' });
      configService.get.mockReturnValue('fake-sendgrid-key');

      await service.sendDailyBriefings();

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'user1',
        'user1@example.com',
        'Your daily briefing',
        expect.stringContaining('daily briefing'),
      );
    });

    it('should skip email delivery (not throw) when SendGrid is not configured, matching demo mode elsewhere', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'user1' }]);
      tasksService.getTasksDueToday.mockResolvedValue([]);
      tasksService.getOverdueTasks.mockResolvedValue([]);
      calendarService.getTodayEvents.mockResolvedValue([]);
      prisma.channel.findMany.mockResolvedValue([]);
      configService.get.mockReturnValue('');

      await expect(service.sendDailyBriefings()).resolves.toBeUndefined();
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should not email a user who has an active WhatsApp/Telegram channel, avoiding double-notifying', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'user1' }]);
      tasksService.getTasksDueToday.mockResolvedValue([]);
      tasksService.getOverdueTasks.mockResolvedValue([]);
      calendarService.getTodayEvents.mockResolvedValue([]);
      prisma.channel.findMany.mockResolvedValue([
        { id: 'c1', userId: 'user1', type: 'WHATSAPP', externalId: '15551234567', isActive: true },
      ]);
      configService.get.mockReturnValue('fake-sendgrid-key');

      await service.sendDailyBriefings();

      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });
  });
});
