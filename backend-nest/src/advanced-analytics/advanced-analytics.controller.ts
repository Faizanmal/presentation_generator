import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdvancedAnalyticsService } from './advanced-analytics.service';
import {
  AudienceInsightsService,
  AudienceSegment,
} from './audience-insights.service';
import { PredictiveAnalyticsService } from './predictive-analytics.service';

@ApiTags('Advanced Analytics')
@ApiBearerAuth()
@Controller('api/analytics')
@UseGuards(JwtAuthGuard)
export class AdvancedAnalyticsController {
  constructor(
    private readonly analyticsService: AdvancedAnalyticsService,
    private readonly audienceService: AudienceInsightsService,
    private readonly predictiveService: PredictiveAnalyticsService,
  ) {}

  // ============================================
  // DASHBOARD & OVERVIEW
  // ============================================

  @Get('dashboard')
  @ApiOperation({ summary: 'Get analytics dashboard' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['day', 'week', 'month', 'year'],
  })
  @ApiQuery({ name: 'organizationId', required: false })
  async getDashboard(
    @Query('period') period?: 'day' | 'week' | 'month' | 'year',
    @Query('organizationId') organizationId?: string,
    @Request() req?,
  ) {
    return this.analyticsService.getDashboard(req.user.id, {
      period,
      organizationId,
    });
  }

  @Get('content-performance')
  @ApiOperation({ summary: 'Get content performance metrics' })
  @ApiQuery({
    name: 'groupBy',
    required: false,
    enum: ['presentation', 'slide', 'block'],
  })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month'] })
  async getContentPerformance(
    @Query('groupBy') groupBy?: 'presentation' | 'slide' | 'block',
    @Query('period') period?: 'day' | 'week' | 'month',
    @Request() req?,
  ) {
    return this.analyticsService.getContentPerformance(req.user.id, {
      groupBy,
      period,
    });
  }

  @Post('compare')
  @ApiOperation({ summary: 'Compare multiple presentations' })
  async comparePresentations(@Body() body: { presentationIds: string[] }) {
    return this.analyticsService.comparePresentations(body.presentationIds);
  }

  // ============================================
  // AUDIENCE INSIGHTS
  // ============================================

  @Get('presentations/:id/audience')
  @ApiOperation({ summary: 'Get audience overview for a presentation' })
  @ApiParam({ name: 'id', description: 'Presentation ID' })
  async getAudienceOverview(@Param('id') presentationId: string) {
    return this.audienceService.getAudienceOverview(presentationId);
  }

  @Get('presentations/:id/engagement-heatmap')
  @ApiOperation({ summary: 'Get slide engagement heatmap' })
  async getEngagementHeatmap(@Param('id') presentationId: string) {
    return this.audienceService.getSlideEngagementHeatmap(presentationId);
  }

  @Get('presentations/:id/funnel')
  @ApiOperation({ summary: 'Get viewer funnel analysis' })
  async getViewerFunnel(@Param('id') presentationId: string) {
    return this.audienceService.getViewerFunnel(presentationId);
  }

  @Get('presentations/:id/realtime')
  @ApiOperation({ summary: 'Get real-time viewer activity' })
  async getRealTimeActivity(@Param('id') presentationId: string) {
    return this.audienceService.getRealTimeActivity(presentationId);
  }

  @Get('audience-growth')
  @ApiOperation({ summary: 'Get audience growth over time' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['day', 'week', 'month', 'year'],
  })
  @ApiQuery({ name: 'organizationId', required: false })
  async getAudienceGrowth(
    @Query('period') period?: 'day' | 'week' | 'month' | 'year',
    @Query('organizationId') organizationId?: string,
    @Request() req?,
  ) {
    return this.audienceService.getAudienceGrowth(
      organizationId || req.user.id,
      period,
    );
  }

  @Post('segments')
  @ApiOperation({ summary: 'Create audience segment' })
  async createSegment(
    @Body()
    body: {
      organizationId: string;
      name: string;
      criteria: AudienceSegment['criteria'];
    },
  ) {
    return this.audienceService.createSegment(body.organizationId, {
      name: body.name,
      criteria: body.criteria,
    });
  }

  @Get('segments')
  @ApiOperation({ summary: 'Get audience segments' })
  @ApiQuery({ name: 'organizationId', required: true })
  async getSegments(@Query('organizationId') organizationId: string) {
    return this.audienceService.getSegments(organizationId);
  }

  @Post('audience/compare')
  @ApiOperation({ summary: 'Compare audience across presentations' })
  async compareAudiences(@Body() body: { presentationIds: string[] }) {
    return this.audienceService.compareAudiences(body.presentationIds);
  }

  // ============================================
  // PREDICTIVE ANALYTICS
  // ============================================

  @Get('presentations/:id/predict-engagement')
  @ApiOperation({ summary: 'Predict engagement for a presentation' })
  async predictEngagement(@Param('id') presentationId: string) {
    return this.predictiveService.predictEngagement(presentationId);
  }

  @Get('presentations/:id/anomalies')
  @ApiOperation({ summary: 'Detect anomalies in viewing patterns' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async detectAnomalies(
    @Param('id') presentationId: string,
    @Query('days') days?: string,
  ) {
    return this.predictiveService.detectAnomalies(
      presentationId,
      days ? parseInt(days) : 30,
    );
  }

  @Get('presentations/:id/forecast')
  @ApiOperation({ summary: 'Forecast future metrics' })
  @ApiQuery({
    name: 'metric',
    required: true,
    enum: ['views', 'engagement', 'shares'],
  })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async forecastMetrics(
    @Param('id') presentationId: string,
    @Query('metric') metric: 'views' | 'engagement' | 'shares',
    @Query('days') days?: string,
  ) {
    return this.predictiveService.forecastMetrics(
      presentationId,
      metric,
      days ? parseInt(days) : 30,
    );
  }

  @Get('optimal-times')
  @ApiOperation({ summary: 'Get optimal publishing times' })
  @ApiQuery({ name: 'organizationId', required: false })
  async getOptimalPublishingTimes(
    @Query('organizationId') organizationId?: string,
    @Request() req?,
  ) {
    return this.predictiveService.getOptimalPublishingTimes(
      organizationId || req.user.id,
    );
  }

  @Get('ab-tests/:testId/results')
  @ApiOperation({ summary: 'Analyze A/B test results' })
  async analyzeABTest(@Param('testId') testId: string) {
    return this.predictiveService.analyzeABTestResults(testId);
  }

  // ============================================
  // REPORTS & EXPORTS
  // ============================================

  @Post('reports/export')
  @ApiOperation({ summary: 'Export analytics report' })
  async exportReport(
    @Body()
    body: {
      presentationIds?: string[];
      period?: { start: string; end: string };
      format: 'pdf' | 'csv' | 'json';
      includeCharts?: boolean;
    },
    @Request() req,
  ) {
    return this.analyticsService.exportReport(req.user.id, {
      ...body,
      period: body.period
        ? { start: new Date(body.period.start), end: new Date(body.period.end) }
        : undefined,
    });
  }

  @Get('reports/:reportId/status')
  @ApiOperation({ summary: 'Get report status' })
  async getReportStatus(@Param('reportId') reportId: string) {
    return this.analyticsService.getReportStatus(reportId);
  }

  // ============================================
  // EVENT TRACKING
  // ============================================

  @Post('presentations/:id/events')
  @ApiOperation({ summary: 'Track custom event' })
  async trackEvent(
    @Param('id') presentationId: string,
    @Body()
    event: {
      type: string;
      viewerId?: string;
      sessionId: string;
      slideNumber?: number;
      metadata?: Record<string, unknown>;
    },
  ) {
    await this.analyticsService.trackEvent(presentationId, event);
    return { success: true };
  }

  // ============================================
  // COMPETITIVE ANALYSIS
  // ============================================

  @Get('share-of-voice')
  @ApiOperation({ summary: 'Get share of voice analysis' })
  @ApiQuery({ name: 'organizationId', required: true })
  getShareOfVoice(@Query('organizationId') organizationId: string) {
    return this.analyticsService.getShareOfVoice(organizationId);
  }
}
