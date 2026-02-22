import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';

// prisma.service now validates that a database URL is provided
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      // fail fast so the app doesn't start with an invalid db config
      // cannot use this.logger before super(), use console.error instead
      console.error('Missing DATABASE_URL environment variable');
      throw new Error('DATABASE_URL must be set');
    }

    // pool configuration can be controlled via environment variables,
    // giving us a way to tune timeouts in production or under load
    const pool = new Pool({
      connectionString,
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      min: parseInt(process.env.DB_POOL_MIN || '0', 10),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(
        process.env.DB_CONNECTION_TIMEOUT || '0',
        10,
      ),
    });

    // surface low‑level errors from the pg pool so they show up in our logs
    pool.on('error', (err) => {
      this.logger.error('Postgres pool error', err as unknown);
    });

    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });

    if (!connectionString) {
      this.logger.warn('DATABASE_URL is not set');
    }

    // log any Prisma‑level errors as well, this hooks the client engine events
    (this as PrismaClient).$on('error' as never, (e: unknown) => {
      this.logger.error(`Prisma error: ${(e as { message: string }).message}`, e);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connection established');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }

  /**
   * Clean database for testing purposes
   * WARNING: Only use in test environment
   */
  /**
   * Execute an arbitrary function with automatic retry on transient errors.
   * This is similar to what `ScalablePrismaService` provides and can be
   * leveraged by services that perform batch tasks (e.g. cron jobs) so that
   * a transient connection timeout doesn't abort the whole operation.
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

        const isRetryable = /connection timeout/i.test(error?.message || '');
        if (!isRetryable || attempt === maxRetries - 1) {
          throw error;
        }

        const delay = baseDelayMs * Math.pow(2, attempt);
        this.logger.warn(
          `Retrying database operation (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw lastError!;
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase can only be used in test environment');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) =>
        typeof key === 'string' && !key.startsWith('_') && !key.startsWith('$'),
    );

    for (const model of models) {
      const modelKey = model as string;

      const delegate = (this as Record<string, unknown>)[modelKey] as
        | { deleteMany?: () => Promise<unknown> }
        | undefined;
      if (delegate?.deleteMany) {
        await delegate.deleteMany();
      }
    }
  }
}
