import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BoardsService', () => {
  let service: BoardsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      board: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BoardsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(BoardsService);
  });

  describe('getOrCreateDefault', () => {
    it('returns the existing earliest board when one exists', async () => {
      prisma.board.findFirst.mockResolvedValue({
        id: 'board1',
        userId: 'user123',
        name: "Today's board",
      });

      const result = await service.getOrCreateDefault('user123');

      expect(result).toEqual({ id: 'board1', userId: 'user123', name: "Today's board" });
      expect(prisma.board.create).not.toHaveBeenCalled();
    });

    it('creates a default board when the user has none', async () => {
      prisma.board.findFirst.mockResolvedValue(null);
      prisma.board.create.mockResolvedValue({
        id: 'board1',
        userId: 'user123',
        name: "Today's board",
      });

      const result = await service.getOrCreateDefault('user123');

      expect(result.name).toBe("Today's board");
      expect(prisma.board.create).toHaveBeenCalledWith({
        data: { userId: 'user123', name: "Today's board" },
      });
    });
  });

  describe('list', () => {
    it('returns existing boards with task counts', async () => {
      prisma.board.findMany.mockResolvedValue([
        { id: 'board1', userId: 'user123', _count: { tasks: 3 } },
      ]);

      const result = await service.list('user123');

      expect(result).toEqual([{ id: 'board1', userId: 'user123', _count: { tasks: 3 } }]);
    });

    it('lazily creates and returns a default board when the user has none', async () => {
      prisma.board.findMany.mockResolvedValue([]);
      prisma.board.findFirst.mockResolvedValue(null);
      prisma.board.create.mockResolvedValue({
        id: 'board1',
        userId: 'user123',
        name: "Today's board",
      });

      const result = await service.list('user123');

      expect(result).toEqual([
        { id: 'board1', userId: 'user123', name: "Today's board", _count: { tasks: 0 } },
      ]);
    });
  });

  describe('findOne', () => {
    it('returns the board with its tasks', async () => {
      prisma.board.findUnique.mockResolvedValue({ id: 'board1', userId: 'user123', tasks: [] });
      const result = await service.findOne('user123', 'board1');
      expect(result).toEqual({ id: 'board1', userId: 'user123', tasks: [] });
    });

    it('throws NotFoundException for a board that does not exist', async () => {
      prisma.board.findUnique.mockResolvedValue(null);
      await expect(service.findOne('user123', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for a board owned by someone else', async () => {
      prisma.board.findUnique.mockResolvedValue({ id: 'board1', userId: 'other-user' });
      await expect(service.findOne('user123', 'board1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('creates a board for the given user', async () => {
      prisma.board.create.mockResolvedValue({
        id: 'board1',
        userId: 'user123',
        name: 'Weekend trip',
      });
      const result = await service.create('user123', 'Weekend trip');
      expect(result.name).toBe('Weekend trip');
      expect(prisma.board.create).toHaveBeenCalledWith({
        data: { userId: 'user123', name: 'Weekend trip' },
      });
    });
  });

  describe('rename', () => {
    it('renames a board owned by the caller', async () => {
      prisma.board.findUnique.mockResolvedValue({ id: 'board1', userId: 'user123' });
      prisma.board.update.mockResolvedValue({ id: 'board1', name: 'New name' });

      const result = await service.rename('user123', 'board1', 'New name');

      expect(result.name).toBe('New name');
    });

    it('throws ForbiddenException when renaming a board owned by someone else', async () => {
      prisma.board.findUnique.mockResolvedValue({ id: 'board1', userId: 'other-user' });
      await expect(service.rename('user123', 'board1', 'New name')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.board.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes a board owned by the caller', async () => {
      prisma.board.findUnique.mockResolvedValue({ id: 'board1', userId: 'user123' });
      prisma.board.delete.mockResolvedValue({});

      const result = await service.remove('user123', 'board1');

      expect(result).toEqual({ success: true });
      expect(prisma.board.delete).toHaveBeenCalledWith({ where: { id: 'board1' } });
    });

    it('throws NotFoundException for a board that does not exist', async () => {
      prisma.board.findUnique.mockResolvedValue(null);
      await expect(service.remove('user123', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when deleting a board owned by someone else', async () => {
      prisma.board.findUnique.mockResolvedValue({ id: 'board1', userId: 'other-user' });
      await expect(service.remove('user123', 'board1')).rejects.toThrow(ForbiddenException);
      expect(prisma.board.delete).not.toHaveBeenCalled();
    });
  });
});
