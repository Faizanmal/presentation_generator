import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Dynamic import for Sentry to handle case where it's not installed
let Sentry: typeof import('@sentry/node') | null = null;

@Injectable()
export class SentryService implements OnModuleInit {
  private readonly logger = new Logger(SentryService.name);
  private initialized = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const dsn = this.configService.get<string>('SENTRY_DSN');
    const enabled =
      this.configService.get<string>('SENTRY_ENABLED') !== 'false';

    if (!dsn || !enabled) {
      this.logger.log('Sentry is disabled (no DSN or SENTRY_ENABLED=false)');
      return;
    }

    try {
      Sentry = await import('@sentry/node');

      Sentry.init({
        dsn,
        environment:
          this.configService.get<string>('NODE_ENV') || 'development',
        release: this.configService.get<string>('APP_VERSION') || '1.0.0',
        tracesSampleRate: parseFloat(
          this.configService.get<string>('SENTRY_TRACES_SAMPLE_RATE') || '0.1',
        ),
        profilesSampleRate: parseFloat(
          this.configService.get<string>('SENTRY_PROFILES_SAMPLE_RATE') ||
            '0.1',
        ),
        integrations: [],
        beforeSend(event: any, hint?: any) {
          // Scrub sensitive data
          const evt = event as Record<string, any>;
          if (evt.request?.headers) {
            delete (evt.request.headers as Record<string, unknown>)[
              'authorization'
            ];
            delete (evt.request.headers as Record<string, unknown>)['cookie'];
          }
          return event;
        },
      });

      this.initialized = true;
      this.logger.log('✓ Sentry initialized successfully');
    } catch (error) {
      this.logger.warn(
        `⚠ Sentry not available: ${error.message}. Install @sentry/node for error tracking.`,
      );
    }
  }

  /**
   * Capture an exception in Sentry
   */
  captureException(error: Error, context?: Record<string, unknown>): void {
    if (!this.initialized || !Sentry) {
      this.logger.error(`[Sentry-fallback] ${error.message}`, error.stack);
      return;
    }

    const S = Sentry as any;
    S.withScope((scope: any) => {
      if (context) {
        scope.setExtras(context);
      }
      S.captureException(error);
    });
  }

  /**
   * Capture a message in Sentry
   */
  captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
    context?: Record<string, unknown>,
  ): void {
    if (!this.initialized || !Sentry) {
      this.logger.log(`[Sentry-fallback] ${level}: ${message}`);
      return;
    }

    const S = Sentry as any;
    S.withScope((scope: any) => {
      if (context) {
        scope.setExtras(context);
      }
      S.captureMessage(message, level);
    });
  }

  /**
   * Set user context
   */
  setUser(user: { id: string; email?: string; username?: string }): void {
    if (!this.initialized || !Sentry) return;
    (Sentry as any).setUser(user);
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb: {
    category: string;
    message: string;
    level?: 'debug' | 'info' | 'warning' | 'error';
    data?: Record<string, unknown>;
  }): void {
    if (!this.initialized || !Sentry) return;
    (Sentry as any).addBreadcrumb(breadcrumb);
  }

  /**
   * Start a transaction for tracing
   */
  startTransaction(name: string, op: string): unknown {
    if (!this.initialized || !Sentry) return null;
    return (Sentry as any).startInactiveSpan({ name, op });
  }

  get isInitialized(): boolean {
    return this.initialized;
  }
}
