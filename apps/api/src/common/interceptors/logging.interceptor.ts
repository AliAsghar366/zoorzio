import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const userId = (request as any).user?.id || 'anonymous';
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        const statusCode = response.statusCode;
        const contentLength = response.get('content-length');

        const logMessage = `${method} ${url} ${statusCode} ${duration}ms - ${contentLength || 0} bytes - ${ip} - ${userId} - ${userAgent}`;

        if (statusCode >= 500) {
          this.logger.error(logMessage);
        } else if (statusCode >= 400) {
          this.logger.warn(logMessage);
        } else {
          this.logger.log(logMessage);
        }
      }),
    );
  }
}
