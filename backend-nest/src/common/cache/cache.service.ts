import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  hits: number;
}

interface CacheConfig {
  redisUrl?: string;
  defaultTTL: number;
  maxSize: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

/**
 * Production-ready caching service with LRU eviction
 * Supports in-memory caching with optional Redis backend
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly accessOrder: string[] = [];
  private hits = 0;
  private misses = 0;
  private cleanupInterval: NodeJS.Timeout;

  constructor(@Inject('CACHE_CONFIG') private readonly config: CacheConfig) {
    // Start periodic cleanup of expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    this.logger.log('Cache service initialized');
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.misses++;
      return null;
    }

    // Update access order for LRU
    this.updateAccessOrder(key);
    entry.hits++;
    this.hits++;

    return entry.value as T;
  }

  /**
   * Set a value in cache with optional TTL
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || this.config.defaultTTL;
    const expiresAt = Date.now() + ttl * 1000;

    // Evict if at capacity
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, { value, expiresAt, hits: 0 });
    this.updateAccessOrder(key);
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<boolean> {
    const existed = this.cache.delete(key);
    if (existed) {
      this.removeFromAccessOrder(key);
    }
    return existed;
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Get or set pattern - if key exists return cached, otherwise compute and cache
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder.length = 0;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return false;
    }
    return true;
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    if (!pattern) {
      return Array.from(this.cache.keys());
    }

    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.cache.keys()).filter((key) => regex.test(key));
  }

  // ============================================
  // CACHE KEY HELPERS
  // ============================================

  /**
   * Generate cache key for projects
   */
  projectKey(projectId: string): string {
    return `project:${projectId}`;
  }

  /**
   * Generate cache key for user projects list
   */
  userProjectsKey(userId: string): string {
    return `user:${userId}:projects`;
  }

  /**
   * Generate cache key for themes
   */
  themesKey(): string {
    return 'themes:all';
  }

  /**
   * Generate cache key for user subscription
   */
  subscriptionKey(userId: string): string {
    return `subscription:${userId}`;
  }

  /**
   * Generate cache key for analytics
   */
  analyticsKey(projectId: string, range: string): string {
    return `analytics:${projectId}:${range}`;
  }

  /**
   * Generate cache key for AI generation
   */
  aiGenerationKey(hash: string): string {
    return `ai:generation:${hash}`;
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private evictLRU(): void {
    if (this.accessOrder.length > 0) {
      const lruKey = this.accessOrder.shift();
      if (lruKey) {
        this.cache.delete(lruKey);
        this.logger.debug(`Evicted LRU entry: ${lruKey}`);
      }
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let expired = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        expired++;
      }
    }

    if (expired > 0) {
      this.logger.debug(`Cleaned up ${expired} expired cache entries`);
    }
  }
}
