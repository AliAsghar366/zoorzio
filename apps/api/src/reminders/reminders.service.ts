import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationType, Prisma } from '@anchor/database';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../channels/whatsapp.service';
import { TelegramService } from '../channels/telegram.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReminderDto, RecurrenceFrequency } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsAppService,
    private telegramService: TelegramService,
    private planLimits: PlanLimitsService,
    private notificationsService: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateReminderDto) {
    await this.planLimits.assertCanCreate(userId, 'reminders');

    return this.prisma.reminder.create({
      data: {
        userId,
        title: dto.title,
        message: dto.message,
        scheduledAt: new Date(dto.scheduledAt),
        recurrence: dto.recurrence ? { ...dto.recurrence } : undefined,
        taskId: dto.taskId,
        memoryId: dto.memoryId,
      },
    });
  }

  async findAll(userId: string, upcomingOnly = false) {
    return this.prisma.reminder.findMany({
      where: {
        userId,
        ...(upcomingOnly ? { completedAt: null } : {}),
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  private async findOwned(userId: string, id: string) {
    const reminder = await this.prisma.reminder.findUnique({ where: { id } });
    if (!reminder || reminder.userId !== userId) {
      throw new NotFoundException('Reminder not found');
    }
    return reminder;
  }

  async findOne(userId: string, id: string) {
    return this.findOwned(userId, id);
  }

  async update(userId: string, id: string, dto: UpdateReminderDto) {
    await this.findOwned(userId, id);

    return this.prisma.reminder.update({
      where: { id },
      data: {
        title: dto.title,
        message: dto.message,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        recurrence:
          dto.recurrence === null ? Prisma.JsonNull : dto.recurrence ? { ...dto.recurrence } : undefined,
      },
    });
  }

  async complete(userId: string, id: string) {
    await this.findOwned(userId, id);
    return this.prisma.reminder.update({ where: { id }, data: { completedAt: new Date() } });
  }

  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.reminder.delete({ where: { id } });
    return { success: true };
  }

  /** Advances a recurring reminder's next scheduledAt from the occurrence that just fired. */
  computeNextOccurrence(from: Date, recurrence: { freq: RecurrenceFrequency; interval?: number }): Date {
    const next = new Date(from);
    const interval = recurrence.interval || 1;

    switch (recurrence.freq) {
      case RecurrenceFrequency.DAILY:
        next.setDate(next.getDate() + interval);
        break;
      case RecurrenceFrequency.WEEKLY:
        next.setDate(next.getDate() + interval * 7);
        break;
      case RecurrenceFrequency.MONTHLY:
        next.setMonth(next.getMonth() + interval);
        break;
    }

    return next;
  }

  /** Sends a reminder message over every active WhatsApp/Telegram channel the user has connected. */
  private async deliver(userId: string, text: string): Promise<void> {
    const channels = await this.prisma.channel.findMany({ where: { userId, isActive: true } });

    await Promise.all(
      channels.map(async (channel) => {
        try {
          if (channel.type === 'WHATSAPP') {
            await this.whatsappService.sendMessage(userId, channel.externalId, text);
          } else if (channel.type === 'TELEGRAM') {
            await this.telegramService.sendMessage(userId, Number(channel.externalId), text);
          }
          // Note: no delivery path yet for users with only EMAIL/NATIVE_APP
          // channels connected (no stored mobile push token to target).
        } catch (error) {
          this.logger.error(`Failed to deliver reminder to channel ${channel.id}`, error);
        }
      }),
    );
  }

  /** Runs every minute: fires any due reminders, then reschedules or completes them. */
  @Cron(CronExpression.EVERY_MINUTE)
  async processDueReminders(): Promise<void> {
    const now = new Date();

    const due = await this.prisma.reminder.findMany({
      where: {
        completedAt: null,
        scheduledAt: { lte: now },
      },
    });

    for (const reminder of due) {
      // Guard against re-firing the same occurrence: only proceed if it
      // hasn't already been triggered since its current scheduledAt.
      if (reminder.lastTriggeredAt && reminder.lastTriggeredAt >= reminder.scheduledAt) {
        continue;
      }

      const text = reminder.message
        ? `⏰ ${reminder.title}\n${reminder.message}`
        : `⏰ ${reminder.title}`;

      await this.deliver(reminder.userId, text);

      // In-app notification alongside any external channel delivery, so the
      // reminder is visible in the product itself even with no WhatsApp/
      // Telegram/push channel connected.
      await this.notificationsService.create(
        reminder.userId,
        NotificationType.REMINDER_DUE,
        reminder.title,
        reminder.message || 'This reminder is due now.',
        'REMINDER',
        reminder.id,
      );

      const recurrence = reminder.recurrence as { freq: RecurrenceFrequency; interval?: number } | null;

      if (recurrence?.freq) {
        await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: {
            lastTriggeredAt: now,
            scheduledAt: this.computeNextOccurrence(reminder.scheduledAt, recurrence),
          },
        });
      } else {
        await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: { lastTriggeredAt: now, completedAt: now },
        });
      }

      this.logger.log(`Delivered reminder ${reminder.id} to user ${reminder.userId}`);
    }
  }
}
