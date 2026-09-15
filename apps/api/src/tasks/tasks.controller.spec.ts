import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskPriority, TaskStatus } from '@anchor/database';

describe('TasksController', () => {
  let controller: TasksController;
  let tasksService: any;

  beforeEach(async () => {
    tasksService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      completeTask: jest.fn(),
      getTasksDueToday: jest.fn(),
      getOverdueTasks: jest.fn(),
      getTaskStats: jest.fn(),
      suggestTasks: jest.fn(),
      addReminder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: tasksService }],
    }).compile();

    controller = module.get<TasksController>(TasksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a task', async () => {
      const req = { user: { id: 'user123' } };
      const createDto = {
        title: 'Buy groceries',
        description: 'Milk, eggs, bread',
        priority: TaskPriority.MEDIUM,
      };

      const expectedTask = {
        id: 'task123',
        ...createDto,
        userId: 'user123',
      };

      tasksService.create.mockResolvedValue(expectedTask);

      const result = await controller.create(req, createDto);

      expect(result).toEqual(expectedTask);
      expect(tasksService.create).toHaveBeenCalledWith('user123', createDto);
    });
  });

  describe('findAll', () => {
    it('should return all tasks', async () => {
      const req = { user: { id: 'user123' } };
      const status = 'PENDING';
      const limit = 50;

      const expectedTasks = [
        { id: 'task1', title: 'Task 1', status: 'PENDING' },
        { id: 'task2', title: 'Task 2', status: 'PENDING' },
      ];

      tasksService.findAll.mockResolvedValue(expectedTasks);

      const result = await controller.findAll(req, status, limit);

      expect(result).toEqual(expectedTasks);
      expect(tasksService.findAll).toHaveBeenCalledWith('user123', status, limit, undefined);
    });

    it('passes boardId through when filtering by board', async () => {
      const req = { user: { id: 'user123' } };
      tasksService.findAll.mockResolvedValue([]);

      await controller.findAll(req, undefined, undefined, 'board-42');

      expect(tasksService.findAll).toHaveBeenCalledWith('user123', undefined, 50, 'board-42');
    });
  });

  describe('findOne', () => {
    it('should return a task by id', async () => {
      const req = { user: { id: 'user123' } };
      const id = 'task123';

      const expectedTask = {
        id,
        title: 'Test task',
      };

      tasksService.findOne.mockResolvedValue(expectedTask);

      const result = await controller.findOne(req, id);

      expect(result).toEqual(expectedTask);
      expect(tasksService.findOne).toHaveBeenCalledWith('user123', id);
    });
  });

  describe('update', () => {
    it('should update a task', async () => {
      const req = { user: { id: 'user123' } };
      const id = 'task123';
      const updateDto = {
        title: 'Updated task',
        status: TaskStatus.COMPLETED,
      };

      const expectedTask = {
        id,
        ...updateDto,
      };

      tasksService.update.mockResolvedValue(expectedTask);

      const result = await controller.update(req, id, updateDto);

      expect(result).toEqual(expectedTask);
      expect(tasksService.update).toHaveBeenCalledWith('user123', id, updateDto);
    });
  });

  describe('complete', () => {
    it('should complete a task', async () => {
      const req = { user: { id: 'user123' } };
      const id = 'task123';

      const expectedTask = {
        id,
        status: 'COMPLETED',
      };

      tasksService.completeTask.mockResolvedValue(expectedTask);

      const result = await controller.complete(req, id);

      expect(result).toEqual(expectedTask);
      expect(tasksService.completeTask).toHaveBeenCalledWith('user123', id);
    });
  });

  describe('remove', () => {
    it('should remove a task', async () => {
      const req = { user: { id: 'user123' } };
      const id = 'task123';

      const expectedResponse = { success: true };

      tasksService.remove.mockResolvedValue(expectedResponse);

      const result = await controller.remove(req, id);

      expect(result).toEqual(expectedResponse);
      expect(tasksService.remove).toHaveBeenCalledWith('user123', id);
    });
  });

  describe('getStats', () => {
    it('should return task statistics', async () => {
      const req = { user: { id: 'user123' } };

      const expectedStats = {
        total: 50,
        completed: 30,
        pending: 15,
        overdue: 5,
        completionRate: 60,
      };

      tasksService.getTaskStats.mockResolvedValue(expectedStats);

      const result = await controller.getStats(req);

      expect(result).toEqual(expectedStats);
      expect(tasksService.getTaskStats).toHaveBeenCalledWith('user123');
    });
  });

  describe('getSuggestions', () => {
    it('should return task suggestions', async () => {
      const req = { user: { id: 'user123' } };

      const expectedSuggestions = [
        {
          memoryId: 'mem1',
          memoryContent: 'I need to buy groceries',
          suggestedTask: { title: 'Buy groceries' },
        },
      ];

      tasksService.suggestTasks.mockResolvedValue(expectedSuggestions);

      const result = await controller.getSuggestions(req);

      expect(result).toEqual(expectedSuggestions);
      expect(tasksService.suggestTasks).toHaveBeenCalledWith('user123');
    });
  });
});
