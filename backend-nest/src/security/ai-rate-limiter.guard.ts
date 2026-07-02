/**
 * AI Generation Rate Limiter
 *
 * Per-user rate limiting for AI generation endpoints.
 * Uses Redis sliding window counters with tier-based limits.
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';
import { Request, Response } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { id: string; subscriptionTier?: string };
}

/** Rate limits per subscription tier */
const TIER_LIMITS: Record<
  string,
  { perHour: number; perDay: number; perMonth: number }
> = {
  FREE: { perHour: 3, perDay: 10, perMonth: 50 },
  PRO: { perHour: 20, perDay: 100, perMonth: 1000 },
  ENTERPRISE: { perHour: 100, perDay: 500, perMonth: 10000 },
};

@Injectable()
export class AIGenerationRateLimiter implements CanActivate {
  private readonly logger = new Logger(AIGenerationRateLimiter.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;

    if (!userId) {
      throw new HttpException(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const tier = (request.user?.subscriptionTier || 'FREE').toUpperCase();
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.FREE;

    const now = Date.now();
    const hourKey = `ratelimit:gen:${userId}:hour:${Math.floor(now / 3600000)}`;
    const dayKey = `ratelimit:gen:${userId}:day:${Math.floor(now / 86400000)}`;
    const monthKey = `ratelimit:gen:${userId}:month:${new Date().toISOString().slice(0, 7)}`;

    try {
      const pipeline = this.redis.pipeline();
      pipeline.incr(hourKey);
      pipeline.expire(hourKey, 3600);
      pipeline.incr(dayKey);
      pipeline.expire(dayKey, 86400);
      pipeline.incr(monthKey);
      pipeline.expire(monthKey, 2678400); // 31 days

      const results = await pipeline.exec();
      if (!results) {
        // Redis unavailable â€” allow the request
        this.logger.warn(
          'Redis unavailable for rate limiting, allowing request',
        );
        return true;
      }

      const hourCount = (results[0]?.[1] as number) || 0;
      const dayCount = (results[2]?.[1] as number) || 0;
      const monthCount = (results[4]?.[1] as number) || 0;

      // Check limits
      if (hourCount > limits.perHour) {
        this.logger.warn(
          `Rate limit exceeded (hourly) for user ${userId}: ${hourCount}/${limits.perHour}`,
        );
        throw new HttpException(
          {
            message:
              'Hourly generation limit reached. Please wait or upgrade your plan.',
            retryAfter: 3600,
            limit: limits.perHour,
            current: hourCount,
            tier,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (dayCount > limits.perDay) {
        this.logger.warn(
          `Rate limit exceeded (daily) for user ${userId}: ${dayCount}/${limits.perDay}`,
        );
        throw new HttpException(
          {
            message:
              'Daily generation limit reached. Please try again tomorrow or upgrade.',
            retryAfter: 86400,
            limit: limits.perDay,
            current: dayCount,
            tier,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (monthCount > limits.perMonth) {
        this.logger.warn(
          `Rate limit exceeded (monthly) for user ${userId}: ${monthCount}/${limits.perMonth}`,
        );
        throw new HttpException(
          {
            message:
              'Monthly generation limit reached. Please upgrade your plan.',
            limit: limits.perMonth,
            current: monthCount,
            tier,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Add rate limit headers to response
      const response = context.switchToHttp().getResponse<Response>();
      response.setHeader('X-RateLimit-Limit-Hour', limits.perHour);
      response.setHeader(
        'X-RateLimit-Remaining-Hour',
        Math.max(0, limits.perHour - hourCount),
      );
      response.setHeader('X-RateLimit-Limit-Day', limits.perDay);
      response.setHeader(
        'X-RateLimit-Remaining-Day',
        Math.max(0, limits.perDay - dayCount),
      );

      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Redis error â€” allow the request but log
      this.logger.error(`Rate limiter error: ${(error as Error).message}`);
      return true;
    }
  }
}
