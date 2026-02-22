import { Injectable, Logger, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';

export interface RateLimitConfig {
  points: number; // Number of points
  duration: number; // Duration in seconds
  blockDuration?: number; // Block duration in seconds if exceeded
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

/**
 * Advanced rate limiting service with sliding window algorithm
 * Supports per-user, per-IP, and per-action rate limits
 */
@Injectable()
export class AdvancedRateLimitService {
  private readonly logger = new Logger(AdvancedRateLimitService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Check rate limit using sliding window algorithm
   */
  async checkLimit(
    key: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - config.duration * 1000;
    const blockKey = `ratelimit:block:${key}`;
    const countKey = `ratelimit:count:${key}`;

    try {
      // Check if currently blocked
      const blocked = await this.redis.get(blockKey);
      if (blocked) {
        const blockExpiry = await this.redis.ttl(blockKey);
        return {
          allowed: false,
          remaining: 0,
          resetTime: new Date(now + blockExpiry * 1000),
          retryAfter: blockExpiry,
        };
      }

      // Use sorted set for sliding window
      const pipeline = this.redis.pipeline();

      // Remove old entries
      pipeline.zremrangebyscore(countKey, 0, windowStart);

      // Count entries in current window
      pipeline.zcard(countKey);

      // Add current request
      pipeline.zadd(countKey, now, `${now}-${Math.random()}`);

      // Set expiration
      pipeline.expire(countKey, config.duration);

      const results = await pipeline.exec();

      const count = ((results as unknown[])[1] as [unknown, number])[1] || 0;

      const remaining = Math.max(0, config.points - count);
      const allowed = count < config.points;

      // If exceeded and blockDuration is set, block the key
      if (!allowed && config.blockDuration) {
        await this.redis.setex(blockKey, config.blockDuration, '1');
      }

      return {
        allowed,
        remaining,
        resetTime: new Date(now + config.duration * 1000),
        retryAfter: allowed ? undefined : config.duration,
      };
    } catch (error) {
      this.logger.error(`Rate limit check error for ${key}:`, error);
      // On error, allow the request to prevent blocking legitimate users
      return {
        allowed: true,
        remaining: config.points,
        resetTime: new Date(now + config.duration * 1000),
      };
    }
  }

  /**
   * Check user rate limit
   */
  async checkUserLimit(
    userId: string,
    action: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    return this.checkLimit(`user:${userId}:${action}`, config);
  }

  /**
   * Check IP rate limit
   */
  async checkIPLimit(
    ip: string,
    action: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    return this.checkLimit(`ip:${ip}:${action}`, config);
  }

  /**
   * Check global action rate limit
   */
  async checkGlobalLimit(
    action: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    return this.checkLimit(`global:${action}`, config);
  }

  /**
   * Reset rate limit for a key
   */
  async resetLimit(key: string): Promise<void> {
    try {
      await Promise.all([
        this.redis.del(`ratelimit:count:${key}`),
        this.redis.del(`ratelimit:block:${key}`),
      ]);
    } catch (error) {
      this.logger.error(`Rate limit reset error for ${key}:`, error);
    }
  }

  /**
   * Get remaining quota for user
   */
  async getUserQuota(
    userId: string,
    action: string,
    config: RateLimitConfig,
  ): Promise<{ remaining: number; total: number; resetTime: Date }> {
    const result = await this.checkUserLimit(userId, action, config);
    return {
      remaining: result.remaining,
      total: config.points,
      resetTime: result.resetTime,
    };
  }

  /**
   * AI Generation rate limiting - strict limits
   */
  async checkAIGenerationLimit(userId: string): Promise<RateLimitResult> {
    return this.checkUserLimit(userId, 'ai-generation', {
      points: 10, // 10 generations
      duration: 3600, // per hour
      blockDuration: 1800, // block for 30 minutes if exceeded
    });
  }

  /**
   * Image Generation rate limiting - very strict
   */
  async checkImageGenerationLimit(userId: string): Promise<RateLimitResult> {
    return this.checkUserLimit(userId, 'image-generation', {
      points: 5, // 5 images
      duration: 3600, // per hour
      blockDuration: 3600, // block for 1 hour if exceeded
    });
  }

  /**
   * Block edit rate limiting - lenient for collaboration
   */
  async checkBlockEditLimit(userId: string): Promise<RateLimitResult> {
    return this.checkUserLimit(userId, 'block-edit', {
      points: 1000, // 1000 edits
      duration: 60, // per minute
    });
  }

  /**
   * Export rate limiting
   */
  async checkExportLimit(userId: string): Promise<RateLimitResult> {
    return this.checkUserLimit(userId, 'export', {
      points: 20, // 20 exports
      duration: 3600, // per hour
      blockDuration: 1800, // block for 30 minutes if exceeded
    });
  }

  /**
   * Batch check multiple limits
   */
  async checkMultipleLimits(
    checks: Array<{ key: string; config: RateLimitConfig }>,
  ): Promise<RateLimitResult[]> {
    return Promise.all(
      checks.map(({ key, config }) => this.checkLimit(key, config)),
    );
  }

  /**
   * Premium user bypass - increase limits for premium users
   */
  getPremiumConfig(baseConfig: RateLimitConfig): RateLimitConfig {
    return {
      points: baseConfig.points * 5, // 5x more for premium
      duration: baseConfig.duration,
      blockDuration: baseConfig.blockDuration
        ? Math.floor(baseConfig.blockDuration / 2)
        : undefined,
    };
  }

  /**
   * Enterprise user bypass - very high limits
   */
  getEnterpriseConfig(baseConfig: RateLimitConfig): RateLimitConfig {
    return {
      points: baseConfig.points * 20, // 20x more for enterprise
      duration: baseConfig.duration,
      blockDuration: undefined, // No blocking for enterprise
    };
  }
}
