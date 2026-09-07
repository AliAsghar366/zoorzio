import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SecurityService } from '../../security/security.service';
import { PrismaService } from '../../prisma/prisma.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Global auth guard: JWT bearer tokens work exactly as before (delegates to
 * JwtAuthGuard, unchanged). When an `x-api-key` header is present instead, it
 * validates the key, loads the owning user, and enforces that key's own
 * read/write scope against the request's HTTP method — never against any
 * other key the user might own (see SecurityService.checkPermission).
 */
@Injectable()
export class JwtOrApiKeyGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtAuthGuard: JwtAuthGuard,
    private securityService: SecurityService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const apiKeyHeader = request.headers['x-api-key'];

    if (typeof apiKeyHeader !== 'string' || apiKeyHeader.length === 0) {
      return this.jwtAuthGuard.canActivate(context) as Promise<boolean>;
    }

    const validated = await this.securityService.validateApiKey(apiKeyHeader);
    if (!validated) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    const requiredAction = SAFE_METHODS.has(request.method) ? 'read' : 'write';
    const allowed = await this.securityService.checkPermission(validated.id, requiredAction);
    if (!allowed) {
      throw new ForbiddenException(`This API key does not have "${requiredAction}" access`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: validated.userId },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) {
      throw new UnauthorizedException('API key user not found');
    }

    request.user = user;
    request.apiKey = validated;
    return true;
  }
}
