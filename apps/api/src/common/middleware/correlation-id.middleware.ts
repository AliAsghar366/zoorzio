import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('CorrelationId');

  use(req: Request, res: Response, next: NextFunction) {
    const correlationId =
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['x-request-id'] as string) ||
      randomUUID();

    // Store correlation ID on request
    (req as any).correlationId = correlationId;

    // Set response header
    res.setHeader('X-Correlation-Id', correlationId);

    // Add to response locals for logging
    res.locals.correlationId = correlationId;

    // Log request with correlation ID
    this.logger.log(
      `[${correlationId}] ${req.method} ${req.url} - ${req.ip}`,
    );

    // Track response time
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      this.logger.log(
        `[${correlationId}] ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`,
      );
    });

    next();
  }
}
