import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a notification with the given fields', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'n1' });

      await service.create(
        'user1',
        'REMINDER_DUE' as any,
        'Take medicine',
        'It is time',
        'REMINDER',
        'r1',
      );

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user1',
          type: 'REMINDER_DUE',
          title: 'Take medicine',
          message: 'It is time',
          resourceType: 'REMINDER',
          resourceId: 'r1',
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return notifications newest first', async () => {
      prisma.notification.findMany.mockResolvedValue([{ id: 'n1' }]);

      const result = await service.findAll('user1');

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
      expect(result).toEqual([{ id: 'n1' }]);
    });

    it('should filter to unread only when requested', async () => {
      prisma.notification.findMany.mockResolvedValue([]);

      await service.findAll('user1', true);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user1', isRead: false } }),
      );
    });
  });

  describe('unreadCount', () => {
    it('should count unread notifications for the user', async () => {
      prisma.notification.count.mockResolvedValue(3);

      const result = await service.unreadCount('user1');

      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user1', isRead: false },
      });
      expect(result).toBe(3);
    });
  });

  describe('markAsRead', () => {
    it('should throw NotFoundException when the notification belongs to another user', async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: 'n1', userId: 'other-user' });

      await expect(service.markAsRead('user1', 'n1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when the notification does not exist', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(service.markAsRead('user1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('should mark an owned notification as read', async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: 'n1', userId: 'user1' });
      prisma.notification.update.mockResolvedValue({ id: 'n1', isRead: true });

      const result = await service.markAsRead('user1', 'n1');

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { isRead: true },
      });
      expect(result.isRead).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark every unread notification for the user as read', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 4 });

      const result = await service.markAllAsRead('user1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user1', isRead: false },
        data: { isRead: true },
      });
      expect(result).toEqual({ count: 4 });
    });
  });
});
