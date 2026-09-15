import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { RateLimitGuard, RateLimit, RATE_LIMIT_KEY } from './rate-limit.guard';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from '../../security/rate-limit.service';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: any;
  let rateLimitService: any;

  beforeEach(async () => {
    reflector = {
      get: jest.fn(),
    };

    rateLimitService = {
      checkLimit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        { provide: Reflector, useValue: reflector },
        { provide: RateLimitService, useValue: rateLimitService },
      ],
    }).compile();

    guard = module.get<RateLimitGuard>(RateLimitGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow request when no rate limit configured', async () => {
      reflector.get.mockReturnValue(undefined);

      const context = {
        getHandler: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({ user: { id: 'user123' }, ip: '127.0.0.1' }),
        }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow request within limit', async () => {
      reflector.get.mockReturnValue({ limit: 100, ttl: 60000 });
      rateLimitService.checkLimit.mockResolvedValue(true);

      const context = {
        getHandler: jest.fn().mockReturnValue({ name: 'testHandler' }),
        switchToHttp: () => ({
          getRequest: () => ({ user: { id: 'user123' }, ip: '127.0.0.1' }),
        }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should reject request when limit exceeded', async () => {
      reflector.get.mockReturnValue({ limit: 100, ttl: 60000 });
      rateLimitService.checkLimit.mockResolvedValue(false);

      const context = {
        getHandler: jest.fn().mockReturnValue({ name: 'testHandler' }),
        switchToHttp: () => ({
          getRequest: () => ({ user: { id: 'user123' }, ip: '127.0.0.1' }),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(context)).rejects.toThrow();
    });
  });

  describe('RateLimit decorator (real Reflector, no mocking)', () => {
    // Regression test: @RateLimit used to call Reflect.defineMetadata on a
    // throwaway object instead of returning a decorator, so it silently
    // attached metadata to nothing. This exercises the real decorator +
    // real Reflector together, which the mocked tests above cannot catch.
    it('should attach retrievable metadata to the decorated method', () => {
      class TestController {
        @RateLimit(5, 60000)
        handler() {}
      }

      const realReflector = new Reflector();
      const metadata = realReflector.get(RATE_LIMIT_KEY, TestController.prototype.handler);

      expect(metadata).toEqual({ limit: 5, ttl: 60000 });
    });
  });
});
