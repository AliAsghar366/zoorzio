import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Protects the /api/cron/* trigger endpoints (see CronController). Vercel
 * Cron Jobs automatically send `Authorization: Bearer <CRON_SECRET>` when a
 * CRON_SECRET env var is set on the project, so the secret never has to live
 * in the cron URL itself - this guard just checks the header matches.
 */
@Injectable()
export class CronAuthGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.configService.get<string>('CRON_SECRET');
    if (!secret) {
      throw new UnauthorizedException('CRON_SECRET is not configured');
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (authHeader !== `Bearer ${secret}`) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    return true;
  }
}
