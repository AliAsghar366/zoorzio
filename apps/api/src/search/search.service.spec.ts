import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { PrismaService } from '../prisma/prisma.service';
import { VectorSearchService } from './vector-search.service';
import { TextSearchService } from './text-search.service';
import { AIService } from '../ai/ai.service';

describe('SearchService', () => {
  let service: SearchService;
  let prisma: any;
  let vectorSearch: any;
  let textSearch: any;
  let aiService: any;

  beforeEach(async () => {
    prisma = {
      memory: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    vectorSearch = {
      search: jest.fn(),
      index: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    textSearch = {
      search: jest.fn(),
      index: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    aiService = {
      generateEmbedding: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: prisma },
        { provide: VectorSearchService, useValue: vectorSearch },
        { provide: TextSearchService, useValue: textSearch },
        { provide: AIService, useValue: aiService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    it('should search memories', async () => {
      const userId = 'user123';
      const query = 'test search';
      const limit = 10;

      aiService.generateEmbedding.mockResolvedValue(new Array(1536).fill(0));
      vectorSearch.search.mockResolvedValue([{ id: 'mem1', score: 0.9 }]);
      textSearch.search.mockResolvedValue([{ id: 'mem1', score: 0.8 }]);

      const result = await service.search(userId, query, limit);

      expect(result).toBeDefined();
      expect(aiService.generateEmbedding).toHaveBeenCalledWith(query);
      expect(vectorSearch.search).toHaveBeenCalled();
      expect(textSearch.search).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      const userId = 'user123';
      const query = 'nonexistent';

      aiService.generateEmbedding.mockResolvedValue(new Array(1536).fill(0));
      vectorSearch.search.mockResolvedValue([]);
      textSearch.search.mockResolvedValue([]);

      const result = await service.search(userId, query);

      expect(result).toEqual([]);
    });
  });

  describe('indexMemory', () => {
    it('should index memory', async () => {
      const memory = {
        id: 'mem1',
        content: 'Test content',
      };

      vectorSearch.index.mockResolvedValue(undefined);
      textSearch.index.mockResolvedValue(undefined);

      await service.indexMemory(memory);

      expect(vectorSearch.index).toHaveBeenCalledWith(memory);
      expect(textSearch.index).toHaveBeenCalledWith(memory);
    });
  });

  describe('updateMemory', () => {
    it('should update memory index', async () => {
      const memory = {
        id: 'mem1',
        content: 'Updated content',
      };

      vectorSearch.update.mockResolvedValue(undefined);
      textSearch.update.mockResolvedValue(undefined);

      await service.updateMemory(memory);

      expect(vectorSearch.update).toHaveBeenCalledWith(memory);
      expect(textSearch.update).toHaveBeenCalledWith(memory);
    });
  });

  describe('removeMemory', () => {
    it('should remove memory from index', async () => {
      const memoryId = 'mem1';

      vectorSearch.remove.mockResolvedValue(undefined);
      textSearch.remove.mockResolvedValue(undefined);

      await service.removeMemory(memoryId);

      expect(vectorSearch.remove).toHaveBeenCalledWith(memoryId);
      expect(textSearch.remove).toHaveBeenCalledWith(memoryId);
    });
  });
});
