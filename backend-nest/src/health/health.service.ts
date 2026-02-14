import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async getHealth() {
    const startTime = Date.now();

    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const dbCheck = checks[0];
    const redisCheck = checks[1];

    const healthy =
      dbCheck.status === 'fulfilled' &&
      dbCheck.value &&
      redisCheck.status === 'fulfilled' &&
      redisCheck.value;

    return {
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      checks: {
        database:
          dbCheck.status === 'fulfilled' && dbCheck.value ? 'up' : 'down',
        redis:
          redisCheck.status === 'fulfilled' && redisCheck.value ? 'up' : 'down',
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }

  async checkReadiness() {
    const healthy = await this.isHealthy();

    if (!healthy) {
      throw new Error('Service not ready');
    }

    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  private async isHealthy(): Promise<boolean> {
    const dbHealthy = await this.checkDatabase();
    const redisHealthy = await this.checkRedis();
    return dbHealthy && redisHealthy;
  }
}
