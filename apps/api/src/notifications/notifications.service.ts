import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@anchor/database';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    resourceType?: string,
    resourceId?: string,
  ) {
    return this.prisma.notification.create({
      data: { userId, type, title, message, resourceType, resourceId },
    });
  }

  async findAll(userId: string, unreadOnly = false, limit = 50, offset = 0) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    return this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  }
}
