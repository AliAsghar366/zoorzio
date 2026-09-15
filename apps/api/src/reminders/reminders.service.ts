import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { NotificationType, Prisma, Reminder, ReminderStatus } from '@anchor/database';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppSenderService } from '../channels/whatsapp-sender.service';
import { TelegramService } from '../channels/telegram.service';
import { reminderButtonId } from '../channels/interactive-reply.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReminderDto, RecurrenceFrequency } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';

/** How far a "remind me in an hour" tap pushes the next occurrence. */
const SNOOZE_MS = 60 * 60 * 1000;

/** Statuses a reminder can still act from - anything else is finished. */
const OPEN_STATUSES: ReminderStatus[] = [
  ReminderStatus.SCHEDULED,
  ReminderStatus.TRIGGERED,
  ReminderStatus.SNOOZED,
];

/** A one-off reminder that reaches nobody is retried this many times before it is marked FAILED. */
const MAX_DELIVERY_ATTEMPTS = 3;
const DELIVERY_RETRY_DELAY_MS = 5 * 60 * 1000;

/**
 * prompted    - the user got buttons they can act on (WhatsApp or Telegram)
 * failed      - there was somewhere to send it and nothing got through
 * unreachable - no channel that can receive a reminder is connected
 */
type DeliveryOutcome = 'prompted' | 'failed' | 'unreachable';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => WhatsAppSenderService))
    private whatsappService: WhatsAppSenderService,
    @Inject(forwardRef(() => TelegramService))
    private telegramService: TelegramService,
    private planLimits: PlanLimitsService,
    private notificationsService: NotificationsService,
    private config: ConfigService,
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
        ...(upcomingOnly ? { status: { in: OPEN_STATUSES } } : {}),
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
        // Rescheduling revives a reminder that already fired, so it gets picked
        // up again at the new time rather than staying stuck in TRIGGERED.
        ...(dto.scheduledAt
          ? { scheduledAt: new Date(dto.scheduledAt), status: ReminderStatus.SCHEDULED }
          : {}),
        recurrence:
          dto.recurrence === null
            ? Prisma.JsonNull
            : dto.recurrence
              ? { ...dto.recurrence }
              : undefined,
      },
    });
  }

  async complete(userId: string, id: string) {
    await this.findOwned(userId, id);
    return this.prisma.reminder.update({
      where: { id },
      data: { status: ReminderStatus.COMPLETED, completedAt: new Date() },
    });
  }

  async cancel(userId: string, id: string) {
    await this.findOwned(userId, id);
    return this.prisma.reminder.update({
      where: { id },
      data: { status: ReminderStatus.CANCELLED, cancelledAt: new Date() },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.reminder.delete({ where: { id } });
    return { success: true };
  }

  // ---- Actions reachable from a WhatsApp button tap ----

  /** "Done" - stops this reminder for good, including any recurrence. */
  async completeFromReminderAction(userId: string, id: string) {
    return this.complete(userId, id);
  }

  /** "Don't remind me again" - cancels the reminder and any future occurrences. */
  async cancelFromReminderAction(userId: string, id: string) {
    return this.cancel(userId, id);
  }

  /**
   * "Remind me in an hour" - the recursive step.
   *
   * Nothing is held in memory and no timer is set: the reminder simply goes
   * back to SCHEDULED with a later time, and the same cron that fired it will
   * fire it again then, offering the same three buttons. Snoozing repeatedly
   * just repeats this, so the loop survives restarts and redeploys because the
   * database is the only thing holding the schedule.
   */
  async snooze(userId: string, id: string, durationMs: number = SNOOZE_MS): Promise<Reminder> {
    await this.findOwned(userId, id);

    return this.prisma.reminder.update({
      where: { id },
      data: {
        status: ReminderStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() + durationMs),
        snoozeCount: { increment: 1 },
      },
    });
  }

  /** Advances a recurring reminder's next scheduledAt from the occurrence that just fired. */
  computeNextOccurrence(
    from: Date,
    recurrence: { freq: RecurrenceFrequency; interval?: number },
  ): Date {
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

  /**
   * Sends a reminder with Done / In an hour / Don't remind me buttons over
   * every channel the user has connected, and reports what came of it.
   */
  private async deliver(reminder: Reminder): Promise<DeliveryOutcome> {
    const channels = await this.prisma.channel.findMany({
      where: { userId: reminder.userId, isActive: true },
    });

    // Note: no delivery path yet for users with only EMAIL/NATIVE_APP
    // channels connected (no stored mobile push token to target).
    const deliverable = channels.filter((c) => c.type === 'WHATSAPP' || c.type === 'TELEGRAM');
    if (deliverable.length === 0) return 'unreachable';

    const text = reminder.message
      ? `🔔 ${reminder.title}\n${reminder.message}`
      : `🔔 ${reminder.title}`;

    const results = await Promise.all(
      deliverable.map(async (channel): Promise<'prompted' | 'failed'> => {
        try {
          if (channel.type === 'WHATSAPP') {
            const sent = await this.sendWhatsAppPrompt(reminder, channel.externalId, text);
            return sent ? 'prompted' : 'failed';
          }

          await this.telegramService.sendButtons(
            reminder.userId,
            Number(channel.externalId),
            text,
            [
              { id: reminderButtonId(reminder.id, 'done'), title: 'Done' },
              { id: reminderButtonId(reminder.id, 'snooze'), title: 'In an hour' },
              { id: reminderButtonId(reminder.id, 'stop'), title: "Don't remind me" },
            ],
          );
          return 'prompted';
        } catch (error) {
          this.logger.error(`Failed to deliver reminder to channel ${channel.id}`, error);
          return 'failed';
        }
      }),
    );

    return results.includes('prompted') ? 'prompted' : 'failed';
  }

  /**
   * Inside WhatsApp's 24-hour customer service window this is a normal
   * reply-button message. Outside it, WhatsApp only accepts an approved
   * template, so the configured reminder template is sent instead - with the
   * same button ids behind its quick replies, so a tap on either is handled
   * identically.
   *
   * Returns false when nothing could be sent: outside the window with no
   * template configured.
   */
  private async sendWhatsAppPrompt(reminder: Reminder, to: string, text: string): Promise<boolean> {
    const done = reminderButtonId(reminder.id, 'done');
    const snooze = reminderButtonId(reminder.id, 'snooze');
    const stop = reminderButtonId(reminder.id, 'stop');

    if (await this.whatsappService.isWithinCustomerServiceWindow(reminder.userId, to)) {
      await this.whatsappService.sendButtons(reminder.userId, to, text, [
        { id: done, title: 'Done' },
        { id: snooze, title: 'In an hour' },
        { id: stop, title: "Don't remind me" },
      ]);
      return true;
    }

    const templateName = this.config.get<string>('WHATSAPP_REMINDER_TEMPLATE_NAME');
    if (!templateName) {
      this.logger.warn(
        `Reminder ${reminder.id} is outside the 24-hour WhatsApp window and WHATSAPP_REMINDER_TEMPLATE_NAME is not set, so it cannot be sent there.`,
      );
      return false;
    }

    await this.whatsappService.sendTemplate(reminder.userId, to, {
      name: templateName,
      language: this.config.get<string>('WHATSAPP_REMINDER_TEMPLATE_LANGUAGE') || 'en',
      bodyParameters: [
        reminder.message ? `${reminder.title} — ${reminder.message}` : reminder.title,
      ],
      // Same order as the template's buttons: done, in an hour, don't remind me.
      quickReplyPayloads: [done, snooze, stop],
    });
    return true;
  }

  /** Runs every minute: fires any due reminders, then reschedules or finishes them. */
  @Cron(CronExpression.EVERY_MINUTE)
  async processDueReminders(): Promise<void> {
    const now = new Date();

    const due = await this.prisma.reminder.findMany({
      where: {
        status: ReminderStatus.SCHEDULED,
        scheduledAt: { lte: now },
      },
    });

    for (const reminder of due) {
      // Claim the reminder before doing anything visible. Two API instances
      // (or an overlapping run of this job) will both read the same due row,
      // so the write is what decides who owns it - whoever loses gets count 0
      // and skips, and the user gets exactly one message.
      const claim = await this.prisma.reminder.updateMany({
        where: {
          id: reminder.id,
          status: ReminderStatus.SCHEDULED,
          scheduledAt: { lte: now },
        },
        data: { status: ReminderStatus.TRIGGERED, lastTriggeredAt: now },
      });

      if (claim.count !== 1) continue;

      const metadata = (reminder.metadata as Record<string, unknown> | null) ?? {};
      const previousAttempts =
        typeof metadata.deliveryAttempts === 'number' ? metadata.deliveryAttempts : 0;

      const outcome = await this.deliver(reminder);

      // In-app notification alongside any external channel delivery, so the
      // reminder is visible in the product itself even with no WhatsApp/
      // Telegram/push channel connected. Only on the first attempt - a retry
      // must not notify the user a second time.
      if (previousAttempts === 0) {
        await this.notificationsService.create(
          reminder.userId,
          NotificationType.REMINDER_DUE,
          reminder.title,
          reminder.message || 'This reminder is due now.',
          'REMINDER',
          reminder.id,
        );
      }

      const recurrence = reminder.recurrence as {
        freq: RecurrenceFrequency;
        interval?: number;
      } | null;
      const resetAttempts =
        previousAttempts > 0
          ? { metadata: { ...metadata, deliveryAttempts: 0 } as Prisma.InputJsonObject }
          : {};

      if (recurrence?.freq) {
        await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: {
            status: ReminderStatus.SCHEDULED,
            scheduledAt: this.computeNextOccurrence(reminder.scheduledAt, recurrence),
            ...resetAttempts,
          },
        });
      } else if (outcome === 'failed') {
        await this.retryOrFail(reminder.id, metadata, previousAttempts + 1, now);
      } else if (outcome === 'prompted') {
        // Buttons are out, so the reminder stays TRIGGERED until they tap one.
        if (previousAttempts > 0) {
          await this.prisma.reminder.update({ where: { id: reminder.id }, data: resetAttempts });
        }
      } else {
        // No channel to send it to: there is nothing to wait for.
        await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: { status: ReminderStatus.COMPLETED, completedAt: now },
        });
      }

      this.logger.log(`Reminder ${reminder.id} for user ${reminder.userId}: ${outcome}`);
    }
  }

  /**
   * A one-off reminder that reached nobody is retried a few minutes later
   * rather than being marked done unseen - a WhatsApp outage or an expired
   * token shouldn't silently swallow it. After the last attempt it is marked
   * FAILED, which the reminders page shows.
   */
  private async retryOrFail(
    reminderId: string,
    metadata: Record<string, unknown>,
    attempts: number,
    now: Date,
  ) {
    const recordedMetadata = { ...metadata, deliveryAttempts: attempts } as Prisma.InputJsonObject;

    if (attempts < MAX_DELIVERY_ATTEMPTS) {
      await this.prisma.reminder.update({
        where: { id: reminderId },
        data: {
          status: ReminderStatus.SCHEDULED,
          scheduledAt: new Date(now.getTime() + DELIVERY_RETRY_DELAY_MS),
          metadata: recordedMetadata,
        },
      });
      this.logger.warn(
        `Reminder ${reminderId} could not be delivered (attempt ${attempts}); retrying.`,
      );
      return;
    }

    await this.prisma.reminder.update({
      where: { id: reminderId },
      data: { status: ReminderStatus.FAILED, metadata: recordedMetadata },
    });
    this.logger.error(`Reminder ${reminderId} could not be delivered after ${attempts} attempts.`);
  }
}
