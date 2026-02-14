import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { HttpException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

/**
 * Production-ready logging interceptor for request/response tracking
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const requestId = uuidv4();
    const method = request.method;
    const url = request.url;
    const userAgent = request.headers['user-agent'] || 'unknown';
    const ip = this.getClientIP(request);

    const req = request as unknown as Record<string, unknown> & {
      user?: { id?: string; sub?: string };
    };
    const userId = req.user?.id || req.user?.sub || 'anonymous';
    const startTime = Date.now();

    // Add request ID to headers for tracing
    response.setHeader('X-Request-ID', requestId);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        this.logger.log(
          this.formatLog({
            requestId,
            method,
            url,
            statusCode,
            duration,
            userId,
            ip,
            userAgent,
          }),
        );

        // Log slow requests as warnings
        if (duration > 1000) {
          this.logger.warn(`Slow request: ${method} ${url} took ${duration}ms`);
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        const err = error as { status?: number; message?: string };
        const statusCode =
          error instanceof HttpException
            ? error.getStatus()
            : err.status || 500;

        this.logger.error(
          this.formatLog({
            requestId,
            method,
            url,
            statusCode,
            duration,
            userId,
            ip,
            userAgent,

            error: err.message || 'Unknown error',
          }),
        );

        throw error;
      }),
    );
  }

  private getClientIP(request: Request): string {
    const forwardedIdx = request.headers['x-forwarded-for'];
    const forwardedFirst = Array.isArray(forwardedIdx)
      ? forwardedIdx[0]
      : forwardedIdx;

    return (
      forwardedFirst?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      request.connection?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }

  private formatLog(data: {
    requestId: string;
    method: string;
    url: string;
    statusCode: number;
    duration: number;
    userId: string;
    ip: string;
    userAgent: string;
    error?: string;
  }): string {
    const base = `[${data.requestId}] ${data.method} ${data.url} ${data.statusCode} ${data.duration}ms - ${data.userId} - ${data.ip}`;
    return data.error ? `${base} - ERROR: ${data.error}` : base;
  }
}
