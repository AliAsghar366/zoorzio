import { Test, TestingModule } from '@nestjs/testing';
import { VectorSearchService } from './vector-search.service';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';

describe('VectorSearchService', () => {
  let service: VectorSearchService;
  let prisma: any;
  let aiService: any;

  beforeEach(async () => {
    prisma = {
      memory: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    aiService = {
      generateEmbedding: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VectorSearchService,
        { provide: PrismaService, useValue: prisma },
        { provide: AIService, useValue: aiService },
      ],
    }).compile();

    service = module.get<VectorSearchService>(VectorSearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    it('should rank candidates by cosine similarity to the query embedding', async () => {
      prisma.memory.findMany.mockResolvedValue([
        {
          id: 'mem1',
          content: 'A',
          summary: null,
          type: 'NOTE',
          source: 'WEB',
          tags: [],
          embedding: [1, 0],
        },
        {
          id: 'mem2',
          content: 'B',
          summary: null,
          type: 'NOTE',
          source: 'WEB',
          tags: [],
          embedding: [0, 1],
        },
      ]);

      const result = await service.search('user123', [1, 0], 10);

      expect(result[0].id).toBe('mem1');
      expect(result[0].similarity).toBeCloseTo(1);
      expect(result[1].id).toBe('mem2');
      expect(result[1].similarity).toBeCloseTo(0);
      expect(result[0]).not.toHaveProperty('embedding');
    });

    it('should return an empty array on failure instead of throwing', async () => {
      prisma.memory.findMany.mockRejectedValue(new Error('db down'));

      const result = await service.search('user123', [0.1], 10);

      expect(result).toEqual([]);
    });
  });

  describe('index', () => {
    it('should write the embedding via the normal Prisma client', async () => {
      const memory = { id: 'mem1', embedding: [0.1, 0.2, 0.3] };

      await service.index(memory);

      expect(prisma.memory.update).toHaveBeenCalledWith({
        where: { id: 'mem1' },
        data: { embedding: [0.1, 0.2, 0.3] },
      });
    });

    it('should skip indexing if no embedding', async () => {
      await service.index({ id: 'mem1' });

      expect(prisma.memory.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should clear the embedding column', async () => {
      await service.remove('mem1');

      expect(prisma.memory.update).toHaveBeenCalledWith({
        where: { id: 'mem1' },
        data: { embedding: [] },
      });
    });
  });

  describe('rebuildIndex', () => {
    it('should generate and persist embeddings for memories missing one', async () => {
      prisma.memory.findMany.mockResolvedValue([{ id: 'mem1', content: 'hello' }]);
      aiService.generateEmbedding.mockResolvedValue([0.5]);

      await service.rebuildIndex('user123');

      expect(aiService.generateEmbedding).toHaveBeenCalledWith('hello');
      expect(prisma.memory.update).toHaveBeenCalledWith({
        where: { id: 'mem1' },
        data: { embedding: [0.5] },
      });
    });
  });
});
