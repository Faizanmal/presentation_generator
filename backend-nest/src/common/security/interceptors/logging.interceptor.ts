import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

/**
 * Production-ready logging interceptor for request/response tracking
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    const requestId = uuidv4();
    const method = request.method;
    const url = request.url;
    const userAgent = request.headers['user-agent'] || 'unknown';
    const ip = this.getClientIP(request);
    const userId = request.user?.id || 'anonymous';
    const startTime = Date.now();

    // Add request ID to headers for tracing
    response.setHeader('X-Request-ID', requestId);

    return next.handle().pipe(
      tap((data) => {
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
          this.logger.warn(
            `Slow request: ${method} ${url} took ${duration}ms`,
          );
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

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
            error: error.message,
          }),
        );

        throw error;
      }),
    );
  }

  private getClientIP(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers['x-real-ip'] ||
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
