import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Cluster as RedisCluster } from 'ioredis';

export type RedisClient = Redis | RedisCluster;

@Injectable()
export class ClusterRedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClusterRedisService.name);
  private client?: RedisClient;
  private subscriber?: RedisClient;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const clusterMode =
      this.configService.get<string>('REDIS_CLUSTER_MODE') === 'true';
    const clusterNodes = this.configService.get<string>('REDIS_CLUSTER_NODES');
    const enabled =
      this.configService.get<string>('CLUSTER_REDIS_ENABLED') === 'true' ||
      clusterMode;

    // Extra client+subscriber pair is unused by the rest of the app and burns
    // two of the ~50 free Key Value connections — stay off unless explicitly needed.
    if (!enabled) {
      this.logger.log(
        'ClusterRedisService idle (set CLUSTER_REDIS_ENABLED=true to activate)',
      );
      return;
    }

    if (clusterMode && clusterNodes) {
      // Redis Cluster mode for high availability
      const nodes = clusterNodes.split(',').map((node) => {
        const [host, port] = node.trim().split(':');
        return { host, port: parseInt(port, 10) };
      });

      this.client = new RedisCluster(nodes, {
        redisOptions: {
          password: this.configService.get<string>('REDIS_PASSWORD'),
          tls:
            this.configService.get<string>('REDIS_TLS') === 'true'
              ? {}
              : undefined,
        },
        scaleReads: 'slave',
        enableReadyCheck: true,
        maxRedirections: 16,
        retryDelayOnFailover: 100,
        retryDelayOnClusterDown: 100,
      });

      this.subscriber = new RedisCluster(nodes, {
        redisOptions: {
          password: this.configService.get<string>('REDIS_PASSWORD'),
          tls:
            this.configService.get<string>('REDIS_TLS') === 'true'
              ? {}
              : undefined,
        },
      });

      this.logger.log(`Connected to Redis Cluster with ${nodes.length} nodes`);
      return;
    }

    // Single Redis instance mode
    const isRediss = redisUrl && redisUrl.startsWith('rediss://');
    const retryStrategy = (times: number) => Math.min(times * 5000, 30_000);

    const baseOptions: import('ioredis').RedisOptions = {
      password: this.configService.get<string>('REDIS_PASSWORD'),
      retryStrategy,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
    };

    if (isRediss) {
      baseOptions.tls = { rejectUnauthorized: false };
    }

    this.client = new Redis(redisUrl || 'redis://localhost:6379', baseOptions);
    this.subscriber = new Redis(redisUrl || 'redis://localhost:6379', {
      ...baseOptions,
      maxRetriesPerRequest: 0,
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis client error: ${err.message}`);
    });
    this.subscriber.on('error', (err) => {
      this.logger.error(`Redis subscriber error: ${err.message}`);
    });

    void this.client.connect().catch(() => {});
    void this.subscriber.connect().catch(() => {});

    this.logger.log('Connected to Redis single instance (lazy-load)');
  }

  async onModuleDestroy() {
    await this.client?.quit();
    await this.subscriber?.quit();
    this.logger.log('Redis connections closed');
  }

  getClient(): RedisClient {
    if (!this.client) {
      throw new Error(
        'ClusterRedisService is not active — set CLUSTER_REDIS_ENABLED=true',
      );
    }
    return this.client;
  }

  getSubscriber(): RedisClient {
    if (!this.subscriber) {
      throw new Error(
        'ClusterRedisService is not active — set CLUSTER_REDIS_ENABLED=true',
      );
    }
    return this.subscriber;
  }

  // Session storage methods
  async setSession(
    sessionId: string,
    data: Record<string, unknown>,
    ttlSeconds: number = 86400,
  ) {
    await this.getClient().setex(
      `session:${sessionId}`,
      ttlSeconds,
      JSON.stringify(data),
    );
  }

  async getSession(sessionId: string): Promise<Record<string, unknown> | null> {
    const data = await this.getClient().get(`session:${sessionId}`);
    return data ? (JSON.parse(data) as Record<string, unknown>) : null;
  }

  async deleteSession(sessionId: string) {
    await this.getClient().del(`session:${sessionId}`);
  }

  async refreshSession(sessionId: string, ttlSeconds: number = 86400) {
    await this.getClient().expire(`session:${sessionId}`, ttlSeconds);
  }

  // Distributed lock methods for cluster coordination
  async acquireLock(lockKey: string, ttlMs: number = 30000): Promise<boolean> {
    const lockValue = `${process.pid}-${Date.now()}`;
    const result = await this.getClient().set(
      `lock:${lockKey}`,
      lockValue,
      'PX',
      ttlMs,
      'NX',
    );
    return result === 'OK';
  }

  async releaseLock(lockKey: string): Promise<void> {
    await this.getClient().del(`lock:${lockKey}`);
  }

  // Rate limiting methods
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Math.floor(Date.now() / 1000);
    const windowKey = `ratelimit:${key}:${Math.floor(now / windowSeconds)}`;
    const client = this.getClient();

    const current = await client.incr(windowKey);
    if (current === 1) {
      await client.expire(windowKey, windowSeconds);
    }

    const allowed = current <= limit;
    const remaining = Math.max(0, limit - current);
    const resetAt = (Math.floor(now / windowSeconds) + 1) * windowSeconds;

    return { allowed, remaining, resetAt };
  }

  // Pub/Sub for cross-instance communication
  async publish(channel: string, message: Record<string, unknown>) {
    await this.getClient().publish(channel, JSON.stringify(message));
  }

  async subscribe(
    channel: string,
    handler: (message: Record<string, unknown>) => void,
  ) {
    const subscriber = this.getSubscriber();
    await subscriber.subscribe(channel);
    subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        try {
          handler(JSON.parse(msg) as Record<string, unknown>);
        } catch (e) {
          this.logger.error(
            `Failed to parse message: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    });
  }

  // Cache methods
  async cacheGet<T>(key: string): Promise<T | null> {
    const data = await this.getClient().get(`cache:${key}`);
    return data ? (JSON.parse(data) as T) : null;
  }

  async cacheSet<T>(key: string, value: T, ttlSeconds: number = 300) {
    await this.getClient().setex(
      `cache:${key}`,
      ttlSeconds,
      JSON.stringify(value),
    );
  }

  async cacheDelete(key: string) {
    await this.getClient().del(`cache:${key}`);
  }

  async cacheDeletePattern(pattern: string) {
    const client = this.getClient();
    const keys = await client.keys(`cache:${pattern}`);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  }
}
