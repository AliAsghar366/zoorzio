import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SharingService } from './sharing.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('SharingService', () => {
  let service: SharingService;
  let prisma: any;
  let notificationsService: any;

  beforeEach(async () => {
    prisma = {
      list: { findUnique: jest.fn(), findMany: jest.fn() },
      reminder: { findUnique: jest.fn(), findMany: jest.fn() },
      user: { findUnique: jest.fn() },
      share: { upsert: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
    };
    notificationsService = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharingService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<SharingService>(SharingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('share', () => {
    it('should create a share when the caller owns the list and the target user exists', async () => {
      prisma.list.findUnique.mockResolvedValue({ id: 'list1', userId: 'owner1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'friend1', email: 'friend@anchor.app' });
      prisma.share.upsert.mockResolvedValue({ id: 'share1' });

      const result = await service.share('owner1', {
        resourceType: 'LIST',
        resourceId: 'list1',
        targetEmail: 'friend@anchor.app',
      });

      expect(result).toEqual({ id: 'share1' });
      expect(prisma.share.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            ownerId: 'owner1',
            sharedWithId: 'friend1',
            resourceType: 'LIST',
            resourceId: 'list1',
            permission: 'VIEW',
          }),
        }),
      );
    });

    it('should throw NotFoundException when the caller does not own the resource', async () => {
      prisma.list.findUnique.mockResolvedValue({ id: 'list1', userId: 'someone-else' });

      await expect(
        service.share('owner1', {
          resourceType: 'LIST',
          resourceId: 'list1',
          targetEmail: 'friend@anchor.app',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when the target email has no Zoorzio account', async () => {
      prisma.list.findUnique.mockResolvedValue({ id: 'list1', userId: 'owner1' });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.share('owner1', {
          resourceType: 'LIST',
          resourceId: 'list1',
          targetEmail: 'nobody@example.com',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when sharing with yourself', async () => {
      prisma.list.findUnique.mockResolvedValue({ id: 'list1', userId: 'owner1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'owner1', email: 'owner@anchor.app' });

      await expect(
        service.share('owner1', {
          resourceType: 'LIST',
          resourceId: 'list1',
          targetEmail: 'owner@anchor.app',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should notify the recipient with the owner's name and the granted permission", async () => {
      prisma.list.findUnique.mockResolvedValue({ id: 'list1', userId: 'owner1' });
      prisma.user.findUnique.mockImplementation(({ where }: any) => {
        if (where.email) return { id: 'friend1', email: 'friend@anchor.app' };
        if (where.id === 'owner1')
          return { id: 'owner1', email: 'owner@anchor.app', name: 'Owner One' };
        return null;
      });
      prisma.share.upsert.mockResolvedValue({ id: 'share1' });

      await service.share('owner1', {
        resourceType: 'LIST',
        resourceId: 'list1',
        targetEmail: 'friend@anchor.app',
        permission: 'EDIT',
      });

      expect(notificationsService.create).toHaveBeenCalledWith(
        'friend1',
        'SHARED_WITH_YOU',
        expect.stringContaining('Owner One'),
        expect.stringContaining('edit'),
        'LIST',
        'list1',
      );
    });
  });

  describe('revoke', () => {
    it('should delete a share the caller owns', async () => {
      prisma.share.findUnique.mockResolvedValue({ id: 'share1', ownerId: 'owner1' });

      const result = await service.revoke('owner1', 'share1');

      expect(result).toEqual({ success: true });
      expect(prisma.share.delete).toHaveBeenCalledWith({ where: { id: 'share1' } });
    });

    it('should throw NotFoundException when the caller does not own the share', async () => {
      prisma.share.findUnique.mockResolvedValue({ id: 'share1', ownerId: 'someone-else' });

      await expect(service.revoke('owner1', 'share1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listSharedWithMe', () => {
    it('should hydrate shared lists with their full record', async () => {
      prisma.share.findMany.mockResolvedValue([
        {
          id: 'share1',
          resourceType: 'LIST',
          resourceId: 'list1',
          permission: 'VIEW',
          owner: { id: 'owner1', email: 'owner@anchor.app', name: 'Owner' },
        },
      ]);
      prisma.list.findMany.mockResolvedValue([
        { id: 'list1', name: 'Shared groceries', items: [] },
      ]);
      prisma.reminder.findMany.mockResolvedValue([]);

      const result = await service.listSharedWithMe('friend1');

      expect(result).toEqual([
        {
          shareId: 'share1',
          resourceType: 'LIST',
          permission: 'VIEW',
          owner: { id: 'owner1', email: 'owner@anchor.app', name: 'Owner' },
          resource: { id: 'list1', name: 'Shared groceries', items: [] },
        },
      ]);
    });

    it('should drop shares whose underlying resource no longer exists', async () => {
      prisma.share.findMany.mockResolvedValue([
        {
          id: 'share1',
          resourceType: 'LIST',
          resourceId: 'deleted-list',
          permission: 'VIEW',
          owner: {},
        },
      ]);
      prisma.list.findMany.mockResolvedValue([]);
      prisma.reminder.findMany.mockResolvedValue([]);

      const result = await service.listSharedWithMe('friend1');

      expect(result).toEqual([]);
    });
  });
});
