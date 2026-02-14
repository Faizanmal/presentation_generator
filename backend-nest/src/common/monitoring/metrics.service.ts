import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Registry, Histogram, Counter, Gauge } from 'prom-client';

// Dynamic imports for prom-client
let promClient: typeof import('prom-client') | null = null;

export interface MetricLabels {
  [key: string]: string;
}

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  private initialized = false;
  private registry: Registry | null = null;

  // Pre-defined metrics
  private httpRequestDuration: Histogram | null = null;
  private httpRequestTotal: Counter | null = null;
  private emailSentTotal: Counter | null = null;
  private emailFailedTotal: Counter | null = null;
  private otpRequestedTotal: Counter | null = null;
  private otpVerifiedTotal: Counter | null = null;
  private otpFailedTotal: Counter | null = null;
  private activeConnections: Gauge | null = null;
  private queueJobsTotal: Counter | null = null;
  private queueJobDuration: Histogram | null = null;
  private redisCommandDuration: Histogram | null = null;
  private dbQueryDuration: Histogram | null = null;
  private memoryUsage: Gauge | null = null;
  private cpuUsage: Gauge | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const enabled =
      this.configService.get<string>('METRICS_ENABLED') !== 'false';

    if (!enabled) {
      this.logger.log('Prometheus metrics disabled (METRICS_ENABLED=false)');
      return;
    }

    try {
      promClient = await import('prom-client');
      this.registry = new promClient.Registry();

      // Add default metrics (CPU, memory, event loop, etc.)
      promClient.collectDefaultMetrics({ register: this.registry });

      this.initializeMetrics();

      this.initialized = true;
      this.logger.log('✓ Prometheus metrics initialized');
    } catch (error) {
      this.logger.warn(
        `⚠ Prometheus metrics not available: ${error.message}. Install prom-client for metrics.`,
      );
    }
  }

  private initializeMetrics() {
    if (!promClient || !this.registry) return; // guard prom-client and registry presence

    // ─── HTTP Metrics ──────────────────────────────────────
    this.httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.httpRequestTotal = new promClient.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // ─── Email Metrics ─────────────────────────────────────
    this.emailSentTotal = new promClient.Counter({
      name: 'email_sent_total',
      help: 'Total emails sent',
      labelNames: ['type', 'provider'],
      registers: [this.registry],
    });

    this.emailFailedTotal = new promClient.Counter({
      name: 'email_failed_total',
      help: 'Total emails that failed to send',
      labelNames: ['type', 'provider', 'error'],
      registers: [this.registry],
    });

    // ─── OTP Metrics ──────────────────────────────────────
    this.otpRequestedTotal = new promClient.Counter({
      name: 'otp_requested_total',
      help: 'Total OTP codes requested',
      labelNames: ['channel', 'purpose'],
      registers: [this.registry],
    });

    this.otpVerifiedTotal = new promClient.Counter({
      name: 'otp_verified_total',
      help: 'Total OTP codes successfully verified',
      labelNames: ['channel', 'purpose'],
      registers: [this.registry],
    });

    this.otpFailedTotal = new promClient.Counter({
      name: 'otp_failed_total',
      help: 'Total OTP verification failures',
      labelNames: ['channel', 'purpose', 'reason'],
      registers: [this.registry],
    });

    // ─── Connection Metrics ────────────────────────────────
    this.activeConnections = new promClient.Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
      labelNames: ['type'],
      registers: [this.registry],
    });

    // ─── Queue Metrics ─────────────────────────────────────
    this.queueJobsTotal = new promClient.Counter({
      name: 'queue_jobs_total',
      help: 'Total jobs processed by queue',
      labelNames: ['queue', 'status'],
      registers: [this.registry],
    });

    this.queueJobDuration = new promClient.Histogram({
      name: 'queue_job_duration_seconds',
      help: 'Duration of queue job processing in seconds',
      labelNames: ['queue', 'job_name'],
      buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
      registers: [this.registry],
    });

    // ─── Infrastructure Metrics ────────────────────────────
    this.redisCommandDuration = new promClient.Histogram({
      name: 'redis_command_duration_seconds',
      help: 'Duration of Redis commands in seconds',
      labelNames: ['command'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });

    this.dbQueryDuration = new promClient.Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'model'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });
  }

  // ─── HTTP Metrics ──────────────────────────────────────────
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
  ): void {
    if (!this.initialized) return;
    this.httpRequestTotal!.inc({
      method,
      route,
      status_code: statusCode.toString(),
    });
    this.httpRequestDuration!.observe(
      { method, route, status_code: statusCode.toString() },
      durationMs / 1000,
    );
  }

  // ─── Email Metrics ─────────────────────────────────────────
  recordEmailSent(type: string, provider: string): void {
    if (!this.initialized) return;
    this.emailSentTotal!.inc({ type, provider });
  }

  recordEmailFailed(type: string, provider: string, error: string): void {
    if (!this.initialized) return;
    this.emailFailedTotal!.inc({
      type,
      provider,
      error: error.substring(0, 50),
    });
  }

  // ─── OTP Metrics ───────────────────────────────────────────
  recordOtpRequested(channel: string, purpose: string): void {
    if (!this.initialized) return;
    this.otpRequestedTotal!.inc({ channel, purpose });
  }

  recordOtpVerified(channel: string, purpose: string): void {
    if (!this.initialized) return;
    this.otpVerifiedTotal!.inc({ channel, purpose });
  }

  recordOtpFailed(channel: string, purpose: string, reason: string): void {
    if (!this.initialized) return;
    this.otpFailedTotal!.inc({ channel, purpose, reason });
  }

  // ─── Queue Metrics ─────────────────────────────────────────
  recordQueueJob(queue: string, status: 'completed' | 'failed'): void {
    if (!this.initialized) return;
    this.queueJobsTotal!.inc({ queue, status });
  }

  recordQueueJobDuration(
    queue: string,
    jobName: string,
    durationMs: number,
  ): void {
    if (!this.initialized) return;
    this.queueJobDuration!.observe(
      { queue, job_name: jobName },
      durationMs / 1000,
    );
  }

  // ─── Connection Metrics ────────────────────────────────────
  setActiveConnections(type: string, count: number): void {
    if (!this.initialized) return;
    this.activeConnections!.set({ type }, count);
  }

  // ─── Infrastructure ────────────────────────────────────────
  recordRedisCommand(command: string, durationMs: number): void {
    if (!this.initialized) return;
    this.redisCommandDuration!.observe({ command }, durationMs / 1000);
  }

  recordDbQuery(operation: string, model: string, durationMs: number): void {
    if (!this.initialized) return;
    this.dbQueryDuration!.observe({ operation, model }, durationMs / 1000);
  }

  // ─── Get Metrics Output ────────────────────────────────────

  async getMetrics(): Promise<string> {
    if (!this.initialized || !this.registry) {
      return '# Metrics not available\n';
    }
    return this.registry.metrics();
  }

  async getMetricsAsJson(): Promise<unknown[]> {
    if (!this.initialized || !this.registry) {
      return [];
    }
    return this.registry.getMetricsAsJSON();
  }

  get isInitialized(): boolean {
    return this.initialized;
  }
}
