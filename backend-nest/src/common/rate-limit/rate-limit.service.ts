import {
  Injectable,
  Logger,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';

export interface RateLimitConfig {
  /**
   * Maximum number of requests
   */
  max: number;
  /**
   * Time window in seconds
   */
  window: number;
  /**
   * Custom key generator function
   */
  keyGenerator?: (req: Request) => string;
  /**
   * Skip function to bypass rate limiting
   */
  skip?: (req: Request) => boolean;
  /**
   * Custom error message
   */
  message?: string;
  /**
   * Status code to return when rate limited
   */
  statusCode?: number;
  /**
   * Enable Redis-based distributed rate limiting
   */
  useRedis?: boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export enum RateLimitStrategy {
  /**
   * Fixed window - resets at fixed intervals
   */
  FIXED_WINDOW = 'fixed-window',
  /**
   * Sliding window - more accurate but slightly more expensive
   */
  SLIDING_WINDOW = 'sliding-window',
  /**
   * Token bucket - allows burst traffic
   */
  TOKEN_BUCKET = 'token-bucket',
  /**
   * Leaky bucket - smooth out traffic
   */
  LEAKY_BUCKET = 'leaky-bucket',
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly redis: Redis | null = null;
  private readonly memoryStore: Map<string, unknown> = new Map();
  private readonly strategy: RateLimitStrategy;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    this.strategy = this.configService.get<RateLimitStrategy>(
      'RATE_LIMIT_STRATEGY',
      RateLimitStrategy.SLIDING_WINDOW,
    );

    if (redisUrl) {
      const redisOptions: import('ioredis').RedisOptions = {
        lazyConnect: true,
        maxRetriesPerRequest: null,
        retryStrategy(times: number) {
          if (times > 5) return null;
          return 5000;
        },
      };

      if (redisUrl.startsWith('rediss://')) {
        redisOptions.tls = { rejectUnauthorized: false };
      }

      const client = new Redis(redisUrl, redisOptions);
      this.redis = client;

      // Attach error listener immediately
      client.on('error', (err: any) => {
        if (err.code === 'ECONNREFUSED') {
          this.logger.error(`RateLimit Redis connection failed: ${err.message}`);
        } else {
          this.logger.error('RateLimit Redis error:', err);
        }
      });

      // Initiate connection
      void client.connect().catch(() => { });

      this.logger.log('Rate Limit Service initialized with Redis (lazy-load)');
    } else {
      this.logger.log('Rate Limit Service initialized with in-memory store');
    }
  }

  /**
   * Check if request should be rate limited
   */
  async checkLimit(
    key: string,
    config: RateLimitConfig,
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    switch (this.strategy) {
      case RateLimitStrategy.SLIDING_WINDOW:
        return this.slidingWindow(key, config);
      case RateLimitStrategy.TOKEN_BUCKET:
        return this.tokenBucket(key, config);
      case RateLimitStrategy.LEAKY_BUCKET:
        return this.leakyBucket(key, config);
      case RateLimitStrategy.FIXED_WINDOW:
      default:
        return this.fixedWindow(key, config);
    }
  }

  /**
   * Fixed window rate limiting
   */
  private async fixedWindow(
    key: string,
    config: RateLimitConfig,
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    const now = Date.now();
    const windowStart =
      Math.floor(now / (config.window * 1000)) * config.window * 1000;
    const windowKey = `ratelimit:${key}:${windowStart}`;

    if (this.redis && config.useRedis !== false) {
      return this.fixedWindowRedis(windowKey, config, windowStart);
    } else {
      return this.fixedWindowMemory(windowKey, config, windowStart);
    }
  }

  private async fixedWindowRedis(
    windowKey: string,
    config: RateLimitConfig,
    _windowStart: number,
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    // _windowStart passed for signature compatibility; not used
    const count = await this.redis!.incr(windowKey);

    if (count === 1) {
      await this.redis!.expire(windowKey, config.window);
    }

    const ttl = await this.redis!.ttl(windowKey);
    const reset = Date.now() + ttl * 1000;

    return {
      allowed: count <= config.max,
      info: {
        limit: config.max,
        remaining: Math.max(0, config.max - count),
        reset,
        retryAfter: count > config.max ? ttl : undefined,
      },
    };
  }

  private fixedWindowMemory(
    windowKey: string,
    config: RateLimitConfig,
    _windowStart: number,
  ): { allowed: boolean; info: RateLimitInfo } {
    type FixedEntry = { count: number; windowStart: number };
    let entry = this.memoryStore.get(windowKey) as FixedEntry | undefined;

    if (!entry) {
      entry = { count: 0, windowStart: _windowStart };
      this.memoryStore.set(windowKey, entry);
    }

    entry.count++;

    const reset = _windowStart + config.window * 1000;
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);

    // Cleanup old entries
    setTimeout(() => this.memoryStore.delete(windowKey), config.window * 1000);

    return {
      allowed: entry.count <= config.max,
      info: {
        limit: config.max,
        remaining: Math.max(0, config.max - entry.count),
        reset,
        retryAfter: entry.count > config.max ? retryAfter : undefined,
      },
    };
  }

  /**
   * Sliding window rate limiting
   */
  private async slidingWindow(
    key: string,
    config: RateLimitConfig,
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    const now = Date.now();
    const windowKey = `ratelimit:sliding:${key}`;

    if (this.redis && config.useRedis !== false) {
      return this.slidingWindowRedis(windowKey, config, now);
    } else {
      return this.slidingWindowMemory(windowKey, config, now);
    }
  }

  private async slidingWindowRedis(
    windowKey: string,
    config: RateLimitConfig,
    now: number,
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    const windowStart = now - config.window * 1000;

    // Remove old entries
    await this.redis!.zremrangebyscore(windowKey, 0, windowStart);

    // Count current entries
    const count = await this.redis!.zcard(windowKey);

    const allowed = count < config.max;

    if (allowed) {
      // Add new entry
      await this.redis!.zadd(windowKey, now, `${now}:${Math.random()}`);
      await this.redis!.expire(windowKey, config.window);
    }

    const reset = now + config.window * 1000;

    return {
      allowed,
      info: {
        limit: config.max,
        remaining: Math.max(0, config.max - (count + (allowed ? 1 : 0))),
        reset,
        retryAfter: !allowed ? config.window : undefined,
      },
    };
  }

  private slidingWindowMemory(
    windowKey: string,
    config: RateLimitConfig,
    now: number,
  ): { allowed: boolean; info: RateLimitInfo } {
    const windowStart = now - config.window * 1000;
    let entries: number[] = (this.memoryStore.get(windowKey) as number[]) || [];

    // Remove old entries
    entries = entries.filter((timestamp) => timestamp > windowStart);

    const allowed = entries.length < config.max;

    if (allowed) {
      entries.push(now);
    }

    this.memoryStore.set(windowKey, entries);

    const reset = now + config.window * 1000;

    return {
      allowed,
      info: {
        limit: config.max,
        remaining: Math.max(0, config.max - entries.length),
        reset,
        retryAfter: !allowed ? config.window : undefined,
      },
    };
  }

  /**
   * Token bucket rate limiting
   */
  private async tokenBucket(
    key: string,
    config: RateLimitConfig,
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    const now = Date.now();
    const bucketKey = `ratelimit:bucket:${key}`;

    if (this.redis && config.useRedis !== false) {
      return this.tokenBucketRedis(bucketKey, config, now);
    } else {
      return this.tokenBucketMemory(bucketKey, config, now);
    }
  }

  private async tokenBucketRedis(
    bucketKey: string,
    config: RateLimitConfig,
    now: number,
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    const refillRate = config.max / config.window; // tokens per second
    const bucketData = await this.redis!.get(bucketKey);

    let tokens = config.max;

    if (bucketData) {
      const parsed = JSON.parse(bucketData);
      tokens = parsed.tokens;
      const lastRefill = parsed.lastRefill;

      // Refill tokens based on time passed
      const timePassed = (now - lastRefill) / 1000;
      const tokensToAdd = timePassed * refillRate;
      tokens = Math.min(config.max, tokens + tokensToAdd);
    }

    const allowed = tokens >= 1;

    if (allowed) {
      tokens -= 1;
    }

    await this.redis!.setex(
      bucketKey,
      config.window,
      JSON.stringify({ tokens, lastRefill: now }),
    );

    const timeToRefill = allowed ? 0 : Math.ceil((1 - tokens) / refillRate);

    return {
      allowed,
      info: {
        limit: config.max,
        remaining: Math.floor(tokens),
        reset: now + config.window * 1000,
        retryAfter: timeToRefill,
      },
    };
  }

  private tokenBucketMemory(
    bucketKey: string,
    config: RateLimitConfig,
    now: number,
  ): { allowed: boolean; info: RateLimitInfo } {
    const refillRate = config.max / config.window;
    type BucketType = { tokens: number; lastRefill: number };
    let bucket = this.memoryStore.get(bucketKey) as BucketType | undefined;

    if (!bucket) {
      bucket = { tokens: config.max, lastRefill: now };
    } else {
      const timePassed = (now - bucket.lastRefill) / 1000;
      const tokensToAdd = timePassed * refillRate;
      bucket.tokens = Math.min(config.max, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    const allowed = bucket.tokens >= 1;

    if (allowed) {
      bucket.tokens -= 1;
    }

    this.memoryStore.set(bucketKey, bucket);

    const timeToRefill = allowed
      ? 0
      : Math.ceil((1 - bucket.tokens) / refillRate);

    return {
      allowed,
      info: {
        limit: config.max,
        remaining: Math.floor(bucket.tokens),
        reset: now + config.window * 1000,
        retryAfter: timeToRefill,
      },
    };
  }

  /**
   * Leaky bucket rate limiting
   */
  private async leakyBucket(
    key: string,
    config: RateLimitConfig,
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    const now = Date.now();
    const bucketKey = `ratelimit:leaky:${key}`;

    if (this.redis && config.useRedis !== false) {
      return this.leakyBucketRedis(bucketKey, config, now);
    } else {
      return this.leakyBucketMemory(bucketKey, config, now);
    }
  }

  private async leakyBucketRedis(
    bucketKey: string,
    config: RateLimitConfig,
    now: number,
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    const leakRate = config.max / config.window; // requests per second
    const bucketData = await this.redis!.get(bucketKey);

    let water = 0;

    if (bucketData) {
      const parsed = JSON.parse(bucketData);
      water = parsed.water;
      const lastLeak = parsed.lastLeak;

      // Leak water based on time passed
      const timePassed = (now - lastLeak) / 1000;
      const leaked = timePassed * leakRate;
      water = Math.max(0, water - leaked);
    }

    const allowed = water < config.max;

    if (allowed) {
      water += 1;
    }

    await this.redis!.setex(
      bucketKey,
      config.window,
      JSON.stringify({ water, lastLeak: now }),
    );

    const timeToLeak = water > 0 ? Math.ceil(water / leakRate) : 0;

    return {
      allowed,
      info: {
        limit: config.max,
        remaining: Math.max(0, config.max - Math.ceil(water)),
        reset: now + timeToLeak * 1000,
        retryAfter: !allowed ? timeToLeak : undefined,
      },
    };
  }

  private leakyBucketMemory(
    bucketKey: string,
    config: RateLimitConfig,
    now: number,
  ): { allowed: boolean; info: RateLimitInfo } {
    const leakRate = config.max / config.window;
    type LeakyType = { water: number; lastLeak: number };
    let bucket = this.memoryStore.get(bucketKey) as LeakyType | undefined;

    if (!bucket) {
      bucket = { water: 0, lastLeak: now };
    } else {
      const timePassed = (now - bucket.lastLeak) / 1000;
      const leaked = timePassed * leakRate;
      bucket.water = Math.max(0, bucket.water - leaked);
      bucket.lastLeak = now;
    }

    const allowed = bucket.water < config.max;

    if (allowed) {
      bucket.water += 1;
    }

    this.memoryStore.set(bucketKey, bucket);

    const timeToLeak =
      bucket.water > 0 ? Math.ceil(bucket.water / leakRate) : 0;

    return {
      allowed,
      info: {
        limit: config.max,
        remaining: Math.max(0, config.max - Math.ceil(bucket.water)),
        reset: now + timeToLeak * 1000,
        retryAfter: !allowed ? timeToLeak : undefined,
      },
    };
  }

  /**
   * Reset rate limit for a key
   */
  async resetLimit(key: string): Promise<void> {
    if (this.redis) {
      const keys = await this.redis.keys(`ratelimit:*:${key}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } else {
      for (const [memKey] of this.memoryStore) {
        if (memKey.includes(key)) {
          this.memoryStore.delete(memKey);
        }
      }
    }

    this.logger.log(`Rate limit reset for key: ${key}`);
  }

  /**
   * Get current rate limit status
   */
  async getLimitStatus(
    key: string,
    config: RateLimitConfig,
  ): Promise<RateLimitInfo> {
    const result = await this.checkLimit(key, {
      ...config,
      max: config.max + 1,
    });
    return result.info;
  }
}

/**
 * Rate limiting middleware
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);

  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly configService: ConfigService,
  ) { }

  async use(req: Request, res: Response, next: NextFunction) {
    const config: RateLimitConfig = {
      max: this.configService.get<number>('RATE_LIMIT_MAX', 100),
      window: this.configService.get<number>('RATE_LIMIT_WINDOW', 60),
      keyGenerator: (req) => req.ip || 'unknown',
      statusCode: 429,
      message: 'Too many requests, please try again later.',
    };

    if (config.skip && config.skip(req)) {
      return next();
    }

    const key = config.keyGenerator!(req);
    const result = await this.rateLimitService.checkLimit(key, config);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', result.info.limit);
    res.setHeader('X-RateLimit-Remaining', result.info.remaining);
    res.setHeader('X-RateLimit-Reset', result.info.reset);

    if (!result.allowed) {
      res.setHeader('Retry-After', result.info.retryAfter || config.window);
      throw new HttpException(
        config.message || 'Too many requests',
        config.statusCode || HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }
}
