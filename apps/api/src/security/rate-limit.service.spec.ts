import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitService } from './rate-limit.service';
import { ConfigService } from '@nestjs/config';

describe('RateLimitService', () => {
  let service: RateLimitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
  });

  afterEach(() => {
    service.resetAll();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkLimit', () => {
    it('should allow request within limit', async () => {
      const result = await service.checkLimit('test-key', 10, 60000);
      expect(result).toBe(true);
    });

    it('should allow multiple requests within limit', async () => {
      for (let i = 0; i < 5; i++) {
        const result = await service.checkLimit('test-key', 10, 60000);
        expect(result).toBe(true);
      }
    });

    it('should reject request when limit exceeded', async () => {
      // Exhaust the limit
      for (let i = 0; i < 10; i++) {
        await service.checkLimit('test-key', 10, 60000);
      }

      // Next request should be rejected
      const result = await service.checkLimit('test-key', 10, 60000);
      expect(result).toBe(false);
    });

    it('should allow requests for different keys', async () => {
      for (let i = 0; i < 5; i++) {
        await service.checkLimit('key-1', 10, 60000);
      }

      // Different key should still be allowed
      const result = await service.checkLimit('key-2', 10, 60000);
      expect(result).toBe(true);
    });
  });

  describe('getInfo', () => {
    it('should return null for non-existent key', async () => {
      const result = await service.getInfo('non-existent-key');
      expect(result).toBeNull();
    });

    it('should return info after request', async () => {
      await service.checkLimit('test-key', 10, 60000);
      const result = await service.getInfo('test-key');

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('resetTime');
    });
  });

  describe('reset', () => {
    it('should reset rate limit for key', async () => {
      // Exhaust the limit
      for (let i = 0; i < 10; i++) {
        await service.checkLimit('test-key', 10, 60000);
      }

      // Verify limit is exceeded
      let result = await service.checkLimit('test-key', 10, 60000);
      expect(result).toBe(false);

      // Reset
      await service.reset('test-key');

      // Should allow request again
      result = await service.checkLimit('test-key', 10, 60000);
      expect(result).toBe(true);
    });
  });

  describe('resetAll', () => {
    it('should reset all rate limits', async () => {
      // Exhaust limits for multiple keys
      for (let i = 0; i < 10; i++) {
        await service.checkLimit('key-1', 10, 60000);
        await service.checkLimit('key-2', 10, 60000);
      }

      // Verify limits are exceeded
      let result1 = await service.checkLimit('key-1', 10, 60000);
      let result2 = await service.checkLimit('key-2', 10, 60000);
      expect(result1).toBe(false);
      expect(result2).toBe(false);

      // Reset all
      await service.resetAll();

      // Should allow requests again
      result1 = await service.checkLimit('key-1', 10, 60000);
      result2 = await service.checkLimit('key-2', 10, 60000);
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });
  });

  describe('checkLoginLimit', () => {
    it('should allow login within limit', async () => {
      const result = await service.checkLoginLimit('127.0.0.1');
      expect(result).toBe(true);
    });

    it('should reject login when limit exceeded', async () => {
      for (let i = 0; i < 5; i++) {
        await service.checkLoginLimit('127.0.0.1');
      }

      const result = await service.checkLoginLimit('127.0.0.1');
      expect(result).toBe(false);
    });
  });

  describe('checkApiLimit', () => {
    it('should allow API request within limit', async () => {
      const result = await service.checkApiLimit('api-key-123');
      expect(result).toBe(true);
    });
  });

  describe('checkMemoryLimit', () => {
    it('should allow memory operation within limit', async () => {
      const result = await service.checkMemoryLimit('user123');
      expect(result).toBe(true);
    });
  });

  describe('checkSearchLimit', () => {
    it('should allow search within limit', async () => {
      const result = await service.checkSearchLimit('user123');
      expect(result).toBe(true);
    });
  });
});
