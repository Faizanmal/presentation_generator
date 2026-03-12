import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  /** 
   * Quota Buffer: Caches "Allowed" status for users with high remaining quota.
   * This drastically reduces Upstash command counts for rapid actions (like block edits).
   */
  private readonly quotaBuffer = new Map<string, {
    allowed: boolean;
    remaining: number;
    resetTime: Date;
    bufferedUntil: number
  }>();

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) { }

  /** In-memory fallback for development (avoids Redis round-trips per request) */
  private readonly devMemoryStore = new Map<string, { count: number; resetAt: number }>();

  private checkLimitInMemory(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const entry = this.devMemoryStore.get(key);

    if (!entry || now > entry.resetAt) {
      this.devMemoryStore.set(key, { count: 1, resetAt: now + config.duration * 1000 });
      return {
        allowed: true,
        remaining: config.points - 1,
        resetTime: new Date(now + config.duration * 1000),
      };
    }

    entry.count++;
    const allowed = entry.count <= config.points;
    return {
      allowed,
      remaining: Math.max(0, config.points - entry.count),
      resetTime: new Date(entry.resetAt),
      retryAfter: allowed ? undefined : Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  /**
   * Check rate limit using efficient fixed-window INCR (2 commands pipelined).
   * This replaces the 4-5 command sliding-window sorted-set approach, cutting
   * Redis command count by ~75% per request in production.
   */
  async checkLimit(
    key: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const isRedisEnabled = this.configService.get<boolean>('features.redisEnabled', true);

    // Fallback if Redis is disabled OR in development
    if (!isRedisEnabled || process.env.NODE_ENV !== 'production') {
      return this.checkLimitInMemory(key, config);
    }

    const now = Date.now();

    // --- QUOTA BUFFERING (Optimization) ---
    // If we recently saw this user had plenty of quota, allow them locally for a few seconds.
    const buffered = this.quotaBuffer.get(key);
    if (buffered && now < buffered.bufferedUntil && buffered.allowed && buffered.remaining > (config.points * 0.2)) {
      // Return buffered result (decrement remaining slightly for UI realism)
      return {
        ...buffered,
        remaining: Math.max(0, buffered.remaining - 1),
      };
    }

    const countKey = `rl:${key}`;
    const blockKey = `rl:blk:${key}`;

    try {
      // Single pipeline: INCR + TTL check + block check — 3 commands total
      const pipeline = this.redis.pipeline();
      pipeline.incr(countKey);
      pipeline.ttl(countKey);
      pipeline.get(blockKey);
      const results = (await pipeline.exec()) as [
        [Error | null, number],
        [Error | null, number],
        [Error | null, string | null],
      ];

      const count = results[0][1] ?? 1;
      const ttl = results[1][1] ?? -1;
      const blocked = results[2][1];

      // Set expiry only on first increment (key is new)
      if (ttl === -1) {
        void this.redis.expire(countKey, config.duration);
      }

      // Key is blocked (rate limit was exceeded previously)
      if (blocked) {
        const blockTtl = await this.redis.ttl(blockKey);
        const blockedResult = {
          allowed: false,
          remaining: 0,
          resetTime: new Date(now + blockTtl * 1000),
          retryAfter: blockTtl,
        };
        // Buffer the block status for 5 seconds to avoid repeated Redis checks
        this.quotaBuffer.set(key, { ...blockedResult, bufferedUntil: now + 5000 });
        return blockedResult;
      }

      const allowed = count <= config.points;
      const remaining = Math.max(0, config.points - count);
      const resetTime = new Date(now + (ttl > 0 ? ttl : config.duration) * 1000);

      // Set block key if exceeded and blockDuration is configured
      if (!allowed && config.blockDuration) {
        void this.redis.setex(blockKey, config.blockDuration, '1');
      }

      const result = {
        allowed,
        remaining,
        resetTime,
        retryAfter: allowed ? undefined : config.duration,
      };

      // BUFFER SUCCESS results if they have > 20% quota left
      // Buffer for 10 seconds (avoids 10 Redis calls in 10s for active users)
      if (allowed && remaining > (config.points * 0.2)) {
        this.quotaBuffer.set(key, { ...result, bufferedUntil: now + 10000 });
      }

      return result;
    } catch (error) {
      this.logger.error(`Rate limit check error for ${key}:`, error);
      // Allow request through on Redis error to prevent blocking legitimate users
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
