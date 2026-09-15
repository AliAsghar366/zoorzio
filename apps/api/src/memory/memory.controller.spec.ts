import { Test, TestingModule } from '@nestjs/testing';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { MemoryType, ChannelType } from '@anchor/database';

describe('MemoryController', () => {
  let controller: MemoryController;
  let memoryService: any;

  beforeEach(async () => {
    memoryService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      search: jest.fn(),
      getRecentMemories: jest.fn(),
      getFrequentlyAccessed: jest.fn(),
      getMemoryStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MemoryController],
      providers: [{ provide: MemoryService, useValue: memoryService }],
    }).compile();

    controller = module.get<MemoryController>(MemoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a memory', async () => {
      const req = { user: { id: 'user123' } };
      const createDto = {
        content: 'Test memory',
        type: MemoryType.NOTE,
        source: ChannelType.NATIVE_APP,
      };

      const expectedMemory = {
        id: 'mem123',
        ...createDto,
        userId: 'user123',
      };

      memoryService.create.mockResolvedValue(expectedMemory);

      const result = await controller.create(req, createDto);

      expect(result).toEqual(expectedMemory);
      expect(memoryService.create).toHaveBeenCalledWith('user123', createDto);
    });
  });

  describe('findAll', () => {
    it('should return all memories', async () => {
      const req = { user: { id: 'user123' } };
      const query = { type: MemoryType.NOTE, limit: 10, offset: 0 };

      const expectedMemories = [
        { id: 'mem1', content: 'Memory 1' },
        { id: 'mem2', content: 'Memory 2' },
      ];

      memoryService.findAll.mockResolvedValue(expectedMemories);

      const result = await controller.findAll(req, query);

      expect(result).toEqual(expectedMemories);
      expect(memoryService.findAll).toHaveBeenCalledWith('user123', query);
    });
  });

  describe('search', () => {
    it('should search memories', async () => {
      const req = { user: { id: 'user123' } };
      const query = 'test search';
      const limit = 10;

      const expectedResults = [{ id: 'mem1', content: 'Test memory', score: 0.9 }];

      memoryService.search.mockResolvedValue(expectedResults);

      const result = await controller.search(req, query, limit);

      expect(result).toEqual(expectedResults);
      expect(memoryService.search).toHaveBeenCalledWith('user123', query, limit);
    });
  });

  describe('findOne', () => {
    it('should return a memory by id', async () => {
      const req = { user: { id: 'user123' } };
      const id = 'mem123';

      const expectedMemory = {
        id,
        content: 'Test memory',
      };

      memoryService.findOne.mockResolvedValue(expectedMemory);

      const result = await controller.findOne(req, id);

      expect(result).toEqual(expectedMemory);
      expect(memoryService.findOne).toHaveBeenCalledWith('user123', id);
    });
  });

  describe('update', () => {
    it('should update a memory', async () => {
      const req = { user: { id: 'user123' } };
      const id = 'mem123';
      const updateDto = {
        content: 'Updated memory',
      };

      const expectedMemory = {
        id,
        ...updateDto,
      };

      memoryService.update.mockResolvedValue(expectedMemory);

      const result = await controller.update(req, id, updateDto);

      expect(result).toEqual(expectedMemory);
      expect(memoryService.update).toHaveBeenCalledWith('user123', id, updateDto);
    });
  });

  describe('remove', () => {
    it('should remove a memory', async () => {
      const req = { user: { id: 'user123' } };
      const id = 'mem123';

      const expectedResponse = { success: true };

      memoryService.remove.mockResolvedValue(expectedResponse);

      const result = await controller.remove(req, id);

      expect(result).toEqual(expectedResponse);
      expect(memoryService.remove).toHaveBeenCalledWith('user123', id);
    });
  });

  describe('getStats', () => {
    it('should return memory statistics', async () => {
      const req = { user: { id: 'user123' } };

      const expectedStats = {
        total: 100,
        byType: { NOTE: 50, TASK: 30 },
        bySource: { WHATSAPP: 60, EMAIL: 40 },
      };

      memoryService.getMemoryStats.mockResolvedValue(expectedStats);

      const result = await controller.getStats(req);

      expect(result).toEqual(expectedStats);
      expect(memoryService.getMemoryStats).toHaveBeenCalledWith('user123');
    });
  });
});
