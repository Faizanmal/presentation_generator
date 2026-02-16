import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PerformanceMonitoringService } from './performance-monitoring.service';

/**
 * Interceptor to track request timing and errors
 * Automatically records metrics for performance monitoring
 */
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);

  constructor(
    private readonly performanceMonitoring: PerformanceMonitoringService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();
    const method = request.method;
    const url = request.url;

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        this.performanceMonitoring.recordRequest(responseTime, false);

        // Log slow requests
        if (responseTime > 1000) {
          this.logger.warn(
            `Slow request: ${method} ${url} took ${responseTime}ms`,
          );
        }
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime;
        this.performanceMonitoring.recordRequest(responseTime, true);

        this.logger.error(
          `Error in ${method} ${url} after ${responseTime}ms:`,
          error.message,
        );

        return throwError(() => error);
      }),
    );
  }
}
