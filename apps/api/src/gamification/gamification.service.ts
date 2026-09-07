import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface Achievement {
  key: string;
  title: string;
  completed: boolean;
}

/**
 * "Master Zoorzio" - a 21-action progression system, matching the reference
 * design's "0/21 actions" widget. Every achievement is computed live from
 * existing tables (memory/list/reminder/task/friend counts, subscription
 * status) rather than event-sourced into a new table: it's always correct
 * (no risk of a missed "record this action" call leaving progress stale),
 * and it required zero schema changes or changes to any other service.
 */
@Injectable()
export class GamificationService {
  constructor(private prisma: PrismaService) {}

  async getProgress(userId: string) {
    const stats = await this.gatherStats(userId);
    const actions: Achievement[] = this.buildAchievements(stats);
    const completed = actions.filter((a) => a.completed).length;

    return { completed, total: actions.length, actions };
  }

  private async gatherStats(userId: string) {
    const [
      memoryCount,
      keptMemoryCount,
      listCount,
      reminderCount,
      taskCount,
      completedTaskCount,
      taskWithDueDateCount,
      overdueTaskCount,
      shareCount,
      messagingChannelCount,
      calendarCount,
      acceptedFriendCount,
      friendReminderSentCount,
      subscription,
    ] = await Promise.all([
      this.prisma.memory.count({ where: { userId, isArchived: false } }),
      this.prisma.memory.count({ where: { userId, isVerified: true } }),
      this.prisma.list.count({ where: { userId, isArchived: false } }),
      this.prisma.reminder.count({ where: { userId } }),
      this.prisma.task.count({ where: { userId } }),
      this.prisma.task.count({ where: { userId, status: 'COMPLETED' } }),
      this.prisma.task.count({ where: { userId, dueDate: { not: null } } }),
      this.prisma.task.count({
        where: { userId, status: { notIn: ['COMPLETED', 'CANCELLED'] }, dueDate: { lt: new Date() } },
      }),
      this.prisma.share.count({ where: { ownerId: userId } }),
      this.prisma.channel.count({ where: { userId, isActive: true, type: { in: ['WHATSAPP', 'TELEGRAM'] } } }),
      this.prisma.calendar.count({ where: { userId, isActive: true } }),
      this.prisma.friendship.count({
        where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
      }),
      this.prisma.friendReminder.count({ where: { senderId: userId } }),
      this.prisma.subscription.findUnique({ where: { userId } }),
    ]);

    return {
      memoryCount,
      keptMemoryCount,
      listCount,
      reminderCount,
      taskCount,
      completedTaskCount,
      taskWithDueDateCount,
      overdueTaskCount,
      shareCount,
      messagingChannelCount,
      calendarCount,
      acceptedFriendCount,
      friendReminderSentCount,
      hasPaidPlan: !!subscription && (subscription.status === 'ACTIVE' || subscription.status === 'TRIALING'),
    };
  }

  private buildAchievements(stats: Awaited<ReturnType<GamificationService['gatherStats']>>): Achievement[] {
    return [
      { key: 'first_memory', title: 'Create your first memory', completed: stats.memoryCount >= 1 },
      { key: 'memories_5', title: 'Create 5 memories', completed: stats.memoryCount >= 5 },
      { key: 'memories_10', title: 'Create 10 memories', completed: stats.memoryCount >= 10 },
      { key: 'first_list', title: 'Create your first list', completed: stats.listCount >= 1 },
      { key: 'lists_3', title: 'Create 3 lists', completed: stats.listCount >= 3 },
      { key: 'first_reminder', title: 'Create your first reminder', completed: stats.reminderCount >= 1 },
      { key: 'reminders_10', title: 'Create 10 reminders', completed: stats.reminderCount >= 10 },
      { key: 'first_task', title: 'Create your first task', completed: stats.taskCount >= 1 },
      { key: 'first_task_done', title: 'Complete your first task', completed: stats.completedTaskCount >= 1 },
      { key: 'tasks_done_5', title: 'Complete 5 tasks', completed: stats.completedTaskCount >= 5 },
      { key: 'task_with_due_date', title: 'Create a task with a due date', completed: stats.taskWithDueDateCount >= 1 },
      {
        key: 'no_overdue_tasks',
        title: 'Clear all overdue tasks',
        completed: stats.taskCount >= 1 && stats.overdueTaskCount === 0,
      },
      { key: 'first_share', title: 'Share a list or reminder with someone', completed: stats.shareCount >= 1 },
      {
        key: 'connect_messaging_channel',
        title: 'Connect a messaging channel (WhatsApp or Telegram)',
        completed: stats.messagingChannelCount >= 1,
      },
      {
        key: 'connect_calendar',
        title: 'Connect a calendar (Google, Outlook, or Apple)',
        completed: stats.calendarCount >= 1,
      },
      { key: 'cleanup_5', title: 'Review 5 memories in Clean up', completed: stats.keptMemoryCount >= 5 },
      { key: 'cleanup_10', title: 'Review 10 memories in Clean up', completed: stats.keptMemoryCount >= 10 },
      { key: 'first_friend', title: 'Add your first friend', completed: stats.acceptedFriendCount >= 1 },
      { key: 'friends_5', title: 'Add 5 friends', completed: stats.acceptedFriendCount >= 5 },
      {
        key: 'friend_reminder_sent',
        title: 'Send a reminder to a friend',
        completed: stats.friendReminderSentCount >= 1,
      },
      { key: 'upgrade_plan', title: 'Upgrade to a paid plan', completed: stats.hasPaidPlan },
    ];
  }
}
