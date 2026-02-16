import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { AdvancedCacheService } from '../cache/advanced-cache.service';
import { AdvancedRateLimitService } from '../rate-limit/advanced-rate-limit.service';

export interface SystemMetrics {
  timestamp: Date;
  database: DatabaseMetrics;
  cache: CacheMetrics;
  queues: QueueMetrics;
  performance: PerformanceMetrics;
}

export interface DatabaseMetrics {
  activeConnections: number;
  poolSize: number;
  poolAvailable: number;
  slowQueries: number;
  queryLatencyMs: number;
}

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  evictionRate: number;
  memoryUsedMb: number;
  memoryMaxMb: number;
  memoryUsagePercent: number;
  totalKeys: number;
  connectedClients: number;
}

export interface QueueMetrics {
  [queueName: string]: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
}

export interface PerformanceMetrics {
  avgResponseTimeMs: number;
  requestsPerSecond: number;
  errorRate: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
}

@Injectable()
export class PerformanceMonitoringService {
  private readonly logger = new Logger(PerformanceMonitoringService.name);
  private requestTimings: number[] = [];
  private requestCount = 0;
  private errorCount = 0;
  private readonly maxTimingsSamples = 1000;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly cacheService: AdvancedCacheService,
  ) {
    // Start periodic metrics collection
    this.startMetricsCollection();
  }

  /**
   * Start collecting metrics every minute
   */
  private startMetricsCollection(): void {
    setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.logger.log(
          `System Metrics | DB Conn: ${metrics.database.activeConnections}/${metrics.database.poolSize} | ` +
            `Cache Hit Rate: ${metrics.cache.hitRate.toFixed(2)}% | ` +
            `Avg Response: ${metrics.performance.avgResponseTimeMs.toFixed(0)}ms | ` +
            `RPS: ${metrics.performance.requestsPerSecond.toFixed(0)}`,
        );
      } catch (error) {
        this.logger.error('Failed to collect metrics:', error);
      }
    }, 60000); // Every minute
  }

  /**
   * Record request timing
   */
  recordRequest(responseTimeMs: number, isError: boolean = false): void {
    this.requestTimings.push(responseTimeMs);
    this.requestCount++;

    if (isError) {
      this.errorCount++;
    }

    // Keep only recent samples
    if (this.requestTimings.length > this.maxTimingsSamples) {
      this.requestTimings.shift();
    }
  }

  /**
   * Collect comprehensive system metrics
   */
  async collectMetrics(): Promise<SystemMetrics> {
    const [database, cache, queues, performance] = await Promise.all([
      this.getDatabaseMetrics(),
      this.getCacheMetrics(),
      this.getQueueMetrics(),
      this.getPerformanceMetrics(),
    ]);

    return {
      timestamp: new Date(),
      database,
      cache,
      queues,
      performance,
    };
  }

  /**
   * Get database connection metrics
   */
  private async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      // Query PostgreSQL for connection stats
      const result = await this.prisma.$queryRaw<any[]>`
        SELECT 
          count(*) as active_connections,
          sum(case when state = 'idle' then 1 else 0 end) as idle_connections,
          sum(case when state = 'active' then 1 else 0 end) as active_queries
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;

      const poolSize = Number.parseInt(process.env.DB_POOL_MAX || '100', 10);
      const activeConnections = result[0]?.active_connections || 0;

      return {
        activeConnections: Number(activeConnections),
        poolSize,
        poolAvailable: poolSize - Number(activeConnections),
        slowQueries: 0, // Implement slow query tracking if needed
        queryLatencyMs: 0, // Average from recent queries
      };
    } catch (error) {
      this.logger.error('Failed to get database metrics:', error);
      return {
        activeConnections: 0,
        poolSize: 0,
        poolAvailable: 0,
        slowQueries: 0,
        queryLatencyMs: 0,
      };
    }
  }

  /**
   * Get Redis cache metrics
   */
  private async getCacheMetrics(): Promise<CacheMetrics> {
    try {
      const info = await this.redis.info('stats');
      const memory = await this.redis.info('memory');
      const clients = await this.redis.info('clients');

      // Parse Redis INFO output
      const parseInfo = (infoStr: string): Record<string, string> => {
        const lines = infoStr.split('\r\n');
        const data: Record<string, string> = {};
        lines.forEach((line) => {
          const [key, value] = line.split(':');
          if (key && value) {
            data[key] = value;
          }
        });
        return data;
      };

      const statsData = parseInfo(info);
      const memoryData = parseInfo(memory);
      const clientsData = parseInfo(clients);

      const keyspaceHits = Number.parseInt(statsData.keyspace_hits || '0', 10);
      const keyspaceMisses = Number.parseInt(
        statsData.keyspace_misses || '0',
        10,
      );
      const totalOps = keyspaceHits + keyspaceMisses;
      const hitRate = totalOps > 0 ? (keyspaceHits / totalOps) * 100 : 0;

      const memoryUsedBytes = Number.parseInt(
        memoryData.used_memory || '0',
        10,
      );
      const memoryMaxBytes = Number.parseInt(memoryData.maxmemory || '0', 10);

      return {
        hitRate,
        missRate: 100 - hitRate,
        evictionRate: Number.parseInt(statsData.evicted_keys || '0', 10),
        memoryUsedMb: memoryUsedBytes / (1024 * 1024),
        memoryMaxMb: memoryMaxBytes / (1024 * 1024),
        memoryUsagePercent:
          memoryMaxBytes > 0 ? (memoryUsedBytes / memoryMaxBytes) * 100 : 0,
        totalKeys: await this.redis.dbsize(),
        connectedClients: Number.parseInt(
          clientsData.connected_clients || '0',
          10,
        ),
      };
    } catch (error) {
      this.logger.error('Failed to get cache metrics:', error);
      return {
        hitRate: 0,
        missRate: 0,
        evictionRate: 0,
        memoryUsedMb: 0,
        memoryMaxMb: 0,
        memoryUsagePercent: 0,
        totalKeys: 0,
        connectedClients: 0,
      };
    }
  }

  /**
   * Get queue metrics from BullMQ
   */
  private async getQueueMetrics(): Promise<QueueMetrics> {
    try {
      const queueNames = [
        'generation',
        'thinking-generation',
        'export',
        'email',
      ];

      const metrics: QueueMetrics = {};

      for (const queueName of queueNames) {
        // Get queue counts from Redis sorted sets
        const [waiting, active, completed, failed, delayed] = await Promise.all(
          [
            this.redis.zcard(`bull:${queueName}:wait`),
            this.redis.zcard(`bull:${queueName}:active`),
            this.redis.zcard(`bull:${queueName}:completed`),
            this.redis.zcard(`bull:${queueName}:failed`),
            this.redis.zcard(`bull:${queueName}:delayed`),
          ],
        );

        metrics[queueName] = {
          waiting,
          active,
          completed,
          failed,
          delayed,
        };
      }

      return metrics;
    } catch (error) {
      this.logger.error('Failed to get queue metrics:', error);
      return {};
    }
  }

  /**
   * Get API performance metrics
   */
  private getPerformanceMetrics(): PerformanceMetrics {
    if (this.requestTimings.length === 0) {
      return {
        avgResponseTimeMs: 0,
        requestsPerSecond: 0,
        errorRate: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
      };
    }

    const sorted = [...this.requestTimings].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const avg = sum / sorted.length;

    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    const errorRate =
      this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;

    return {
      avgResponseTimeMs: avg,
      requestsPerSecond: this.requestCount / 60, // Assuming 1-minute window
      errorRate,
      p95LatencyMs: sorted[p95Index] || 0,
      p99LatencyMs: sorted[p99Index] || 0,
    };
  }

  /**
   * Check system health
   */
  async checkHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
    metrics: SystemMetrics;
  }> {
    const metrics = await this.collectMetrics();

    const checks = {
      database: metrics.database.poolAvailable > 10,
      cache: metrics.cache.memoryUsagePercent < 90,
      performance: metrics.performance.avgResponseTimeMs < 1000,
      errorRate: metrics.performance.errorRate < 5,
    };

    const allHealthy = Object.values(checks).every((check) => check);
    const someUnhealthy =
      Object.values(checks).filter((check) => !check).length > 1;

    const status = allHealthy
      ? 'healthy'
      : someUnhealthy
        ? 'unhealthy'
        : 'degraded';

    return {
      status,
      checks,
      metrics,
    };
  }

  /**
   * Get scalability report
   */
  async getScalabilityReport(): Promise<{
    currentCapacity: number;
    maxCapacity: number;
    utilizationPercent: number;
    recommendations: string[];
  }> {
    const metrics = await this.collectMetrics();

    const dbUtilization =
      (metrics.database.activeConnections / metrics.database.poolSize) * 100;
    const cacheUtilization = metrics.cache.memoryUsagePercent;
    const avgUtilization = (dbUtilization + cacheUtilization) / 2;

    const recommendations: string[] = [];

    if (dbUtilization > 80) {
      recommendations.push('Consider increasing database connection pool size');
    }

    if (cacheUtilization > 80) {
      recommendations.push(
        'Consider increasing Redis memory limit or adding cache nodes',
      );
    }

    if (metrics.performance.avgResponseTimeMs > 500) {
      recommendations.push(
        'Response times are elevated - consider scaling up backend pods',
      );
    }

    if (metrics.performance.errorRate > 2) {
      recommendations.push(
        'Error rate is elevated - investigate recent deployments',
      );
    }

    // Estimate capacity based on current metrics
    const currentLoad = metrics.performance.requestsPerSecond;
    const targetUtilization = 70; // Aim for 70% utilization
    const maxCapacity =
      (currentLoad / (avgUtilization / 100)) * (targetUtilization / 100);

    return {
      currentCapacity: Math.floor(currentLoad),
      maxCapacity: Math.floor(maxCapacity),
      utilizationPercent: Math.floor(avgUtilization),
      recommendations,
    };
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.requestTimings = [];
    this.requestCount = 0;
    this.errorCount = 0;
  }
}
