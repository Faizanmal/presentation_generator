import { Controller, Get, Res, HttpCode, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { MonitoringService } from './monitoring.service';
import { MetricsService } from './metrics.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Prometheus metrics endpoint
   * GET /monitoring/metrics
   * Configured as the scrape target in Prometheus/Grafana
   */
  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  async getMetrics(@Res() res: Response) {
    const metrics = await this.monitoringService.getPrometheusMetrics();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  }

  /**
   * Health check endpoint for monitoring systems
   * GET /monitoring/health
   */
  @Get('health')
  getHealth() {
    const health = this.monitoringService.getMonitoringHealth();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      monitoring: health,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  /**
   * JSON format metrics for Datadog/custom dashboards
   * GET /monitoring/metrics/json
   */
  @Get('metrics/json')
  async getMetricsJson() {
    return {
      metrics: await this.metricsService.getMetricsAsJson(),
      timestamp: new Date().toISOString(),
    };
  }
}
