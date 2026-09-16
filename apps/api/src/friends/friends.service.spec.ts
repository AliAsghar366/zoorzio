import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FriendsService, MAX_FRIENDS } from './friends.service';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimitService } from '../security/rate-limit.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('FriendsService', () => {
  let service: FriendsService;
  let prisma: any;
  let rateLimitService: any;
  let notificationsService: any;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      friendship: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      friendReminder: { create: jest.fn(), findMany: jest.fn() },
    };
    rateLimitService = {
      checkLimit: jest.fn().mockResolvedValue(true),
      getInfo: jest.fn().mockResolvedValue(null),
    };
    notificationsService = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RateLimitService, useValue: rateLimitService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<FriendsService>(FriendsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendRequest', () => {
    it('should throw NotFoundException when the target email has no account', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.sendRequest('user1', { targetEmail: 'nobody@example.com' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when adding yourself', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user1', email: 'me@example.com' });
      await expect(service.sendRequest('user1', { targetEmail: 'me@example.com' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when already friends', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'friend1', email: 'friend@example.com' });
      prisma.friendship.findFirst.mockResolvedValue({ id: 'f1', status: 'ACCEPTED' });
      await expect(
        service.sendRequest('user1', { targetEmail: 'friend@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when a request is already pending', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'friend1', email: 'friend@example.com' });
      prisma.friendship.findFirst.mockResolvedValue({ id: 'f1', status: 'PENDING' });
      await expect(
        service.sendRequest('user1', { targetEmail: 'friend@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });

    it(`should throw ForbiddenException at the ${MAX_FRIENDS}-friend cap`, async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'friend1', email: 'friend@example.com' });
      prisma.friendship.findFirst.mockResolvedValue(null);
      prisma.friendship.count.mockResolvedValue(MAX_FRIENDS);

      await expect(
        service.sendRequest('user1', { targetEmail: 'friend@example.com' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException once the daily request quota is hit', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'friend1', email: 'friend@example.com' });
      prisma.friendship.findFirst.mockResolvedValue(null);
      prisma.friendship.count.mockResolvedValue(0);
      rateLimitService.checkLimit.mockResolvedValue(false);

      await expect(
        service.sendRequest('user1', { targetEmail: 'friend@example.com' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create the friendship and notify the target user on success', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'friend1', email: 'friend@example.com' })
        .mockResolvedValueOnce({ name: 'Zeesha', email: 'me@example.com' });
      prisma.friendship.findFirst.mockResolvedValue(null);
      prisma.friendship.count.mockResolvedValue(0);
      prisma.friendship.create.mockResolvedValue({
        id: 'f1',
        requesterId: 'user1',
        addresseeId: 'friend1',
      });

      const result = await service.sendRequest('user1', { targetEmail: 'friend@example.com' });

      expect(prisma.friendship.create).toHaveBeenCalledWith({
        data: { requesterId: 'user1', addresseeId: 'friend1' },
      });
      expect(notificationsService.create).toHaveBeenCalledWith(
        'friend1',
        'FRIEND_REQUEST',
        expect.stringContaining('Zeesha'),
        expect.any(String),
        'FRIENDSHIP',
        'f1',
      );
      expect(result.id).toBe('f1');
    });
  });

  describe('respond', () => {
    it('should throw NotFoundException when the request does not belong to the caller', async () => {
      prisma.friendship.findUnique.mockResolvedValue({
        id: 'f1',
        addresseeId: 'someone-else',
        status: 'PENDING',
      });
      await expect(service.respond('user1', 'f1', true)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when already responded to', async () => {
      prisma.friendship.findUnique.mockResolvedValue({
        id: 'f1',
        addresseeId: 'user1',
        status: 'ACCEPTED',
      });
      await expect(service.respond('user1', 'f1', true)).rejects.toThrow(BadRequestException);
    });

    it('should enforce the friend cap when accepting', async () => {
      prisma.friendship.findUnique.mockResolvedValue({
        id: 'f1',
        addresseeId: 'user1',
        status: 'PENDING',
      });
      prisma.friendship.count.mockResolvedValue(MAX_FRIENDS);
      await expect(service.respond('user1', 'f1', true)).rejects.toThrow(ForbiddenException);
    });

    it('should accept a pending request', async () => {
      prisma.friendship.findUnique.mockResolvedValue({
        id: 'f1',
        addresseeId: 'user1',
        status: 'PENDING',
      });
      prisma.friendship.count.mockResolvedValue(0);
      prisma.friendship.update.mockResolvedValue({ id: 'f1', status: 'ACCEPTED' });

      const result = await service.respond('user1', 'f1', true);

      expect(prisma.friendship.update).toHaveBeenCalledWith({
        where: { id: 'f1' },
        data: { status: 'ACCEPTED', respondedAt: expect.any(Date) },
      });
      expect(result.status).toBe('ACCEPTED');
    });

    it('should decline without checking the friend cap', async () => {
      prisma.friendship.findUnique.mockResolvedValue({
        id: 'f1',
        addresseeId: 'user1',
        status: 'PENDING',
      });
      prisma.friendship.update.mockResolvedValue({ id: 'f1', status: 'DECLINED' });

      await service.respond('user1', 'f1', false);

      expect(prisma.friendship.count).not.toHaveBeenCalled();
      expect(prisma.friendship.update).toHaveBeenCalledWith({
        where: { id: 'f1' },
        data: { status: 'DECLINED', respondedAt: expect.any(Date) },
      });
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when the caller is not part of the friendship', async () => {
      prisma.friendship.findUnique.mockResolvedValue({
        id: 'f1',
        requesterId: 'a',
        addresseeId: 'b',
      });
      await expect(service.remove('user1', 'f1')).rejects.toThrow(NotFoundException);
    });

    it('should delete a friendship the caller is part of', async () => {
      prisma.friendship.findUnique.mockResolvedValue({
        id: 'f1',
        requesterId: 'user1',
        addresseeId: 'friend1',
      });
      const result = await service.remove('user1', 'f1');
      expect(prisma.friendship.delete).toHaveBeenCalledWith({ where: { id: 'f1' } });
      expect(result).toEqual({ success: true });
    });
  });

  describe('sendFriendReminder', () => {
    it('should throw ForbiddenException when the target is not an accepted friend', async () => {
      prisma.friendship.findFirst.mockResolvedValue(null);
      await expect(
        service.sendFriendReminder('user1', 'stranger', { message: 'hi' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException once the daily reminder quota is hit', async () => {
      prisma.friendship.findFirst.mockResolvedValue({ id: 'f1', status: 'ACCEPTED' });
      rateLimitService.checkLimit.mockResolvedValueOnce(false);
      await expect(
        service.sendFriendReminder('user1', 'friend1', { message: 'hi' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException once the monthly reminder quota is hit', async () => {
      prisma.friendship.findFirst.mockResolvedValue({ id: 'f1', status: 'ACCEPTED' });
      rateLimitService.checkLimit.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      await expect(
        service.sendFriendReminder('user1', 'friend1', { message: 'hi' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create the reminder and notify the recipient on success', async () => {
      prisma.friendship.findFirst.mockResolvedValue({ id: 'f1', status: 'ACCEPTED' });
      prisma.friendReminder.create.mockResolvedValue({
        id: 'r1',
        senderId: 'user1',
        recipientId: 'friend1',
      });
      prisma.user.findUnique.mockResolvedValue({ name: 'Zeesha', email: 'me@example.com' });

      await service.sendFriendReminder('user1', 'friend1', { message: 'Pick up milk' });

      expect(prisma.friendReminder.create).toHaveBeenCalledWith({
        data: {
          senderId: 'user1',
          recipientId: 'friend1',
          message: 'Pick up milk',
          scheduledAt: null,
        },
      });
      expect(notificationsService.create).toHaveBeenCalledWith(
        'friend1',
        'FRIEND_REMINDER',
        expect.stringContaining('Zeesha'),
        'Pick up milk',
        'FRIEND_REMINDER',
        'r1',
      );
    });
  });

  describe('listFriends', () => {
    it('should return the other side of each accepted friendship', async () => {
      prisma.friendship.findMany.mockResolvedValue([
        {
          id: 'f1',
          requesterId: 'user1',
          addresseeId: 'friend1',
          respondedAt: new Date('2026-01-01'),
          requester: { id: 'user1' },
          addressee: { id: 'friend1', name: 'Friend One' },
        },
        {
          id: 'f2',
          requesterId: 'friend2',
          addresseeId: 'user1',
          respondedAt: new Date('2026-01-02'),
          requester: { id: 'friend2', name: 'Friend Two' },
          addressee: { id: 'user1' },
        },
      ]);

      const result = await service.listFriends('user1');

      expect(result).toEqual([
        {
          friendshipId: 'f1',
          friend: { id: 'friend1', name: 'Friend One' },
          since: new Date('2026-01-01'),
        },
        {
          friendshipId: 'f2',
          friend: { id: 'friend2', name: 'Friend Two' },
          since: new Date('2026-01-02'),
        },
      ]);
    });
  });
});
