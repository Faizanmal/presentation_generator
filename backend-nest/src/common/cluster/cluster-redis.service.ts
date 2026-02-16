import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Cluster as RedisCluster } from 'ioredis';

export type RedisClient = Redis | RedisCluster;

@Injectable()
export class ClusterRedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClusterRedisService.name);
  private client: RedisClient;
  private subscriber: RedisClient;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const clusterMode = this.configService.get<string>('REDIS_CLUSTER_MODE') === 'true';
    const clusterNodes = this.configService.get<string>('REDIS_CLUSTER_NODES');

    if (clusterMode && clusterNodes) {
      // Redis Cluster mode for high availability
      const nodes = clusterNodes.split(',').map((node) => {
        const [host, port] = node.trim().split(':');
        return { host, port: parseInt(port, 10) };
      });

      this.client = new RedisCluster(nodes, {
        redisOptions: {
          password: this.configService.get<string>('REDIS_PASSWORD'),
          tls: this.configService.get<string>('REDIS_TLS') === 'true' ? {} : undefined,
        },
        scaleReads: 'slave', // Read from replicas for better performance
        enableReadyCheck: true,
        maxRedirections: 16,
        retryDelayOnFailover: 100,
        retryDelayOnClusterDown: 100,
      });

      this.subscriber = new RedisCluster(nodes, {
        redisOptions: {
          password: this.configService.get<string>('REDIS_PASSWORD'),
          tls: this.configService.get<string>('REDIS_TLS') === 'true' ? {} : undefined,
        },
      });

      this.logger.log(`Connected to Redis Cluster with ${nodes.length} nodes`);
    } else {
      // Single Redis instance mode
      this.client = new Redis(redisUrl || 'redis://localhost:6379', {
        password: this.configService.get<string>('REDIS_PASSWORD'),
        retryStrategy: (times) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
      });

      this.subscriber = new Redis(redisUrl || 'redis://localhost:6379', {
        password: this.configService.get<string>('REDIS_PASSWORD'),
        retryStrategy: (times) => Math.min(times * 50, 2000),
      });

      this.logger.log('Connected to Redis single instance');
    }

    // Event handlers
    this.client.on('error', (err) => {
      this.logger.error(`Redis client error: ${err.message}`);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis client connected');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis client ready');
    });
  }

  async onModuleDestroy() {
    await this.client?.quit();
    await this.subscriber?.quit();
    this.logger.log('Redis connections closed');
  }

  getClient(): RedisClient {
    return this.client;
  }

  getSubscriber(): RedisClient {
    return this.subscriber;
  }

  // Session storage methods
  async setSession(sessionId: string, data: Record<string, unknown>, ttlSeconds: number = 86400) {
    await this.client.setex(`session:${sessionId}`, ttlSeconds, JSON.stringify(data));
  }

  async getSession(sessionId: string): Promise<Record<string, unknown> | null> {
    const data = await this.client.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(sessionId: string) {
    await this.client.del(`session:${sessionId}`);
  }

  async refreshSession(sessionId: string, ttlSeconds: number = 86400) {
    await this.client.expire(`session:${sessionId}`, ttlSeconds);
  }

  // Distributed lock methods for cluster coordination
  async acquireLock(lockKey: string, ttlMs: number = 30000): Promise<boolean> {
    const lockValue = `${process.pid}-${Date.now()}`;
    const result = await this.client.set(
      `lock:${lockKey}`,
      lockValue,
      'PX',
      ttlMs,
      'NX',
    );
    return result === 'OK';
  }

  async releaseLock(lockKey: string): Promise<void> {
    await this.client.del(`lock:${lockKey}`);
  }

  // Rate limiting methods
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Math.floor(Date.now() / 1000);
    const windowKey = `ratelimit:${key}:${Math.floor(now / windowSeconds)}`;

    const current = await this.client.incr(windowKey);
    if (current === 1) {
      await this.client.expire(windowKey, windowSeconds);
    }

    const allowed = current <= limit;
    const remaining = Math.max(0, limit - current);
    const resetAt = (Math.floor(now / windowSeconds) + 1) * windowSeconds;

    return { allowed, remaining, resetAt };
  }

  // Pub/Sub for cross-instance communication
  async publish(channel: string, message: Record<string, unknown>) {
    await this.client.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, handler: (message: Record<string, unknown>) => void) {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        try {
          handler(JSON.parse(msg));
        } catch (e) {
          this.logger.error(`Failed to parse message: ${e}`);
        }
      }
    });
  }

  // Cache methods
  async cacheGet<T>(key: string): Promise<T | null> {
    const data = await this.client.get(`cache:${key}`);
    return data ? JSON.parse(data) : null;
  }

  async cacheSet<T>(key: string, value: T, ttlSeconds: number = 300) {
    await this.client.setex(`cache:${key}`, ttlSeconds, JSON.stringify(value));
  }

  async cacheDelete(key: string) {
    await this.client.del(`cache:${key}`);
  }

  async cacheDeletePattern(pattern: string) {
    const keys = await this.client.keys(`cache:${pattern}`);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }
}
