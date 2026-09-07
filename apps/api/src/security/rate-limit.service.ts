import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface RateLimitEntry {
  count: number;
  limit: number;
  resetTime: number;
}

const REDIS_KEY_PREFIX = 'anchor:ratelimit:';

/**
 * Fixed-window rate limiting. Uses Redis (REDIS_URL) when configured, so
 * limits are shared correctly across multiple API instances behind a load
 * balancer - an in-memory Map (the original implementation) resets per
 * process and lets each instance grant its own separate quota, which
 * defeats rate limiting entirely once you scale past one instance. Falls
 * back to the in-memory store automatically if Redis is unset or a command
 * fails, so this never turns a transient Redis blip into an outage.
 */
@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private store: Map<string, RateLimitEntry> = new Map();
  private readonly cleanupInterval: ReturnType<typeof setInterval>;
  private readonly redis: Redis | null;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    this.redis = redisUrl ? this.createRedisClient(redisUrl) : null;

    // Clean up expired in-memory entries periodically (also serves as the
    // sole store when Redis isn't configured/reachable). unref() so this
    // timer alone doesn't keep the process (or a Jest worker) alive.
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000).unref();
  }

  private createRedisClient(redisUrl: string): Redis {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 200, 2000),
      lazyConnect: false,
    });
    // ioredis emits 'error' on every failed connection attempt; without a
    // listener this is an unhandled EventEmitter error that crashes the
    // process. Logging once per event is enough - actual command failures
    // are handled per-call by falling back to the in-memory store below.
    client.on('error', (error) => this.logger.warn(`Redis rate-limit store error: ${error.message}`));
    return client;
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
    this.redis?.disconnect();
  }

  async checkLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
    if (this.redis) {
      try {
        return await this.checkLimitRedis(key, limit, windowMs);
      } catch (error) {
        this.logger.warn(`Redis rate-limit check failed for "${key}", falling back to in-memory: ${error}`);
      }
    }
    return this.checkLimitInMemory(key, limit, windowMs);
  }

  private async checkLimitRedis(key: string, limit: number, windowMs: number): Promise<boolean> {
    const redisKey = REDIS_KEY_PREFIX + key;
    const count = await this.redis!.incr(redisKey);

    if (count === 1) {
      const resetTime = Date.now() + windowMs;
      await this.redis!.hset(redisKey + ':meta', 'limit', limit, 'resetTime', resetTime);
      await Promise.all([
        this.redis!.pexpire(redisKey, windowMs),
        this.redis!.pexpire(redisKey + ':meta', windowMs),
      ]);
    }

    if (count > limit) {
      this.logger.warn(`Rate limit exceeded for key: ${key}`);
      return false;
    }
    return true;
  }

  private checkLimitInMemory(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      this.store.set(key, { count: 1, limit, resetTime: now + windowMs });
      return true;
    }

    if (entry.count >= limit) {
      this.logger.warn(`Rate limit exceeded for key: ${key}`);
      return false;
    }

    entry.count++;
    return true;
  }

  async getInfo(key: string): Promise<{ remaining: number; resetTime: number } | null> {
    if (this.redis) {
      try {
        const info = await this.getInfoRedis(key);
        if (info) return info;
      } catch (error) {
        this.logger.warn(`Redis rate-limit info lookup failed for "${key}", falling back to in-memory: ${error}`);
      }
    }
    return this.getInfoInMemory(key);
  }

  private async getInfoRedis(key: string): Promise<{ remaining: number; resetTime: number } | null> {
    const redisKey = REDIS_KEY_PREFIX + key;
    const [count, meta] = await Promise.all([this.redis!.get(redisKey), this.redis!.hgetall(redisKey + ':meta')]);

    if (!count || !meta?.limit) return null;

    return {
      remaining: Math.max(0, Number(meta.limit) - Number(count)),
      resetTime: Number(meta.resetTime),
    };
  }

  private getInfoInMemory(key: string): { remaining: number; resetTime: number } | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    return {
      remaining: Math.max(0, entry.limit - entry.count),
      resetTime: entry.resetTime,
    };
  }

  async reset(key: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(REDIS_KEY_PREFIX + key, REDIS_KEY_PREFIX + key + ':meta');
      } catch (error) {
        this.logger.warn(`Redis rate-limit reset failed for "${key}": ${error}`);
      }
    }
    this.store.delete(key);
  }

  async resetAll(): Promise<void> {
    if (this.redis) {
      try {
        const keys = await this.redis.keys(REDIS_KEY_PREFIX + '*');
        if (keys.length > 0) await this.redis.del(...keys);
      } catch (error) {
        this.logger.warn(`Redis rate-limit resetAll failed: ${error}`);
      }
    }
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
  }

  // Predefined rate limits
  async checkLoginLimit(ip: string): Promise<boolean> {
    return this.checkLimit(`login:${ip}`, 5, 15 * 60 * 1000); // 5 attempts per 15 minutes
  }

  async checkApiLimit(apiKey: string): Promise<boolean> {
    return this.checkLimit(`api:${apiKey}`, 1000, 60 * 60 * 1000); // 1000 requests per hour
  }

  async checkMemoryLimit(userId: string): Promise<boolean> {
    return this.checkLimit(`memory:${userId}`, 100, 60 * 60 * 1000); // 100 memories per hour
  }

  async checkSearchLimit(userId: string): Promise<boolean> {
    return this.checkLimit(`search:${userId}`, 50, 60 * 60 * 1000); // 50 searches per hour
  }
}
