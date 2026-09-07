import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from '../../security/rate-limit.service';

export const RATE_LIMIT_KEY = 'rate_limit';

/**
 * Was previously `Reflect.defineMetadata(RATE_LIMIT_KEY, { limit, ttl }, {})`,
 * which defines metadata on a throwaway object instead of returning a
 * decorator - meaning `@RateLimit(...)` never actually attached anything to
 * the handler it decorated. SetMetadata is the correct NestJS primitive here
 * (same pattern as the existing @Public()/@Roles() decorators).
 */
export const RateLimit = (limit: number, ttl: number) => SetMetadata(RATE_LIMIT_KEY, { limit, ttl });

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitConfig = this.reflector.get<{
      limit: number;
      ttl: number;
    }>(RATE_LIMIT_KEY, context.getHandler());

    if (!rateLimitConfig) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || request.ip;
    const key = `rate_limit:${userId}:${context.getHandler().name}`;

    const isAllowed = await this.rateLimitService.checkLimit(
      key,
      rateLimitConfig.limit,
      rateLimitConfig.ttl,
    );

    if (!isAllowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil(rateLimitConfig.ttl / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
