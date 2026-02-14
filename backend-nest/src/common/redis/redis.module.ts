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

        const host = configService.get<string>('REDIS_HOST') || 'localhost';
        const port = configService.get<number>('REDIS_PORT') || 6379;
        const password = configService.get<string>('REDIS_PASSWORD');
        const redisAuthEnabled =
          configService.get<string>('REDIS_AUTH_ENABLED') !== 'false';
        const db = parseInt(configService.get<string>('REDIS_DB') || '0');
        const keyPrefix = configService.get<string>('REDIS_KEY_PREFIX') || '';

        const redisOptions: Record<string, unknown> = {
          host,
          port,
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

        // Only set password if auth is enabled AND password is provided
        if (redisAuthEnabled && password) {
          redisOptions.password = password;
          logger.log('Redis authentication enabled');
        } else if (!redisAuthEnabled) {
          logger.log(
            'Redis authentication disabled (REDIS_AUTH_ENABLED=false)',
          );
        }

        const client = new Redis(redisOptions);

        client.on('connect', () => {
          logger.log(`✓ Redis connected to ${host}:${port} (db: ${db})`);
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
export class RedisModule {}
