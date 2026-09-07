import { Injectable, Logger, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { SecurityService } from '../../security/security.service';
import { AuditService } from '../../security/audit.service';

/**
 * Non-blocking defense-in-depth: flags request bodies/queries that match
 * common SQLi/XSS/path-traversal shapes. It never blocks or mutates the
 * request — Prisma's parameterized queries and React's auto-escaping already
 * prevent these classes of attack, and this product stores free-text user
 * content (notes, memories) where blind blocking would produce false
 * positives (e.g. a memory that legitimately contains a code snippet or an
 * apostrophe). Authenticated hits are recorded to the audit log for admin
 * visibility; unauthenticated hits (e.g. probing the login endpoint before
 * any user is known) only go to the server log, since AuditLog.userId is a
 * required foreign key with no "system" user to attribute them to.
 */
@Injectable()
export class SuspiciousInputInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SuspiciousInputInterceptor.name);

  constructor(
    private securityService: SecurityService,
    private auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const payload = { body: request.body, query: request.query, params: request.params };
    const hasPayload =
      payload.body || Object.keys(payload.query || {}).length || Object.keys(payload.params || {}).length;

    if (hasPayload && !this.securityService.validateRequest(payload)) {
      const userId = (request as any).user?.id;

      if (userId) {
        this.auditService
          .log(userId, 'SUSPICIOUS_INPUT_DETECTED', request.path, { method: request.method, ip: request.ip })
          .catch(() => undefined);
      } else {
        this.logger.warn(`Suspicious input on ${request.method} ${request.path} from ${request.ip}`);
      }
    }

    return next.handle();
  }
}
