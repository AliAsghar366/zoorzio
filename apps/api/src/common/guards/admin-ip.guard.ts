import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SecurityService } from '../../security/security.service';

/**
 * Opt-in guard for admin routes: enforces the ADMIN_IP_ALLOWLIST allowlist
 * (see SecurityService.isAllowedIP). With no allowlist configured this is a
 * no-op, so applying it to AdminController has zero effect until an operator
 * sets the env var — it only ever tightens access.
 */
@Injectable()
export class AdminIpGuard implements CanActivate {
  constructor(private securityService: SecurityService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.connection?.remoteAddress || '';

    if (!this.securityService.isAllowedIP(ip)) {
      throw new ForbiddenException('Access denied from this network location');
    }

    return true;
  }
}
