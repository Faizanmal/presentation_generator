import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from '../cache/cache.service';
import { CACHE_TTL_KEY } from '../decorators/cache.decorator';

/**
 * Interceptor for caching HTTP responses
 * Automatically caches GET requests based on URL and query params
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Only cache GET requests
    const request = context.switchToHttp().getRequest();
    if (request.method !== 'GET') {
      return next.handle();
    }

    // Check if caching is enabled for this endpoint
    const cacheTTL = this.reflector.get<number>(
      CACHE_TTL_KEY,
      context.getHandler(),
    );

    if (!cacheTTL) {
      return next.handle(); // No caching configured
    }

    // Generate cache key from URL, query params, and user ID
    const cacheKey = this.generateCacheKey(request);

    // Try to get from cache
    const cachedResponse = this.cacheService.get<unknown>(cacheKey);
    if (cachedResponse) {
      this.logger.debug(`Cache HIT: ${cacheKey}`);
      // Add cache header
      const response = context
        .switchToHttp()
        .getResponse<import('express').Response>();
      response.setHeader('X-Cache-Status', 'HIT');
      return of(cachedResponse);
    }

    this.logger.debug(`Cache MISS: ${cacheKey}`);

    // Execute request and cache the response
    return next.handle().pipe(
      tap((response) => {
        if (response && request.method === 'GET') {
          this.cacheService.set(cacheKey, response, cacheTTL);
          this.logger.debug(
            `Cached response for ${cacheKey} (TTL: ${cacheTTL}s)`,
          );

          // Add cache header
          const httpResponse = context
            .switchToHttp()
            .getResponse<import('express').Response>();
          httpResponse.setHeader('X-Cache-Status', 'MISS');
          httpResponse.setHeader(
            'Cache-Control',
            `public, max-age=${cacheTTL}`,
          );
        }
      }),
    );
  }

  /**
   * Generate a cache key from request details
   */
  private generateCacheKey(request: import('express').Request): string {
    const url = request.url;
    const userId = request.user?.id || 'anonymous';

    // For more complex cache key generation, you can include:
    // - Query parameters
    // - User roles/permissions
    // - Organization ID for multi-tenant apps

    const queryString = JSON.stringify(request.query);
    return `http_cache:${userId}:${url}:${queryString}`;
  }
}
