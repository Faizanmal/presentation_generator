import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
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

    return next.handle().pipe(
      tap({
        next: (): void => {
          const statusCode = (response as unknown as Record<string, unknown>)
            .statusCode as number;
          const responseTime = Date.now() - startTime;

          this.logger.log(
            `Completed ${method as string} ${url as string} ${statusCode} - ${responseTime}ms`,
            JSON.stringify({
              requestId,
              userId,
              statusCode,
              responseTime,
            }),
          );
        },
        error: (error: unknown): void => {
          const responseTime = Date.now() - startTime;
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : '';

          this.logger.error(
            `Failed ${method as string} ${url as string} - ${responseTime}ms`,
            errorStack,
            JSON.stringify({
              requestId,
              userId,
              error: errorMessage,
              responseTime,
            }),
          );
        },
      }),
    );
  }

  // helper to generate request id
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
