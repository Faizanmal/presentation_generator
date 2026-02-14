import { Injectable, ExecutionContext } from '@nestjs/common';
import {
  ThrottlerGuard as NestThrottlerGuard,
  ThrottlerStorage,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';

/**
 * Enhanced throttler guard with custom rate limiting logic
 * Supports different limits per endpoint and user-based throttling
 */
@Injectable()
export class ThrottlerGuard extends NestThrottlerGuard {
  constructor(
    protected readonly reflector: Reflector,
    protected readonly storageService: ThrottlerStorage,
  ) {
    super(
      {
        // Use module-style options with a single default throttler
        storage: storageService,
        throttlers: [{ name: 'default', limit: 100, ttl: 60 }],
        setHeaders: true,
      } as ThrottlerModuleOptions,
      storageService,
      reflector,
    );
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    // Use user ID for authenticated users, IP for anonymous
    const user = req.user as { id?: string } | undefined;
    if (user && user.id) {
      return `user:${user.id}`;
    }

    // Get real IP behind proxies
    return this.getRealIp(req);
  }

  protected getRealIp(req: Record<string, unknown>): string {
    // Check various headers used by proxies/load balancers
    const headers = req.headers as Record<
      string,
      string | string[] | undefined
    >;
    const forwarded = headers?.['x-forwarded-for'];
    if (forwarded && typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }

    return (
      (headers?.['x-real-ip'] as string) ||
      (headers?.['cf-connecting-ip'] as string) || // Cloudflare
      (req.ip as string) ||
      (req.connection as { remoteAddress?: string })?.remoteAddress ||
      'unknown'
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Skip rate limiting for health checks
    if (request.path === '/health' || request.path === '/api/health') {
      return true;
    }

    // Get custom throttle metadata
    const throttleMetadata = this.reflector.getAllAndOverride<{
      ttl?: number;
      limit?: number;
    }>('throttle', [context.getHandler(), context.getClass()]);

    if (throttleMetadata) {
      // Apply custom limits by setting runtime throttlers (safe with current library types)
      this.throttlers = [
        {
          name: 'custom',
          ttl: throttleMetadata.ttl || 60,
          limit: throttleMetadata.limit || 100,
        },
      ];
    }

    return super.canActivate(context);
  }
}
