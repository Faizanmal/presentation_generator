import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class ScalablePrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ScalablePrismaService.name);

  constructor(private readonly configService: ConfigService) {
    const connectionLimit =
      configService.get<number>('DATABASE_CONNECTION_LIMIT') || 10;
    const poolTimeout =
      configService.get<number>('DATABASE_POOL_TIMEOUT') || 10;

    // Build connection URL with pooling parameters
    const databaseUrl = configService.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      // logger not available until after super; use console
      console.error('DATABASE_URL must be defined for scalable connections');
      throw new Error('DATABASE_URL is required');
    }

    // Add connection pooling parameters if not present
    const url = new URL(databaseUrl);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', String(connectionLimit));
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', String(poolTimeout));
    }
    // Enable statement caching
    if (!url.searchParams.has('statement_cache_size')) {
      url.searchParams.set('statement_cache_size', '100');
    }

    const pool = new Pool({ connectionString: url.toString() });
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log: [
        { level: 'query', emit: 'event' },
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });

    // Log slow queries in development
    if (configService.get<string>('NODE_ENV') !== 'production') {
      (this as PrismaClient).$on('query' as never, (e: Prisma.QueryEvent) => {
        if (e.duration > 100) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }

    // Always log errors
    (this as PrismaClient).$on('error' as never, (e: Prisma.LogEvent) => {
      this.logger.error(`Prisma error: ${e.message}`);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connection established');

      // Log pool settings
      const connectionLimit =
        this.configService.get<number>('DATABASE_CONNECTION_LIMIT') || 10;
      this.logger.log(
        `Connection pool: ${connectionLimit} connections per instance`,
      );
    } catch (error) {
      this.logger.error(`Failed to connect to database: ${error}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }

  /**
   * Execute a query with automatic retry on transient failures
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 100,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if it's a retryable error
        const isRetryable = this.isRetryableError(error);
        if (!isRetryable || attempt === maxRetries - 1) {
          throw error;
        }

        // Exponential backoff
        const delay = baseDelayMs * Math.pow(2, attempt);
        this.logger.warn(
          `Retrying database operation (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms`,
        );
        await this.sleep(delay);
      }
    }

    throw new Error('Database operation failed after retries', {
      cause: lastError,
    });
  }

  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    // Retryable error codes
    const retryableCodes = [
      'P1001', // Can't reach database server
      'P1002', // The database server was reached but timed out
      'P1008', // Operations timed out
      'P1017', // Server has closed the connection
      'P2024', // Timed out fetching a new connection from the pool
    ];

    return retryableCodes.includes(error.code);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Health check method for load balancer probes
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latencyMs: number;
    poolStats?: object;
  }> {
    const start = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      return {
        healthy: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      this.logger.error(`Database health check failed: ${error}`);
      return {
        healthy: false,
        latencyMs: Date.now() - start,
      };
    }
  }
}
