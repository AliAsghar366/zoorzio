import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';

describe('BillingService', () => {
  let prisma: any;
  let config: any;

  beforeEach(() => {
    prisma = {
      plan: { findUnique: jest.fn() },
      user: { findUniqueOrThrow: jest.fn() },
      subscription: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    config = { get: jest.fn() };
  });

  async function buildService() {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: PlansService, useValue: {} },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    return module.get<BillingService>(BillingService);
  }

  describe('without a Stripe key configured (demo mode)', () => {
    it('reports isLive as false', async () => {
      config.get.mockReturnValue(undefined);
      const service = await buildService();

      expect(service.isLive).toBe(false);
    });

    it('activates the subscription immediately instead of creating a Checkout Session', async () => {
      config.get.mockReturnValue(undefined);
      const service = await buildService();

      prisma.plan.findUnique.mockResolvedValue({ id: 'plan1', slug: 'pro', isActive: true });
      prisma.subscription.upsert.mockResolvedValue({
        id: 'sub1',
        userId: 'user1',
        planId: 'plan1',
        status: 'ACTIVE',
      });

      const result = await service.checkout('user1', 'plan1');

      expect(result.mode).toBe('demo');
      expect(prisma.subscription.upsert).toHaveBeenCalledWith({
        where: { userId: 'user1' },
        update: { planId: 'plan1', status: 'ACTIVE' },
        create: { userId: 'user1', planId: 'plan1', status: 'ACTIVE' },
        include: { plan: true },
      });
    });

    it('throws NotFoundException for a missing or inactive plan', async () => {
      config.get.mockReturnValue(undefined);
      const service = await buildService();
      prisma.plan.findUnique.mockResolvedValue(null);

      await expect(service.checkout('user1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSubscription', () => {
    it('returns the subscription with its plan included', async () => {
      config.get.mockReturnValue(undefined);
      const service = await buildService();
      prisma.subscription.findUnique.mockResolvedValue({ id: 'sub1', plan: { slug: 'pro' } });

      const result = await service.getSubscription('user1');

      expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user1' },
        include: { plan: true },
      });
      expect(result).toEqual({ id: 'sub1', plan: { slug: 'pro' } });
    });
  });

  describe('handleWebhook', () => {
    it('is a no-op until Stripe is configured', async () => {
      config.get.mockReturnValue(undefined);
      const service = await buildService();

      const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(result).toEqual({ received: true });
    });
  });
});
