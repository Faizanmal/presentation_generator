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

        const redisOptions: any = {
          db,
          keyPrefix,
          retryStrategy(times: number) {
            const maxRetries = configService.get<number>('REDIS_MAX_RETRIES') || 5;
            if (times > maxRetries) {
              logger.error(`Redis unavailable after ${maxRetries} attempts. Continuing without Redis features.`);
              return null;
            }
            const delay = 5000; // Fixed 5s delay to keep logs extremely quiet
            logger.warn(`Redis reconnecting... (attempt ${times}/${maxRetries})`);
            return delay;
          },
          maxRetriesPerRequest: null, // Critical for robust error handling with reconnections
          enableReadyCheck: true,
          connectTimeout: 10_000,
          lazyConnect: true, // Use lazy connect to avoid crashing during bootstrap if Redis is down
        };

        // Add TLS support if we are connecting using rediss:// (common for Upstash/Cloud providers)
        if (redisUrl && redisUrl.startsWith('rediss://')) {
          redisOptions.tls = { rejectUnauthorized: false };
        }

        let client: Redis;
        if (redisUrl) {
          logger.log(`Initializing Redis with URL...`);
          client = new Redis(redisUrl, redisOptions);
        } else {
          redisOptions.host = host;
          redisOptions.port = port;

          // Only set password if auth is enabled AND password is provided
          if (redisAuthEnabled && password) {
            redisOptions.password = password;
            logger.log('Redis authentication enabled');
          }
          client = new Redis(redisOptions);
        }

        // ATTACH ERROR LISTENER IMMEDIATELY to avoid "Unhandled error event"
        client.on('error', (err: any) => {
          // Suppress redundant logs if we are already in a retry loop
          if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
            // These are handled by retryStrategy, just log a concise error
            logger.error(`✗ Redis connection error (${err.code}): ${err.message}`);
          } else {
            logger.error(`✗ Redis error:`, err);
          }
        });

        client.on('connect', () => {
          logger.log(`✓ Redis connected to ${host}:${port} (db: ${db})`);
        });

        client.on('close', () => {
          logger.warn('Redis connection closed');
        });

        // Trigger connection manually since we used lazyConnect: true
        void client.connect().catch((err) => {
          logger.error('Failed to initiate Redis connection:', err.message);
        });

        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule { }
