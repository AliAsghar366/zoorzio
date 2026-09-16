import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('check', () => {
    it('should return healthy status', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.check();

      expect(result).toHaveProperty('status', 'healthy');
      expect(result).toHaveProperty('service', 'anchor-api');
      expect(result).toHaveProperty('version', '1.0.0');
    });

    it('should return unhealthy status on error', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('Database connection failed'));

      const result = await service.check();

      expect(result).toHaveProperty('status', 'unhealthy');
      expect(result).toHaveProperty('error');
    });
  });

  describe('detailedCheck', () => {
    it('should return detailed health status', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.detailedCheck();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('checks');
      expect(result.checks).toHaveProperty('database', true);
      expect(result.checks).toHaveProperty('memory');
      expect(result.checks).toHaveProperty('uptime');
    });
  });
});
