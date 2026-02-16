import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import { AdvancedCacheService } from './advanced-cache.service';
import { RedisModule } from '../redis/redis.module';

/**
 * Global caching module for production-ready performance optimization
 * Supports both in-memory and Redis-based caching with advanced features
 */
@Global()
@Module({
  imports: [ConfigModule, RedisModule],
  providers: [
    {
      provide: 'CACHE_CONFIG',
      useFactory: (configService: ConfigService) => ({
        redisUrl: configService.get<string>('REDIS_URL'),
        defaultTTL: configService.get<number>('CACHE_DEFAULT_TTL') || 3600,
        maxSize: configService.get<number>('CACHE_MAX_SIZE') || 1000,
      }),
      inject: [ConfigService],
    },
    CacheService,
    AdvancedCacheService,
  ],
  exports: [CacheService, AdvancedCacheService],
})
export class CacheModule {}
