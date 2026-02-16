import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY = 'cache';
export const CACHE_TTL_KEY = 'cache_ttl';

/**
 * Apply caching to controller endpoints
 *
 * @param ttl Time to live in seconds (default: 60)
 *
 * @example
 * @CacheResponse(300) // Cache for 5 minutes
 * @Get('projects')
 * async getProjects() {}
 */
export const CacheResponse = (ttl: number = 60) =>
  SetMetadata(CACHE_TTL_KEY, ttl);

/**
 * Predefined cache durations for common scenarios
 */
export const CacheDurations = {
  /** 30 seconds - For frequently changing data */
  SHORT: 30,

  /** 5 minutes - Default for most read operations */
  MEDIUM: 300,

  /** 15 minutes - For relatively static data */
  LONG: 900,

  /** 1 hour - For very static data like themes, templates */
  VERY_LONG: 3600,

  /** 24 hours - For public resources that rarely change */
  DAY: 86400,
};

/**
 * Common caching decorators
 */
export const CacheShort = () => CacheResponse(CacheDurations.SHORT);
export const CacheMedium = () => CacheResponse(CacheDurations.MEDIUM);
export const CacheLong = () => CacheResponse(CacheDurations.LONG);
export const CacheVeryLong = () => CacheResponse(CacheDurations.VERY_LONG);
export const CacheDay = () => CacheResponse(CacheDurations.DAY);
