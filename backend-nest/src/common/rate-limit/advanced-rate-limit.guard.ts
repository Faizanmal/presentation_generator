import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import {
  AdvancedRateLimitService,
  RateLimitConfig,
} from './advanced-rate-limit.service';

export const RATE_LIMIT_KEY = 'rateLimit';

/**
 * Decorator to set custom rate limits on routes
 */
export const RateLimit = (config: RateLimitConfig) =>
  Reflect.metadata(RATE_LIMIT_KEY, config);

/**
 * Guard that implements advanced rate limiting
 */
@Injectable()
export class AdvancedRateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: AdvancedRateLimitService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.get<RateLimitConfig>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (!config) {
      // No rate limit configured, allow the request
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || request.user?.sub;
    const ip = request.ip;

    // Determine the key based on authenticated user or IP
    const key = userId ? `user:${userId}` : `ip:${ip}`;

    // Adjust config based on user subscription tier
    let finalConfig = config;
    if (userId && request.user?.subscriptionTier) {
      const tier = request.user.subscriptionTier;
      if (tier === 'ENTERPRISE') {
        finalConfig = this.rateLimitService.getEnterpriseConfig(config);
      } else if (tier === 'PRO') {
        finalConfig = this.rateLimitService.getPremiumConfig(config);
      }
    }

    const result = await this.rateLimitService.checkLimit(key, finalConfig);

    // Add rate limit headers to response
    const response = context
      .switchToHttp()
      .getResponse<import('express').Response>();
    response.setHeader('X-RateLimit-Limit', finalConfig.points);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', result.resetTime.toISOString());

    if (!result.allowed) {
      if (result.retryAfter) {
        response.setHeader('Retry-After', result.retryAfter);
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
          resetTime: result.resetTime,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
