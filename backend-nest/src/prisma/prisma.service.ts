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
    let connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error('Missing DATABASE_URL environment variable');
      throw new Error('DATABASE_URL must be set');
    }

    // Automatically append sslmode=require for production environments if not present
    // This resolves P1001 errors on Railway/managed Postgres providers
    if (
      process.env.NODE_ENV === 'production' &&
      !connectionString.includes('sslmode=') &&
      !connectionString.includes('localhost') &&
      !connectionString.includes('127.0.0.1')
    ) {
      connectionString += connectionString.includes('?') ? '&' : '?';
      connectionString += 'sslmode=require&uselibpqcompat=true';
    }

    const isProd = process.env.NODE_ENV === 'production';
    const isSupabase = connectionString.includes('supabase.com') || connectionString.includes('supabase.co');

    const pool = new Pool({
      connectionString,
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      min: parseInt(process.env.DB_POOL_MIN || '0', 10),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(
        process.env.DB_CONNECTION_TIMEOUT || '10000',
        10,
      ),
      // Fix for 'self-signed certificate in certificate chain' on Supabase/Railway
      ssl: (isProd || isSupabase) ? { rejectUnauthorized: false } : undefined,
    });

    // surface low‑level errors from the pg pool so they show up in our logs
    pool.on('error', (err) => {
      this.logger.error('Postgres pool error', err as unknown);
    });

    const adapter = new PrismaPg(pool);

    // Decide which Prisma events to log.  Previously we always enabled
    // `query` logging in development which produced a flood of
    // `prisma:query` messages (e.g. pg_stat_activity checks) even when
    // the rest of the app was running at WARN level.  Those lines don't go
    // through our Winston logger and are noisy during normal use.
    //
    // The new behaviour maps the generic LOG_LEVEL environment variable
    // (used by Winston) to the Prisma log configuration.  Only when
    // LOG_LEVEL is `info` or `debug` will we ask Prisma to emit query
    // events; otherwise only errors are logged.  A separate flag
    // PRISMA_LOG_QUERIES=true can be used to override if needed.
    const logLevel = (process.env.LOG_LEVEL || 'warn').toLowerCase();
    const log: Array<'query' | 'info' | 'warn' | 'error'> = ['error'];

    if (['info', 'debug'].includes(logLevel)) {
      log.push('info', 'warn');
      if (process.env.PRISMA_LOG_QUERIES === 'true') {
        log.push('query');
      }
    }

    super({
      adapter,
      log,
    });

    if (!connectionString) {
      this.logger.warn('DATABASE_URL is not set');
    }

    // log any Prisma‑level errors as well, this hooks the client engine events
    (this as PrismaClient).$on('error' as never, (e: unknown) => {
      this.logger.error(
        `Prisma error: ${(e as { message: string }).message}`,
        e,
      );
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
