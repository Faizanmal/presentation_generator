import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '../logger/logger.service';

/**
 * Interceptor for logging HTTP requests and responses
 */
interface RequestWithExtras extends Request {
  user?: { id?: string; [key: string]: unknown };
  requestId?: string;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithExtras>();
    const response = context
      .switchToHttp()
      .getResponse<import('express').Response>();
    const { method, url, body, query, params } = request as unknown as Record<
      string,
      unknown
    >;
    const userAgent = request.get('user-agent') || '';
    const ip =
      request.ip ||
      ((request.connection as unknown as Record<string, unknown>)
        ?.remoteAddress as string) ||
      '';
    const userId =
      (request.user as { id?: string } | undefined)?.id || 'anonymous';
    const requestId =
      (request.headers as Record<string, string>)?.['x-request-id'] ||
      this.generateRequestId();

    // Add request ID to request for tracking
    request.requestId = requestId;

    const startTime = Date.now();

    // Determine if info-level logging is enabled (used for requests/responses).
    const logInfo = this.logger.isLevelEnabled('info');
    const isHealthCheck = (url as string)?.includes('/health');

    if (logInfo && !isHealthCheck) {
      this.logger.log(
        `Incoming ${method as string} ${url as string}`,
        JSON.stringify({
          requestId,
          userId,
          ip,
          userAgent,
          query,
          params,
          ...(process.env.LOG_LEVEL === 'debug' && { body }),
        }),
      );
    }

    return next.handle().pipe(
      tap({
        next: (): void => {
          const statusCode = (response as unknown as Record<string, unknown>)
            .statusCode as number;
          const responseTime = Date.now() - startTime;

          if (logInfo && !isHealthCheck) {
            this.logger.log(
              `Completed ${method as string} ${url as string} ${statusCode} - ${responseTime}ms`,
              JSON.stringify({
                requestId,
                userId,
                statusCode,
                responseTime,
              }),
            );
          }
        },
        error: (error: unknown): void => {
          const responseTime = Date.now() - startTime;
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          const status =
            error instanceof HttpException ? error.getStatus() : 500;
          const path = (url as string)?.split('?')[0] || '';
          const isPortScan =
            status === 404 &&
            (method === 'GET' || method === 'HEAD') &&
            (path === '/' || path === '');

          if (isPortScan) {
            return;
          }

          const payload = JSON.stringify({
            requestId,
            userId,
            error: errorMessage,
            responseTime,
            status,
          });

          if (status >= 500) {
            this.logger.error(
              `Failed ${method as string} ${url as string} - ${responseTime}ms`,
              error instanceof Error ? error.stack : '',
              payload,
            );
          } else {
            this.logger.warn(
              `Failed ${method as string} ${url as string} ${status} - ${responseTime}ms`,
              payload,
            );
          }
        },
      }),
    );
  }

  // helper to generate request id
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
