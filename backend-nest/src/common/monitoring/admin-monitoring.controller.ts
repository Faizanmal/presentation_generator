import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EmailTrackingService } from '../../email/email-tracking.service';
import { OtpMetricsService } from '../../otp/otp-metrics.service';
import { EmailProviderService } from '../../email/email-provider.service';
import { EmailService } from '../../email/email.service';

@Controller('admin/monitoring')
@UseGuards(JwtAuthGuard)
export class AdminMonitoringController {
  constructor(
    private readonly emailTracking: EmailTrackingService,
    private readonly otpMetrics: OtpMetricsService,
    private readonly emailProvider: EmailProviderService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * GET /admin/monitoring/dashboard
   * Comprehensive monitoring dashboard data
   */
  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  async getDashboard(): Promise<Record<string, unknown>> {
    const [emailStats, otpStats, queueStats, providerHealth] =
      await Promise.all([
        Promise.resolve(this.emailTracking.getStats()),
        Promise.resolve(this.otpMetrics.getMetrics()),
        Promise.resolve(this.emailService.getQueueStats()),
        Promise.resolve(this.emailProvider.getProviderHealthStatus()),
      ]);

    return {
      timestamp: new Date().toISOString(),
      email: {
        stats: emailStats,
        queue: queueStats,
        providers: providerHealth,
      },
      otp: otpStats,
    };
  }

  /**
   * GET /admin/monitoring/email/stats
   * Email delivery statistics
   */
  @Get('email/stats')
  @HttpCode(HttpStatus.OK)
  async getEmailStats(@Query('date') date?: string) {
    return this.emailTracking.getStats(date);
  }

  /**
   * GET /admin/monitoring/email/daily
   * Email daily stats for charts
   */
  @Get('email/daily')
  @HttpCode(HttpStatus.OK)
  async getEmailDailyStats(@Query('days') days?: string) {
    return this.emailTracking.getDailyStats(days ? parseInt(days) : 30);
  }

  /**
   * GET /admin/monitoring/email/recipient
   * Email history for a specific recipient
   */
  @Get('email/recipient')
  @HttpCode(HttpStatus.OK)
  async getRecipientHistory(
    @Query('email') email: string,
    @Query('limit') limit?: string,
  ) {
    return this.emailTracking.getRecipientHistory(
      email,
      limit ? parseInt(limit) : 20,
    );
  }

  /**
   * GET /admin/monitoring/email/providers
   * Email provider health status
   */
  @Get('email/providers')
  @HttpCode(HttpStatus.OK)
  getProviderHealth(): unknown {
    return {
      providers: this.emailProvider.getProviderHealthStatus(),
      activeCount: this.emailProvider.activeProviderCount,
    };
  }

  /**
   * GET /admin/monitoring/email/queue
   * Email queue status
   */
  @Get('email/queue')
  @HttpCode(HttpStatus.OK)
  async getQueueStats() {
    return this.emailService.getQueueStats();
  }

  /**
   * GET /admin/monitoring/otp/stats
   * OTP metrics
   */
  @Get('otp/stats')
  @HttpCode(HttpStatus.OK)
  async getOtpStats() {
    return this.otpMetrics.getMetrics();
  }

  /**
   * GET /admin/monitoring/otp/daily
   * OTP daily stats for charts
   */
  @Get('otp/daily')
  @HttpCode(HttpStatus.OK)
  async getOtpDailyStats(@Query('days') days?: string) {
    return this.otpMetrics.getDailyStats(days ? parseInt(days) : 30);
  }

  /**
   * GET /admin/monitoring/otp/recent
   * Recent OTP events
   */
  @Get('otp/recent')
  @HttpCode(HttpStatus.OK)
  async getRecentOtpEvents(@Query('limit') limit?: string) {
    return this.otpMetrics.getRecentEvents(limit ? parseInt(limit) : 20);
  }
}
