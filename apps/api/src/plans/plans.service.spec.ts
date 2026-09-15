import { Test, TestingModule } from '@nestjs/testing';
import { PlansService } from './plans.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PlansService', () => {
  let service: PlansService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { plan: { findMany: jest.fn(), findUnique: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PlansService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PlansService>(PlansService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return only active plans ordered by price', async () => {
      prisma.plan.findMany.mockResolvedValue([{ id: 'p1', priceCents: 999 }]);

      const result = await service.findAll();

      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { priceCents: 'asc' },
      });
      expect(result).toEqual([{ id: 'p1', priceCents: 999 }]);
    });
  });

  describe('findBySlug', () => {
    it('should look up a plan by its slug', async () => {
      prisma.plan.findUnique.mockResolvedValue({ id: 'p1', slug: 'pro' });

      const result = await service.findBySlug('pro');

      expect(prisma.plan.findUnique).toHaveBeenCalledWith({ where: { slug: 'pro' } });
      expect(result).toEqual({ id: 'p1', slug: 'pro' });
    });
  });
});
