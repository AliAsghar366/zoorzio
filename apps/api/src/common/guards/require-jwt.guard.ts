import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Blocks API-key-authenticated requests from routes that manage API keys
 * themselves (create/list/revoke) — otherwise a leaked read-only key could
 * mint itself a brand new full-access key. Must run after JwtOrApiKeyGuard,
 * which tags API-key requests with `request.apiKey`.
 */
@Injectable()
export class RequireJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.apiKey) {
      throw new ForbiddenException('This action requires a logged-in session, not an API key');
    }
    return true;
  }
}
