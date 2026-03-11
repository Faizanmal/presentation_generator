import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('RedisModule');

        const redisUrl = configService.get<string>('REDIS_URL');
        const host = configService.get<string>('REDIS_HOST') || 'localhost';
        const port = configService.get<number>('REDIS_PORT') || 6379;
        const password = configService.get<string>('REDIS_PASSWORD');
        const redisAuthEnabled =
          configService.get<string>('REDIS_AUTH_ENABLED') !== 'false';
        const db = parseInt(configService.get<string>('REDIS_DB') || '0');
        const keyPrefix = configService.get<string>('REDIS_KEY_PREFIX') || '';

        const redisOptions: Record<string, unknown> = {
          db,
          keyPrefix,
          retryStrategy(times: number) {
            const delay = Math.min(times * 50, 2000);
            logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
            return delay;
          },
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          connectTimeout: 10_000,
          lazyConnect: false,
        };

        // Add TLS support if we are connecting using rediss:// (common for Upstash/Cloud providers)
        if (redisUrl && redisUrl.startsWith('rediss://')) {
          redisOptions.tls = { rejectUnauthorized: false };
        }

        let client;
        if (redisUrl) {
          logger.log(`Using full Redis URL for connection`);
          client = new Redis(redisUrl, redisOptions as any);
        } else {
          redisOptions.host = host;
          redisOptions.port = port;

          // Only set password if auth is enabled AND password is provided
          if (redisAuthEnabled && password) {
            redisOptions.password = password;
            logger.log('Redis authentication enabled');
          } else if (!redisAuthEnabled) {
            logger.log(
              'Redis authentication disabled (REDIS_AUTH_ENABLED=false)',
            );
          }
          client = new Redis(redisOptions as any);
        }

        client.on('connect', () => {
          logger.log(`✓ Redis connected successfully`);
        });

        client.on('error', (err) => {
          logger.error(`✗ Redis error: ${err.message}`);
        });

        client.on('close', () => {
          logger.warn('Redis connection closed');
        });

        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule { }
