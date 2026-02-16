import { Injectable, Logger, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { CacheTTLConfig } from '../config/concurrency.config';

interface CacheOptions {
  ttl?: number;
  compress?: boolean;
}

@Injectable()
export class AdvancedCacheService {
  private readonly logger = new Logger(AdvancedCacheService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Get value from cache with automatic deserialization
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (!cached) {
        return null;
      }
      return JSON.parse(cached) as T;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with automatic serialization
   */
  async set(key: string, value: any, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl || 300; // Default 5 minutes
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete specific key from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      this.logger.error(`Cache delete pattern error for ${pattern}:`, error);
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Compute value
    const value = await factory();

    // Cache the result
    await this.set(key, value, options);

    return value;
  }

  /**
   * Invalidate cache for project-related data
   */
  async invalidateProject(projectId: string): Promise<void> {
    await Promise.all([
      this.deletePattern(`project:${projectId}:*`),
      this.deletePattern(`slides:${projectId}:*`),
      this.deletePattern(`blocks:${projectId}:*`),
    ]);
  }

  /**
   * Invalidate cache for user-related data
   */
  async invalidateUser(userId: string): Promise<void> {
    await this.deletePattern(`user:${userId}:*`);
  }

  /**
   * Cache project metadata
   */
  async cacheProject(projectId: string, data: any): Promise<void> {
    await this.set(`project:${projectId}:metadata`, data, {
      ttl: CacheTTLConfig.projectMetadata,
    });
  }

  /**
   * Get cached project metadata
   */
  async getProjectCache(projectId: string): Promise<any> {
    return this.get(`project:${projectId}:metadata`);
  }

  /**
   * Cache block data with short TTL for collaboration
   */
  async cacheBlock(blockId: string, data: any): Promise<void> {
    await this.set(`block:${blockId}`, data, { ttl: CacheTTLConfig.blockData });
  }

  /**
   * Get cached block data
   */
  async getBlockCache(blockId: string): Promise<any> {
    return this.get(`block:${blockId}`);
  }

  /**
   * Cache user profile
   */
  async cacheUserProfile(userId: string, data: any): Promise<void> {
    await this.set(`user:${userId}:profile`, data, {
      ttl: CacheTTLConfig.userProfile,
    });
  }

  /**
   * Get cached user profile
   */
  async getUserProfileCache(userId: string): Promise<any> {
    return this.get(`user:${userId}:profile`);
  }

  /**
   * Batch get multiple keys
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (keys.length === 0) return [];

      const values = await this.redis.mget(...keys);
      return values.map((v) => {
        if (!v) return null;
        try {
          return JSON.parse(v) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      this.logger.error(`Cache mget error:`, error);
      return keys.map(() => null);
    }
  }

  /**
   * Batch set multiple keys
   */
  async mset(
    items: Array<{ key: string; value: any; ttl?: number }>,
  ): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();

      for (const item of items) {
        const serialized = JSON.stringify(item.value);
        const ttl = item.ttl || 300;
        pipeline.setex(item.key, ttl, serialized);
      }

      await pipeline.exec();
    } catch (error) {
      this.logger.error(`Cache mset error:`, error);
    }
  }

  /**
   * Increment counter with TTL
   */
  async increment(key: string, ttl: number = 60): Promise<number> {
    try {
      const value = await this.redis.incr(key);
      if (value === 1) {
        // First increment, set TTL
        await this.redis.expire(key, ttl);
      }
      return value;
    } catch (error) {
      this.logger.error(`Cache increment error for ${key}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Cache exists error for ${key}:`, error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    try {
      const info = await this.redis.info('stats');
      const memory = await this.redis.info('memory');
      return { stats: info, memory };
    } catch (error) {
      this.logger.error(`Cache stats error:`, error);
      return null;
    }
  }
}
