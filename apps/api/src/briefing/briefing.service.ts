import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { CalendarService } from '../calendar/calendar.service';
import { WhatsAppService } from '../channels/whatsapp.service';
import { TelegramService } from '../channels/telegram.service';
import { EmailService } from '../channels/email.service';

// Briefings are sold as a Pro-plan feature ("Daily + weekly briefings" on
// /pricing) - the proactive cron push is gated to these plans. The on-demand
// GET /briefing endpoints stay open to everyone since they're cheap to
// compute and don't cost anything to serve.
const BRIEFING_ELIGIBLE_PLAN_SLUGS = ['pro', 'ultimate'];

@Injectable()
export class BriefingService {
  private readonly logger = new Logger(BriefingService.name);

  constructor(
    private prisma: PrismaService,
    private tasksService: TasksService,
    private calendarService: CalendarService,
    private whatsappService: WhatsAppService,
    private telegramService: TelegramService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  async generate(userId: string) {
    const [tasksDueToday, overdueTasks, events] = await Promise.all([
      this.tasksService.getTasksDueToday(userId),
      this.tasksService.getOverdueTasks(userId),
      this.calendarService.getTodayEvents(userId),
    ]);

    return {
      date: new Date(),
      tasksDueToday,
      overdueTasks,
      events,
      message: this.formatMessage(tasksDueToday, overdueTasks, events),
    };
  }

  async generateWeekly(userId: string) {
    const now = new Date();
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const [overdueTasks, upcomingTasks, upcomingEvents] = await Promise.all([
      this.tasksService.getOverdueTasks(userId),
      this.prisma.task.findMany({
        where: { userId, status: { not: 'COMPLETED' }, dueDate: { gte: now, lte: weekFromNow } },
        orderBy: { dueDate: 'asc' },
      }),
      this.calendarService.getUpcomingEvents(userId, 7),
    ]);

    return {
      date: now,
      overdueTasks,
      upcomingTasks,
      upcomingEvents,
      message: this.formatWeeklyMessage(overdueTasks, upcomingTasks, upcomingEvents),
    };
  }

  private formatMessage(tasksDueToday: any[], overdueTasks: any[], events: any[]): string {
    const lines: string[] = ['🌅 Your daily briefing'];

    if (events.length) {
      lines.push('', '📅 Today’s events:');
      events.forEach((e) => lines.push(`- ${e.title}`));
    }

    if (tasksDueToday.length) {
      lines.push('', '✅ Due today:');
      tasksDueToday.forEach((t) => lines.push(`- ${t.title}`));
    }

    if (overdueTasks.length) {
      lines.push('', '⚠️ Overdue:');
      overdueTasks.forEach((t) => lines.push(`- ${t.title}`));
    }

    if (events.length === 0 && tasksDueToday.length === 0 && overdueTasks.length === 0) {
      lines.push('', 'Nothing on your plate today. Enjoy the calm!');
    }

    return lines.join('\n');
  }

  private formatWeeklyMessage(overdueTasks: any[], upcomingTasks: any[], upcomingEvents: any[]): string {
    const lines: string[] = ['🗓️ Your weekly briefing'];

    if (upcomingEvents.length) {
      lines.push('', '📅 This week’s events:');
      upcomingEvents.forEach((e) => lines.push(`- ${e.title}`));
    }

    if (upcomingTasks.length) {
      lines.push('', '✅ Due this week:');
      upcomingTasks.forEach((t) => lines.push(`- ${t.title}`));
    }

    if (overdueTasks.length) {
      lines.push('', '⚠️ Still overdue:');
      overdueTasks.forEach((t) => lines.push(`- ${t.title}`));
    }

    if (upcomingEvents.length === 0 && upcomingTasks.length === 0 && overdueTasks.length === 0) {
      lines.push('', 'Nothing on the calendar this week. Enjoy the calm!');
    }

    return lines.join('\n');
  }

  /**
   * Delivers over every active WhatsApp/Telegram channel the user has. If
   * they have none connected, falls back to emailing their account address
   * directly - previously a web-only Pro subscriber with no messaging
   * channel connected would never receive the briefing feature they're
   * paying for.
   */
  private async deliver(userId: string, subject: string, text: string): Promise<void> {
    const channels = await this.prisma.channel.findMany({ where: { userId, isActive: true } });
    const messagingChannels = channels.filter((c) => c.type === 'WHATSAPP' || c.type === 'TELEGRAM');

    await Promise.all(
      messagingChannels.map(async (channel) => {
        try {
          if (channel.type === 'WHATSAPP') {
            await this.whatsappService.sendMessage(userId, channel.externalId, text);
          } else if (channel.type === 'TELEGRAM') {
            await this.telegramService.sendMessage(userId, Number(channel.externalId), text);
          }
        } catch (error) {
          this.logger.error(`Failed to deliver briefing to channel ${channel.id}`, error);
        }
      }),
    );

    if (messagingChannels.length === 0) {
      await this.deliverByEmail(userId, subject, text);
    }
  }

  private async deliverByEmail(userId: string, subject: string, text: string): Promise<void> {
    if (!this.configService.get('SENDGRID_API_KEY')) {
      this.logger.log(`SENDGRID_API_KEY not configured - skipping email briefing for user ${userId} (demo mode)`);
      return;
    }

    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (user) {
        await this.emailService.sendEmail(userId, user.email, subject, text);
      }
    } catch (error) {
      this.logger.error(`Failed to email briefing to user ${userId}`, error);
    }
  }

  private briefingEligibleUsers() {
    return this.prisma.user.findMany({
      where: {
        subscription: {
          status: { in: ['ACTIVE', 'TRIALING'] },
          plan: { slug: { in: BRIEFING_ELIGIBLE_PLAN_SLUGS } },
        },
      },
      select: { id: true },
    });
  }

  /** Sends the daily briefing to every Pro/Ultimate subscriber. */
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async sendDailyBriefings(): Promise<void> {
    const users = await this.briefingEligibleUsers();

    for (const user of users) {
      const briefing = await this.generate(user.id);
      await this.deliver(user.id, 'Your daily briefing', briefing.message);
      this.logger.log(`Sent daily briefing to user ${user.id}`);
    }
  }

  /** Sends the weekly briefing every Sunday morning to every Pro/Ultimate subscriber. */
  @Cron('0 9 * * 0')
  async sendWeeklyBriefings(): Promise<void> {
    const users = await this.briefingEligibleUsers();

    for (const user of users) {
      const briefing = await this.generateWeekly(user.id);
      await this.deliver(user.id, 'Your weekly briefing', briefing.message);
      this.logger.log(`Sent weekly briefing to user ${user.id}`);
    }
  }
}
