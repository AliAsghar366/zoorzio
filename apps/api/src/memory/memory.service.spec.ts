import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';
import { SearchService } from '../search/search.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { MemoryType, ChannelType } from '@anchor/database';

describe('MemoryService', () => {
  let service: MemoryService;
  let prisma: any;
  let ai: any;
  let search: any;
  let planLimits: any;

  beforeEach(async () => {
    prisma = {
      memory: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      knowledgeItem: {
        create: jest.fn().mockResolvedValue({ id: 'ki123' }),
      },
      task: {
        create: jest.fn(),
      },
      reminder: {
        create: jest.fn(),
      },
      $executeRaw: jest.fn().mockResolvedValue(undefined),
    };

    ai = {
      generateSummary: jest.fn().mockResolvedValue('Test summary'),
      generateEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0)),
      extractTask: jest.fn().mockResolvedValue(null),
      transcribeAudio: jest.fn().mockResolvedValue('Transcribed voice note'),
    };

    search = {
      indexMemory: jest.fn(),
      updateMemory: jest.fn(),
      removeMemory: jest.fn(),
      search: jest.fn(),
    };

    planLimits = { assertCanCreate: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: AIService, useValue: ai },
        { provide: SearchService, useValue: search },
        { provide: PlanLimitsService, useValue: planLimits },
      ],
    }).compile();

    service = module.get<MemoryService>(MemoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createFromVoice', () => {
    it('should transcribe the audio and create a VOICE_NOTE memory from it', async () => {
      const userId = 'user123';
      prisma.memory.create.mockResolvedValue({ id: 'mem1', content: 'Transcribed voice note' });

      const result = await service.createFromVoice(
        userId,
        Buffer.from('fake-audio').toString('base64'),
      );

      expect(ai.transcribeAudio).toHaveBeenCalledWith(Buffer.from('fake-audio'));
      expect(prisma.memory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          content: 'Transcribed voice note',
          type: MemoryType.VOICE_NOTE,
          source: ChannelType.NATIVE_APP,
        }),
      });
      expect(result).toEqual({ id: 'mem1', content: 'Transcribed voice note' });
    });
  });

  describe('create', () => {
    it('should create a memory', async () => {
      const userId = 'user123';
      const createDto = {
        content: 'Test memory content',
        type: MemoryType.NOTE,
        source: ChannelType.NATIVE_APP,
      };

      const expectedMemory = {
        id: 'mem123',
        userId,
        ...createDto,
        summary: 'Test summary',
        embedding: new Array(1536).fill(0),
        tags: [],
      };

      prisma.memory.create.mockResolvedValue(expectedMemory);

      const result = await service.create(userId, createDto);

      expect(result).toEqual(expectedMemory);
      expect(prisma.memory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          content: createDto.content,
          type: createDto.type,
          source: createDto.source,
        }),
      });
      expect(ai.generateSummary).toHaveBeenCalledWith(createDto.content);
      expect(ai.generateEmbedding).toHaveBeenCalledWith(createDto.content);
      expect(search.indexMemory).toHaveBeenCalled();
      expect(prisma.knowledgeItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          embedding: new Array(1536).fill(0),
        }),
      });
    });

    it('should check the plan limit before creating', async () => {
      prisma.memory.create.mockResolvedValue({ id: 'mem123', content: 'Test memory content' });

      await service.create('user123', {
        content: 'Test memory content',
        type: MemoryType.NOTE,
        source: ChannelType.NATIVE_APP,
      });

      expect(planLimits.assertCanCreate).toHaveBeenCalledWith('user123', 'memories');
    });

    it('should propagate ForbiddenException when the plan limit is reached without calling the AI service', async () => {
      planLimits.assertCanCreate.mockRejectedValue(new ForbiddenException('limit reached'));

      await expect(
        service.create('user123', {
          content: 'x',
          type: MemoryType.NOTE,
          source: ChannelType.NATIVE_APP,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(ai.generateSummary).not.toHaveBeenCalled();
      expect(prisma.memory.create).not.toHaveBeenCalled();
    });

    it('should auto-generate tasks when content suggests action items', async () => {
      const userId = 'user123';
      const createDto = {
        content: 'I need to buy groceries tomorrow',
        type: MemoryType.MESSAGE,
        source: ChannelType.WHATSAPP,
      };

      const expectedMemory = {
        id: 'mem123',
        userId,
        ...createDto,
      };

      prisma.memory.create.mockResolvedValue(expectedMemory);
      ai.extractTask.mockResolvedValue({
        title: 'Buy groceries',
        dueDate: '2024-01-02',
      });

      await service.create(userId, createDto);

      expect(ai.extractTask).toHaveBeenCalledWith(createDto.content);
      expect(prisma.task.create).toHaveBeenCalled();
    });

    it('should create a Reminder instead of a Task when the message says "remind" and a due date is found', async () => {
      const userId = 'user123';
      const createDto = {
        content: 'Remind me to call mom tomorrow at 5pm',
        type: MemoryType.MESSAGE,
        source: ChannelType.WHATSAPP,
      };

      prisma.memory.create.mockResolvedValue({ id: 'mem123', userId, ...createDto });
      ai.extractTask.mockResolvedValue({
        title: 'Call mom',
        description: null,
        dueDate: '2024-01-02T17:00:00.000Z',
        priority: 'MEDIUM',
      });

      await service.create(userId, createDto);

      expect(prisma.reminder.create).toHaveBeenCalledWith({
        data: {
          userId,
          memoryId: 'mem123',
          title: 'Call mom',
          message: undefined,
          scheduledAt: new Date('2024-01-02T17:00:00.000Z'),
        },
      });
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it('should fall back to a Task when "remind" is mentioned but no due date could be extracted', async () => {
      const userId = 'user123';
      const createDto = {
        content: 'remind me about the project sometime',
        type: MemoryType.MESSAGE,
        source: ChannelType.WHATSAPP,
      };

      prisma.memory.create.mockResolvedValue({ id: 'mem123', userId, ...createDto });
      ai.extractTask.mockResolvedValue({
        title: 'Project follow-up',
        description: null,
        dueDate: null,
        priority: 'MEDIUM',
      });

      await service.create(userId, createDto);

      expect(prisma.reminder.create).not.toHaveBeenCalled();
      expect(prisma.task.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return memories for a user', async () => {
      const userId = 'user123';
      const expectedMemories = [
        { id: 'mem1', userId, content: 'Memory 1' },
        { id: 'mem2', userId, content: 'Memory 2' },
      ];

      prisma.memory.findMany.mockResolvedValue(expectedMemories);

      const result = await service.findAll(userId, {});

      expect(result).toEqual(expectedMemories);
      expect(prisma.memory.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          isArchived: false,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('should filter by type', async () => {
      const userId = 'user123';
      const query = { type: MemoryType.TASK };

      prisma.memory.findMany.mockResolvedValue([]);

      await service.findAll(userId, query);

      expect(prisma.memory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'TASK',
          }),
        }),
      );
    });

    it('should filter to the cleanup queue when isVerified=false', async () => {
      prisma.memory.findMany.mockResolvedValue([]);

      await service.findAll('user123', { isVerified: 'false' } as any);

      expect(prisma.memory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isVerified: false }) }),
      );
    });

    it('should filter to kept memories when isVerified=true', async () => {
      prisma.memory.findMany.mockResolvedValue([]);

      await service.findAll('user123', { isVerified: 'true' } as any);

      expect(prisma.memory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isVerified: true }) }),
      );
    });

    it('should not filter by isVerified when omitted', async () => {
      prisma.memory.findMany.mockResolvedValue([]);

      await service.findAll('user123', {});

      const call = prisma.memory.findMany.mock.calls[0][0];
      expect(call.where.isVerified).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('should return a memory by id', async () => {
      const userId = 'user123';
      const memoryId = 'mem123';
      const expectedMemory = {
        id: memoryId,
        userId,
        content: 'Test memory',
      };

      prisma.memory.findUnique.mockResolvedValue(expectedMemory);
      prisma.memory.update.mockResolvedValue(expectedMemory);

      const result = await service.findOne(userId, memoryId);

      expect(result).toEqual(expectedMemory);
    });

    it('should throw if memory not found', async () => {
      prisma.memory.findUnique.mockResolvedValue(null);

      await expect(service.findOne('user123', 'mem123')).rejects.toThrow('Memory not found');
    });

    it('should throw if user is not authorized', async () => {
      prisma.memory.findUnique.mockResolvedValue({
        id: 'mem123',
        userId: 'other-user',
      });

      await expect(service.findOne('user123', 'mem123')).rejects.toThrow('Access denied');
    });
  });

  describe('update', () => {
    it('should persist isVerified without touching the embedding', async () => {
      prisma.memory.findUnique.mockResolvedValue({
        id: 'mem1',
        userId: 'user123',
        content: 'Same content',
      });
      prisma.memory.update.mockResolvedValue({ id: 'mem1', isVerified: true });

      await service.update('user123', 'mem1', { isVerified: true });

      expect(prisma.memory.update).toHaveBeenCalledWith({
        where: { id: 'mem1' },
        data: expect.objectContaining({ isVerified: true }),
      });
      expect(ai.generateEmbedding).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the memory does not exist', async () => {
      prisma.memory.findUnique.mockResolvedValue(null);

      await expect(service.update('user123', 'missing', { isVerified: true })).rejects.toThrow(
        'Memory not found',
      );
    });

    it("should throw ForbiddenException for another user's memory", async () => {
      prisma.memory.findUnique.mockResolvedValue({
        id: 'mem1',
        userId: 'other-user',
        content: 'x',
      });

      await expect(service.update('user123', 'mem1', { isVerified: true })).rejects.toThrow(
        'Access denied',
      );
    });
  });

  describe('remove', () => {
    it('should archive a memory', async () => {
      const userId = 'user123';
      const memoryId = 'mem123';

      prisma.memory.findUnique.mockResolvedValue({
        id: memoryId,
        userId,
      });
      prisma.memory.update.mockResolvedValue({});

      const result = await service.remove(userId, memoryId);

      expect(result).toEqual({ success: true });
      expect(prisma.memory.update).toHaveBeenCalledWith({
        where: { id: memoryId },
        data: { isArchived: true },
      });
      expect(search.removeMemory).toHaveBeenCalledWith(memoryId);
    });
  });

  describe('search', () => {
    it('should search memories', async () => {
      const userId = 'user123';
      const query = 'test search';
      const expectedResults = [{ id: 'mem1', content: 'Test memory', score: 0.9 }];

      search.search.mockResolvedValue(expectedResults);

      const result = await service.search(userId, query);

      expect(result).toEqual(expectedResults);
      expect(search.search).toHaveBeenCalledWith(userId, query, 10);
    });
  });

  describe('getMemoryStats', () => {
    it('should return memory statistics', async () => {
      const userId = 'user123';

      prisma.memory.count.mockResolvedValue(10);
      prisma.memory.groupBy
        .mockResolvedValueOnce([{ type: 'NOTE', _count: 5 }])
        .mockResolvedValueOnce([{ source: 'WHATSAPP', _count: 3 }]);

      const result = await service.getMemoryStats(userId);

      expect(result).toEqual({
        total: 10,
        byType: { NOTE: 5 },
        bySource: { WHATSAPP: 3 },
      });
    });
  });
});
