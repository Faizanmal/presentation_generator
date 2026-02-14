import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SentryService } from './sentry.service';
import { MetricsService } from './metrics.service';

/**
 * Unified monitoring service that coordinates Sentry, Prometheus, and Datadog/Grafana
 * Use this as the single entry point for all monitoring operations
 */
@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringService.name);
  private datadogEnabled = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly sentry: SentryService,
    private readonly metrics: MetricsService,
  ) {}

  async onModuleInit() {
    this.datadogEnabled = !!this.configService.get<string>('DATADOG_API_KEY');

    const status = [
      `Sentry: ${this.sentry.isInitialized ? '✓' : '✗'}`,
      `Prometheus: ${this.metrics.isInitialized ? '✓' : '✗'}`,
      `Datadog: ${this.datadogEnabled ? '✓' : '✗'}`,
    ].join(' | ');

    this.logger.log(`Monitoring services: ${status}`);
  }

  // ─── Error Tracking ────────────────────────────────────────
  /**
   * Report an error to all monitoring systems
   */
  reportError(error: Error, context?: Record<string, unknown>): void {
    // Sentry
    this.sentry.captureException(error, context);

    // Log
    this.logger.error(`[MONITORED ERROR] ${error.message}`, error.stack);

    // Datadog (via StatsD or API)
    if (this.datadogEnabled) {
      this.sendDatadogEvent('error', error.message, context);
    }
  }

  // ─── Email Monitoring ──────────────────────────────────────
  /**
   * Track email operations across all monitoring systems
   */
  trackEmailSent(type: string, provider: string, recipient: string): void {
    this.metrics.recordEmailSent(type, provider);
    this.sentry.addBreadcrumb({
      category: 'email',
      message: `Email sent: ${type} via ${provider} → ${this.maskEmail(recipient)}`,
      level: 'info',
    });
  }

  trackEmailFailed(type: string, provider: string, error: string): void {
    this.metrics.recordEmailFailed(type, provider, error);
    this.sentry.captureMessage(
      `Email failed: ${type} via ${provider}: ${error}`,
      'warning',
      { type, provider },
    );
  }

  // ─── OTP Monitoring ────────────────────────────────────────
  trackOtpRequested(channel: string, purpose: string): void {
    this.metrics.recordOtpRequested(channel, purpose);
  }

  trackOtpVerified(channel: string, purpose: string): void {
    this.metrics.recordOtpVerified(channel, purpose);
  }

  trackOtpFailed(channel: string, purpose: string, reason: string): void {
    this.metrics.recordOtpFailed(channel, purpose, reason);

    // Alert on suspicious patterns
    if (reason === 'locked_out') {
      this.sentry.captureMessage(
        `OTP lockout triggered: channel=${channel}, purpose=${purpose}`,
        'warning',
      );
    }
  }

  // ─── HTTP Monitoring ───────────────────────────────────────
  trackHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
  ): void {
    this.metrics.recordHttpRequest(method, route, statusCode, durationMs);

    // Alert on slow requests
    if (durationMs > 5000) {
      this.sentry.addBreadcrumb({
        category: 'performance',
        message: `Slow request: ${method} ${route} took ${durationMs}ms`,
        level: 'warning',
        data: { durationMs, statusCode },
      });
    }
  }

  // ─── Queue Monitoring ──────────────────────────────────────
  trackQueueJob(
    queue: string,
    status: 'completed' | 'failed',
    durationMs?: number,
    jobName?: string,
  ): void {
    this.metrics.recordQueueJob(queue, status);
    if (durationMs && jobName) {
      this.metrics.recordQueueJobDuration(queue, jobName, durationMs);
    }
  }

  // ─── Infrastructure ────────────────────────────────────────
  trackRedisCommand(command: string, durationMs: number): void {
    this.metrics.recordRedisCommand(command, durationMs);
  }

  trackDbQuery(operation: string, model: string, durationMs: number): void {
    this.metrics.recordDbQuery(operation, model, durationMs);
  }

  // ─── User Context ──────────────────────────────────────────
  setUserContext(user: { id: string; email?: string }): void {
    this.sentry.setUser(user);
  }

  // ─── Metrics Endpoint ──────────────────────────────────────
  async getPrometheusMetrics(): Promise<string> {
    return this.metrics.getMetrics();
  }

  // ─── Health Check ──────────────────────────────────────────
  getMonitoringHealth(): {
    sentry: boolean;
    prometheus: boolean;
    datadog: boolean;
  } {
    return {
      sentry: this.sentry.isInitialized,
      prometheus: this.metrics.isInitialized,
      datadog: this.datadogEnabled,
    };
  }

  // ─── Datadog Integration ───────────────────────────────────
  private sendDatadogEvent(
    type: string,
    message: string,
    _context?: Record<string, unknown>,
  ): void {
    // Datadog events can be sent via StatsD protocol or their API
    // For production, install 'hot-shots' or 'datadog-metrics' package
    // This is a placeholder for the integration
    this.logger.debug(`[Datadog] ${type}: ${message}`);
  }

  // ─── Helpers ───────────────────────────────────────────────
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    return local.length <= 2
      ? local[0] + '***@' + domain
      : local[0] + '***' + local[local.length - 1] + '@' + domain;
  }
}
