import { Test, TestingModule } from '@nestjs/testing';
import { TextSearchService } from './text-search.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TextSearchService', () => {
  let service: TextSearchService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TextSearchService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<TextSearchService>(TextSearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    it('should search memories by full text', async () => {
      const userId = 'user123';
      const query = 'test query';
      const expectedResults = [{ id: 'mem1', content: 'Test content', rank: 0.9 }];

      prisma.$queryRaw.mockResolvedValue(expectedResults);

      const result = await service.search(userId, query, 10);

      expect(result).toEqual(expectedResults);
    });
  });

  describe('index', () => {
    it('should index memory for text search', async () => {
      const memory = {
        id: 'mem1',
        content: 'Test content',
        summary: 'Test summary',
      };

      prisma.$executeRaw.mockResolvedValue({});

      await service.index(memory);

      expect(prisma.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove memory from text index', async () => {
      prisma.$executeRaw.mockResolvedValue({});

      await service.remove('mem1');

      expect(prisma.$executeRaw).toHaveBeenCalled();
    });
  });
});
