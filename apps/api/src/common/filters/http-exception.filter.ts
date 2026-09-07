import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        error = (exceptionResponse as any).error || error;
        details = (exceptionResponse as any).details || null;
      }
    } else if (exception instanceof Error) {
      // Deliberately NOT exception.message here - for a truly unhandled
      // error (a raw Prisma/driver exception, for example) that message can
      // contain internal query text, file paths, and line numbers, which
      // would otherwise leak straight into the client-facing JSON response
      // in every environment, not just dev. The real message is still fully
      // logged server-side via the call below.
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
    }

    const userId = (request as any).user?.id || 'anonymous';

    this.logger.error(
      `${method} ${url} ${status} - ${userId} - ${ip} - ${userAgent}`,
      exception instanceof Error ? exception.stack : '',
    );

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      error,
      details,
      timestamp: new Date().toISOString(),
      path: url,
    });
  }
}
