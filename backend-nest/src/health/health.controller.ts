import { Controller, Get, UseGuards } from '@nestjs/common';
import { HealthService } from './health.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PerformanceMonitoringService } from '../common/monitoring/performance-monitoring.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly performanceMonitoring: PerformanceMonitoringService,
  ) {}

  @Get()
  async checkHealth() {
    return this.healthService.getHealth();
  }

  @Get('liveness')
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('readiness')
  async readiness() {
    return this.healthService.checkReadiness();
  }

  @Get('metrics')
  @UseGuards(JwtAuthGuard)
  async getMetrics() {
    return this.performanceMonitoring.collectMetrics();
  }

  @Get('detailed')
  @UseGuards(JwtAuthGuard)
  async getDetailedHealth() {
    return this.performanceMonitoring.checkHealth();
  }

  @Get('scalability')
  @UseGuards(JwtAuthGuard)
  async getScalabilityReport() {
    return this.performanceMonitoring.getScalabilityReport();
  }
}
