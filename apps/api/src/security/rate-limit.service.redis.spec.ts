import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RateLimitService } from './rate-limit.service';

const mockRedisInstance = {
  incr: jest.fn(),
  hset: jest.fn(),
  pexpire: jest.fn(),
  get: jest.fn(),
  hgetall: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
};

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockRedisInstance),
  };
});

describe('RateLimitService (Redis-backed)', () => {
  let service: RateLimitService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'REDIS_URL' ? 'redis://127.0.0.1:6390' : undefined,
            ),
          },
        },
      ],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
  });

  it('should register an error listener so a connection failure cannot crash the process', () => {
    expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  describe('checkLimit', () => {
    it('should allow the first request and set metadata on the initial increment', async () => {
      mockRedisInstance.incr.mockResolvedValue(1);
      mockRedisInstance.hset.mockResolvedValue('OK');
      mockRedisInstance.pexpire.mockResolvedValue(1);

      const result = await service.checkLimit('user1:login', 5, 60000);

      expect(result).toBe(true);
      expect(mockRedisInstance.hset).toHaveBeenCalledWith(
        expect.stringContaining(':meta'),
        'limit',
        5,
        'resetTime',
        expect.any(Number),
      );
    });

    it('should reject once the Redis counter exceeds the limit', async () => {
      mockRedisInstance.incr.mockResolvedValue(6);

      const result = await service.checkLimit('user1:login', 5, 60000);

      expect(result).toBe(false);
    });

    it('should fall back to the in-memory store when Redis throws', async () => {
      mockRedisInstance.incr.mockRejectedValue(new Error('connection refused'));

      const result = await service.checkLimit('user1:login', 5, 60000);

      // In-memory fallback treats this as a fresh key -> allowed.
      expect(result).toBe(true);
    });
  });

  describe('getInfo', () => {
    it('should read remaining/resetTime from the Redis hash', async () => {
      mockRedisInstance.get.mockResolvedValue('3');
      mockRedisInstance.hgetall.mockResolvedValue({ limit: '5', resetTime: '1234567890' });

      const result = await service.getInfo('user1:login');

      expect(result).toEqual({ remaining: 2, resetTime: 1234567890 });
    });

    it('should return null when Redis has no record for the key', async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      mockRedisInstance.hgetall.mockResolvedValue({});

      const result = await service.getInfo('unknown-key');

      expect(result).toBeNull();
    });
  });

  describe('reset', () => {
    it('should delete both the counter and metadata keys in Redis', async () => {
      mockRedisInstance.del.mockResolvedValue(2);

      await service.reset('user1:login');

      expect(mockRedisInstance.del).toHaveBeenCalledWith(
        expect.stringContaining('user1:login'),
        expect.stringContaining('user1:login:meta'),
      );
    });
  });
});
