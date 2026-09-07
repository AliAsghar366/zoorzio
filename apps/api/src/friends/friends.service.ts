import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FriendshipStatus, NotificationType } from '@anchor/database';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimitService } from '../security/rate-limit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { SendFriendReminderDto } from './dto/send-friend-reminder.dto';

// Matches the quotas shown on the reference Zoorzio design: 200 friends max,
// 20 new friend requests/day, 50 friend-reminders/day, 1000/month.
export const MAX_FRIENDS = 200;
const MAX_FRIEND_REQUESTS_PER_DAY = 20;
const MAX_FRIEND_REMINDERS_PER_DAY = 50;
const MAX_FRIEND_REMINDERS_PER_MONTH = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;

@Injectable()
export class FriendsService {
  constructor(
    private prisma: PrismaService,
    private rateLimitService: RateLimitService,
    private notificationsService: NotificationsService,
  ) {}

  async sendRequest(userId: string, dto: SendFriendRequestDto) {
    const targetUser = await this.prisma.user.findUnique({ where: { email: dto.targetEmail } });
    if (!targetUser) {
      throw new NotFoundException('No Zoorzio user found with that email');
    }
    if (targetUser.id === userId) {
      throw new BadRequestException('You cannot add yourself as a friend');
    }

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: targetUser.id },
          { requesterId: targetUser.id, addresseeId: userId },
        ],
      },
    });
    if (existing) {
      if (existing.status === 'ACCEPTED') {
        throw new BadRequestException('You are already friends');
      }
      if (existing.status === 'PENDING') {
        throw new BadRequestException('A friend request is already pending between you two');
      }
    }

    const friendCount = await this.countAcceptedFriends(userId);
    if (friendCount >= MAX_FRIENDS) {
      throw new ForbiddenException(`You've reached the limit of ${MAX_FRIENDS} friends.`);
    }

    const withinDailyAddLimit = await this.rateLimitService.checkLimit(
      `friend-add:${userId}`,
      MAX_FRIEND_REQUESTS_PER_DAY,
      DAY_MS,
    );
    if (!withinDailyAddLimit) {
      throw new ForbiddenException(
        `You've sent the maximum of ${MAX_FRIEND_REQUESTS_PER_DAY} friend requests today. Try again tomorrow.`,
      );
    }

    const friendship = existing
      ? await this.prisma.friendship.update({
          where: { id: existing.id },
          data: { status: 'PENDING', requesterId: userId, addresseeId: targetUser.id, respondedAt: null },
        })
      : await this.prisma.friendship.create({
          data: { requesterId: userId, addresseeId: targetUser.id },
        });

    const requester = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    await this.notificationsService.create(
      targetUser.id,
      NotificationType.FRIEND_REQUEST,
      `${requester?.name || requester?.email} wants to be your friend`,
      'Accept to start sending each other reminders.',
      'FRIENDSHIP',
      friendship.id,
    );

    return friendship;
  }

  async respond(userId: string, friendshipId: string, accept: boolean) {
    const friendship = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!friendship || friendship.addresseeId !== userId) {
      throw new NotFoundException('Friend request not found');
    }
    if (friendship.status !== 'PENDING') {
      throw new BadRequestException('This request has already been responded to');
    }

    if (accept) {
      const friendCount = await this.countAcceptedFriends(userId);
      if (friendCount >= MAX_FRIENDS) {
        throw new ForbiddenException(`You've reached the limit of ${MAX_FRIENDS} friends.`);
      }
    }

    return this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: accept ? FriendshipStatus.ACCEPTED : FriendshipStatus.DECLINED, respondedAt: new Date() },
    });
  }

  async remove(userId: string, friendshipId: string) {
    const friendship = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!friendship || (friendship.requesterId !== userId && friendship.addresseeId !== userId)) {
      throw new NotFoundException('Friendship not found');
    }
    await this.prisma.friendship.delete({ where: { id: friendshipId } });
    return { success: true };
  }

  async listFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
      include: {
        requester: { select: { id: true, email: true, name: true, avatar: true } },
        addressee: { select: { id: true, email: true, name: true, avatar: true } },
      },
      orderBy: { respondedAt: 'desc' },
    });

    return friendships.map((f) => ({
      friendshipId: f.id,
      friend: f.requesterId === userId ? f.addressee : f.requester,
      since: f.respondedAt,
    }));
  }

  async listIncomingRequests(userId: string) {
    return this.prisma.friendship.findMany({
      where: { addresseeId: userId, status: 'PENDING' },
      include: { requester: { select: { id: true, email: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async countAcceptedFriends(userId: string): Promise<number> {
    return this.prisma.friendship.count({
      where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
    });
  }

  private async areFriends(userId: string, otherUserId: string): Promise<boolean> {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: userId, addresseeId: otherUserId },
          { requesterId: otherUserId, addresseeId: userId },
        ],
      },
    });
    return !!friendship;
  }

  async sendFriendReminder(userId: string, friendId: string, dto: SendFriendReminderDto) {
    if (!(await this.areFriends(userId, friendId))) {
      throw new ForbiddenException('You can only send reminders to accepted friends');
    }

    const withinDailyLimit = await this.rateLimitService.checkLimit(
      `friend-reminder-daily:${userId}`,
      MAX_FRIEND_REMINDERS_PER_DAY,
      DAY_MS,
    );
    if (!withinDailyLimit) {
      throw new ForbiddenException(`You've sent the maximum of ${MAX_FRIEND_REMINDERS_PER_DAY} friend reminders today.`);
    }

    const withinMonthlyLimit = await this.rateLimitService.checkLimit(
      `friend-reminder-monthly:${userId}`,
      MAX_FRIEND_REMINDERS_PER_MONTH,
      MONTH_MS,
    );
    if (!withinMonthlyLimit) {
      throw new ForbiddenException(
        `You've sent the maximum of ${MAX_FRIEND_REMINDERS_PER_MONTH} friend reminders this month.`,
      );
    }

    const reminder = await this.prisma.friendReminder.create({
      data: {
        senderId: userId,
        recipientId: friendId,
        message: dto.message,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      },
    });

    const sender = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    await this.notificationsService.create(
      friendId,
      NotificationType.FRIEND_REMINDER,
      `Reminder from ${sender?.name || sender?.email}`,
      dto.message,
      'FRIEND_REMINDER',
      reminder.id,
    );

    return reminder;
  }

  async getQuota(userId: string) {
    const [friendCount, dailyRequests, dailyReminders, monthlyReminders] = await Promise.all([
      this.countAcceptedFriends(userId),
      this.rateLimitService.getInfo(`friend-add:${userId}`),
      this.rateLimitService.getInfo(`friend-reminder-daily:${userId}`),
      this.rateLimitService.getInfo(`friend-reminder-monthly:${userId}`),
    ]);

    return {
      friends: { used: friendCount, limit: MAX_FRIENDS },
      requestsToday: { used: dailyRequests ? MAX_FRIEND_REQUESTS_PER_DAY - dailyRequests.remaining : 0, limit: MAX_FRIEND_REQUESTS_PER_DAY },
      remindersToday: { used: dailyReminders ? MAX_FRIEND_REMINDERS_PER_DAY - dailyReminders.remaining : 0, limit: MAX_FRIEND_REMINDERS_PER_DAY },
      remindersThisMonth: {
        used: monthlyReminders ? MAX_FRIEND_REMINDERS_PER_MONTH - monthlyReminders.remaining : 0,
        limit: MAX_FRIEND_REMINDERS_PER_MONTH,
      },
    };
  }

  async listReceivedReminders(userId: string) {
    return this.prisma.friendReminder.findMany({
      where: { recipientId: userId },
      include: { sender: { select: { id: true, email: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
