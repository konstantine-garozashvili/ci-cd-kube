import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Renders every error as the same JSON envelope the Express template uses, so
 * clients see one error shape no matter which backend was scaffolded.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isDev = (process.env.NODE_ENV ?? 'development') !== 'production';

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // A thrown HttpException may already carry our envelope; pass it through.
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'error' in body) {
        return response.status(status).json({ ...body, timestamp: new Date().toISOString() });
      }
    }

    const error = exception instanceof Error ? exception : new Error(String(exception));

    response.status(status).json({
      status,
      error: status === HttpStatus.NOT_FOUND ? 'Not Found' : error.name || 'Internal Server Error',
      message:
        status === HttpStatus.NOT_FOUND
          ? `Cannot ${request.method} ${request.url}`
          : error.message,
      timestamp: new Date().toISOString(),
      ...(isDev && error.stack ? { stack: error.stack } : {}),
    });
  }
}
