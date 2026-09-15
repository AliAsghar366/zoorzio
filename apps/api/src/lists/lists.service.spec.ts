import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { ListsService } from './lists.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { ListType } from '@anchor/database';

describe('ListsService', () => {
  let service: ListsService;
  let prisma: any;
  let planLimits: any;

  beforeEach(async () => {
    prisma = {
      list: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      listItem: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    planLimits = { assertCanCreate: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PlanLimitsService, useValue: planLimits },
      ],
    }).compile();

    service = module.get<ListsService>(ListsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should default to CUSTOM type when none provided', async () => {
      prisma.list.create.mockResolvedValue({ id: 'l1', name: 'Groceries', type: 'CUSTOM' });

      await service.create('user1', { name: 'Groceries' });

      expect(prisma.list.create).toHaveBeenCalledWith({
        data: { userId: 'user1', name: 'Groceries', type: ListType.CUSTOM },
        include: { items: true },
      });
    });

    it('should check the plan limit before creating', async () => {
      prisma.list.create.mockResolvedValue({ id: 'l1', name: 'Groceries', type: 'CUSTOM' });

      await service.create('user1', { name: 'Groceries' });

      expect(planLimits.assertCanCreate).toHaveBeenCalledWith('user1', 'lists');
    });

    it('should propagate ForbiddenException when the plan limit is reached', async () => {
      planLimits.assertCanCreate.mockRejectedValue(new ForbiddenException('limit reached'));

      await expect(service.create('user1', { name: 'Groceries' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.list.create).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if list belongs to another user', async () => {
      prisma.list.findUnique.mockResolvedValue({ id: 'l1', userId: 'other-user', items: [] });

      await expect(service.findOne('user1', 'l1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if list does not exist', async () => {
      prisma.list.findUnique.mockResolvedValue(null);

      await expect(service.findOne('user1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should return the list when owned by the user', async () => {
      const list = { id: 'l1', userId: 'user1', items: [] };
      prisma.list.findUnique.mockResolvedValue(list);

      const result = await service.findOne('user1', 'l1');

      expect(result).toEqual(list);
    });
  });

  describe('addItem', () => {
    it('should position new items at the end of the list', async () => {
      prisma.list.findUnique.mockResolvedValue({
        id: 'l1',
        userId: 'user1',
        items: [{ id: 'i1' }, { id: 'i2' }],
      });
      prisma.listItem.create.mockResolvedValue({ id: 'i3', content: 'Eggs', position: 2 });

      await service.addItem('user1', 'l1', { content: 'Eggs' });

      expect(prisma.listItem.create).toHaveBeenCalledWith({
        data: { listId: 'l1', content: 'Eggs', position: 2 },
      });
    });
  });

  describe('removeItem', () => {
    it('should throw NotFoundException if the item belongs to a different list', async () => {
      prisma.list.findUnique.mockResolvedValue({ id: 'l1', userId: 'user1', items: [] });
      prisma.listItem.findUnique.mockResolvedValue({ id: 'i1', listId: 'other-list' });

      await expect(service.removeItem('user1', 'l1', 'i1')).rejects.toThrow(NotFoundException);
    });

    it('should delete the item when it belongs to the list', async () => {
      prisma.list.findUnique.mockResolvedValue({ id: 'l1', userId: 'user1', items: [] });
      prisma.listItem.findUnique.mockResolvedValue({ id: 'i1', listId: 'l1' });
      prisma.listItem.delete.mockResolvedValue({});

      const result = await service.removeItem('user1', 'l1', 'i1');

      expect(result).toEqual({ success: true });
      expect(prisma.listItem.delete).toHaveBeenCalledWith({ where: { id: 'i1' } });
    });
  });
});
