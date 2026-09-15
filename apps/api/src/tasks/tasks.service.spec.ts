import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { BoardsService } from '../boards/boards.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { TaskPriority, TaskStatus } from '@anchor/database';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: any;
  let ai: any;
  let planLimits: any;
  let boardsService: any;

  beforeEach(async () => {
    prisma = {
      task: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      board: {
        findUnique: jest.fn(),
      },
      memory: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      reminder: {
        create: jest.fn(),
      },
    };

    ai = {
      extractTask: jest.fn(),
    };

    planLimits = { assertCanCreate: jest.fn() };
    boardsService = { getOrCreateDefault: jest.fn().mockResolvedValue({ id: 'default-board-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: AIService, useValue: ai },
        { provide: PlanLimitsService, useValue: planLimits },
        { provide: BoardsService, useValue: boardsService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a task', async () => {
      const userId = 'user123';
      const createDto = {
        title: 'Buy groceries',
        description: 'Milk, eggs, bread',
        priority: TaskPriority.MEDIUM,
      };

      const expectedTask = {
        id: 'task123',
        userId,
        ...createDto,
      };

      prisma.task.create.mockResolvedValue(expectedTask);

      const result = await service.create(userId, createDto);

      expect(result).toEqual(expectedTask);
      expect(prisma.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          title: createDto.title,
          description: createDto.description,
          priority: createDto.priority,
        }),
      });
    });

    it('should check the plan limit before creating', async () => {
      prisma.task.create.mockResolvedValue({ id: 'task123' });

      await service.create('user123', { title: 'Buy groceries' });

      expect(planLimits.assertCanCreate).toHaveBeenCalledWith('user123', 'tasks');
    });

    it('should propagate ForbiddenException when the plan limit is reached', async () => {
      planLimits.assertCanCreate.mockRejectedValue(new ForbiddenException('limit reached'));

      await expect(service.create('user123', { title: 'Buy groceries' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it('should create task linked to memory', async () => {
      const userId = 'user123';
      const memoryId = 'mem123';
      const createDto = {
        title: 'Follow up on meeting',
        memoryId,
      };

      prisma.memory.findUnique.mockResolvedValue({
        id: memoryId,
        userId,
      });
      prisma.task.create.mockResolvedValue({
        id: 'task123',
        userId,
        ...createDto,
      });

      const result = await service.create(userId, createDto);

      expect(result).toHaveProperty('id', 'task123');
      expect(prisma.memory.findUnique).toHaveBeenCalledWith({
        where: { id: memoryId },
      });
    });

    it('should throw NotFoundException if memory not found', async () => {
      prisma.memory.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user123', {
          title: 'Task',
          memoryId: 'nonexistent',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if memory belongs to another user (avoids leaking existence)', async () => {
      prisma.memory.findUnique.mockResolvedValue({
        id: 'mem123',
        userId: 'other-user',
      });

      await expect(
        service.create('user123', {
          title: 'Task',
          memoryId: 'mem123',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('auto-assigns the task to the default board when no boardId is given', async () => {
      prisma.task.create.mockResolvedValue({ id: 'task123' });

      await service.create('user123', { title: 'Buy groceries' });

      expect(boardsService.getOrCreateDefault).toHaveBeenCalledWith('user123');
      expect(prisma.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ boardId: 'default-board-1' }),
      });
    });

    it('assigns the task to the given board when it belongs to the caller', async () => {
      prisma.board.findUnique.mockResolvedValue({ id: 'board-42', userId: 'user123' });
      prisma.task.create.mockResolvedValue({ id: 'task123' });

      await service.create('user123', { title: 'Buy groceries', boardId: 'board-42' });

      expect(boardsService.getOrCreateDefault).not.toHaveBeenCalled();
      expect(prisma.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ boardId: 'board-42' }),
      });
    });

    it('throws NotFoundException when the given board belongs to someone else', async () => {
      prisma.board.findUnique.mockResolvedValue({ id: 'board-42', userId: 'other-user' });

      await expect(
        service.create('user123', { title: 'Buy groceries', boardId: 'board-42' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return tasks for a user', async () => {
      const userId = 'user123';
      const expectedTasks = [
        { id: 'task1', userId, title: 'Task 1' },
        { id: 'task2', userId, title: 'Task 2' },
      ];

      prisma.task.findMany.mockResolvedValue(expectedTasks);

      const result = await service.findAll(userId);

      expect(result).toEqual(expectedTasks);
    });

    it('should filter by status', async () => {
      const userId = 'user123';
      const status = 'PENDING';

      prisma.task.findMany.mockResolvedValue([]);

      await service.findAll(userId, status);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status,
          }),
        }),
      );
    });

    it('should filter by boardId', async () => {
      prisma.task.findMany.mockResolvedValue([]);

      await service.findAll('user123', undefined, 50, 'board-42');

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ boardId: 'board-42' }) }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a task by id', async () => {
      const userId = 'user123';
      const taskId = 'task123';
      const expectedTask = {
        id: taskId,
        userId,
        title: 'Test task',
      };

      prisma.task.findUnique.mockResolvedValue(expectedTask);

      const result = await service.findOne(userId, taskId);

      expect(result).toEqual(expectedTask);
    });

    it('should throw if task not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(service.findOne('user123', 'task123')).rejects.toThrow(NotFoundException);
    });

    it('should throw if user is not authorized', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 'task123',
        userId: 'other-user',
      });

      await expect(service.findOne('user123', 'task123')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update a task', async () => {
      const userId = 'user123';
      const taskId = 'task123';
      const updateDto = {
        title: 'Updated task',
        status: TaskStatus.COMPLETED,
      };

      prisma.task.findUnique.mockResolvedValue({
        id: taskId,
        userId,
      });
      prisma.task.update.mockResolvedValue({
        id: taskId,
        userId,
        ...updateDto,
      });

      const result = await service.update(userId, taskId, updateDto);

      expect(result).toHaveProperty('title', 'Updated task');
      expect(result).toHaveProperty('status', 'COMPLETED');
    });

    it('should set completedAt when marking as completed', async () => {
      const userId = 'user123';
      const taskId = 'task123';

      prisma.task.findUnique.mockResolvedValue({
        id: taskId,
        userId,
      });
      prisma.task.update.mockResolvedValue({
        id: taskId,
        status: 'COMPLETED',
      });

      await service.update(userId, taskId, { status: TaskStatus.COMPLETED });

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            completedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('moves the task to a different board owned by the caller', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task123', userId: 'user123' });
      prisma.board.findUnique.mockResolvedValue({ id: 'board-42', userId: 'user123' });
      prisma.task.update.mockResolvedValue({ id: 'task123', boardId: 'board-42' });

      await service.update('user123', 'task123', { boardId: 'board-42' });

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ boardId: 'board-42' }) }),
      );
    });

    it('throws NotFoundException when moving to a board owned by someone else', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task123', userId: 'user123' });
      prisma.board.findUnique.mockResolvedValue({ id: 'board-42', userId: 'other-user' });

      await expect(service.update('user123', 'task123', { boardId: 'board-42' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.task.update).not.toHaveBeenCalled();
    });
  });

  describe('completeTask', () => {
    it('should mark task as completed', async () => {
      const userId = 'user123';
      const taskId = 'task123';

      prisma.task.findUnique.mockResolvedValue({
        id: taskId,
        userId,
      });
      prisma.task.update.mockResolvedValue({
        id: taskId,
        status: 'COMPLETED',
      });

      const result = await service.completeTask(userId, taskId);

      expect(result).toHaveProperty('status', 'COMPLETED');
    });
  });

  describe('remove', () => {
    it('should delete a task', async () => {
      const userId = 'user123';
      const taskId = 'task123';

      prisma.task.findUnique.mockResolvedValue({
        id: taskId,
        userId,
      });
      prisma.task.delete.mockResolvedValue({});

      const result = await service.remove(userId, taskId);

      expect(result).toEqual({ success: true });
      expect(prisma.task.delete).toHaveBeenCalledWith({
        where: { id: taskId },
      });
    });
  });

  describe('getTaskStats', () => {
    it('should return task statistics', async () => {
      const userId = 'user123';

      prisma.task.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(5) // completed
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(2); // overdue

      const result = await service.getTaskStats(userId);

      expect(result).toEqual({
        total: 10,
        completed: 5,
        pending: 5,
        overdue: 2,
        completionRate: 50,
      });
    });
  });

  describe('suggestTasks', () => {
    it('should suggest tasks from memories', async () => {
      const userId = 'user123';
      const memories = [
        { id: 'mem1', content: 'I need to buy groceries' },
        { id: 'mem2', content: 'Meeting tomorrow' },
      ];

      prisma.memory.findMany.mockResolvedValue(memories);
      ai.extractTask.mockResolvedValueOnce({ title: 'Buy groceries' }).mockResolvedValueOnce(null);

      const result = await service.suggestTasks(userId);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('memoryId', 'mem1');
      expect(result[0]).toHaveProperty('suggestedTask');
    });
  });
});
