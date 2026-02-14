import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '../logger/logger.service';

/**
 * Interceptor for logging HTTP requests and responses
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, query, params } = request;
    const userAgent = request.get('user-agent') || '';
    const ip = request.ip || request.connection.remoteAddress;
    const userId = request.user?.id || 'anonymous';
    const requestId =
      request.headers['x-request-id'] || this.generateRequestId();

    // Add request ID to request for tracking
    request.requestId = requestId;

    const startTime = Date.now();

    this.logger.log(
      `Incoming ${method} ${url}`,
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
        next: (data) => {
          const response = context.switchToHttp().getResponse();
          const { statusCode } = response;
          const responseTime = Date.now() - startTime;

          this.logger.log(
            `Completed ${method} ${url} ${statusCode} - ${responseTime}ms`,
            JSON.stringify({
              requestId,
              userId,
              statusCode,
              responseTime,
            }),
          );
        },
        error: (error) => {
          const responseTime = Date.now() - startTime;

          this.logger.error(
            `Failed ${method} ${url} - ${responseTime}ms`,
            error.stack,
            JSON.stringify({
              requestId,
              userId,
              error: error.message,
              responseTime,
            }),
          );
        },
      }),
    );
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
