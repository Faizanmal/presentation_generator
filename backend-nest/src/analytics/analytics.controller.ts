import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Headers,
  Ip,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
// import { CacheMedium, CacheLong } from '../common/decorators/cache.decorator';

// DTO for tracking
class StartViewDto {
  projectId: string;
  sessionId: string;
}

class TrackSlideDto {
  presentationViewId: string;
  slideId: string;
  slideIndex: number;
}

class TrackHeatmapDto {
  projectId: string;
  slideId: string;
  x: number;
  y: number;
}

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ============================================
  // PUBLIC TRACKING ENDPOINTS (no auth required for viewers)
  // ============================================

  /**
   * Start tracking a presentation view
   * Called when a viewer opens a shared presentation
   */
  @Post('track/view/start')
  async startView(
    @Body() dto: StartViewDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
    @Headers('referer') referrer: string,
    @Request() req: { user?: { id: string } },
  ) {
    const viewerId = req.user?.id; // May be undefined for anonymous viewers

    return this.analyticsService.startView({
      projectId: dto.projectId,
      viewerId,
      sessionId: dto.sessionId,
      ipAddress,
      userAgent,
      referrer,
    });
  }

  /**
   * End tracking a presentation view
   */
  @Post('track/view/:id/end')
  async endView(@Param('id') id: string) {
    return this.analyticsService.endView(id);
  }

  /**
   * Track when viewer enters a slide
   */
  @Post('track/slide/enter')
  async trackSlideEnter(@Body() dto: TrackSlideDto) {
    return this.analyticsService.trackSlideEnter(dto);
  }

  /**
   * Track when viewer exits a slide
   */
  @Post('track/slide/:id/exit')
  async trackSlideExit(@Param('id') id: string) {
    return this.analyticsService.trackSlideExit(id);
  }

  /**
   * Track slide interaction
   */
  @Post('track/slide/:id/interaction')
  async trackInteraction(@Param('id') id: string) {
    return this.analyticsService.trackSlideInteraction(id);
  }

  /**
   * Track heatmap click
   */
  @Post('track/heatmap')
  async trackHeatmap(@Body() dto: TrackHeatmapDto) {
    return this.analyticsService.trackHeatmapClick(dto);
  }

  // ============================================
  // PROTECTED ANALYTICS ENDPOINTS (auth required)
  // ============================================

  /**
   * Get analytics summary for a project
   */
  @Get(':projectId/summary')
  @UseGuards(JwtAuthGuard)
  async getAnalyticsSummary(
    @Param('projectId') projectId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getAnalyticsSummary(
      projectId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Get heatmap data for a specific slide
   */
  @Get(':projectId/slides/:slideId/heatmap')
  @UseGuards(JwtAuthGuard)
  async getSlideHeatmap(
    @Param('projectId') projectId: string,
    @Param('slideId') slideId: string,
  ) {
    return this.analyticsService.getSlideHeatmap(projectId, slideId);
  }

  /**
   * Get real-time active viewers for a project
   */
  @Get(':projectId/active-viewers')
  @UseGuards(JwtAuthGuard)
  async getActiveViewers(@Param('projectId') projectId: string) {
    return this.analyticsService.getActiveViewers(projectId);
  }

  /**
   * Get slide-by-slide performance metrics
   */
  @Get(':projectId/slides/performance')
  @UseGuards(JwtAuthGuard)
  async getSlidePerformance(
    @Param('projectId') projectId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getSlidePerformance(
      projectId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Get viewer sessions for a project
   */
  @Get(':projectId/viewer-sessions')
  @UseGuards(JwtAuthGuard)
  async getViewerSessions(
    @Param('projectId') projectId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.getViewerSessions(
      projectId,
      parseInt(page || '1', 10),
      parseInt(limit || '20', 10),
    );
  }

  /**
   * Get overall presentation stats
   */
  @Get(':projectId/stats')
  @UseGuards(JwtAuthGuard)
  async getPresentationStats(@Param('projectId') projectId: string) {
    return this.analyticsService.getPresentationStats(projectId);
  }

  /**
   * Get AI-powered insights for analytics data
   */
  @Get(':projectId/ai-insights')
  @UseGuards(JwtAuthGuard)
  async getAIInsights(
    @Param('projectId') projectId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const summary = await this.analyticsService.getAnalyticsSummary(
      projectId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    return {
      insights: summary.insights,
      generatedAt: new Date().toISOString(),
      dataRange: {
        start:
          startDate ||
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: endDate || new Date().toISOString(),
      },
    };
  }

  /**
   * Get structured AI insights with full detail including type, priority, and actionable recommendations
   */
  @Get(':projectId/ai-insights/structured')
  @UseGuards(JwtAuthGuard)
  async getStructuredInsights(@Param('projectId') projectId: string) {
    const insights =
      await this.analyticsService.getStructuredInsights(projectId);
    return {
      insights,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get predictive analytics - forecast future performance
   */
  @Get(':projectId/predictive')
  @UseGuards(JwtAuthGuard)
  async getPredictiveAnalytics(
    @Param('projectId') projectId: string,
    @Query('days') days?: string,
  ) {
    return this.analyticsService.getPredictiveAnalytics(
      projectId,
      parseInt(days || '30', 10),
    );
  }

  /**
   * Get real-time engagement metrics
   */
  @Get(':projectId/real-time')
  @UseGuards(JwtAuthGuard)
  async getRealTimeMetrics(@Param('projectId') projectId: string) {
    return this.analyticsService.getRealTimeMetrics(projectId);
  }

  /**
   * Get audience segmentation insights
   */
  @Get(':projectId/audience-segments')
  @UseGuards(JwtAuthGuard)
  async getAudienceSegments(@Param('projectId') projectId: string) {
    return this.analyticsService.getAudienceSegments(projectId);
  }

  /**
   * Get content optimization suggestions with AI
   */
  @Post(':projectId/optimize-content')
  @UseGuards(JwtAuthGuard)
  async getContentOptimization(
    @Param('projectId') projectId: string,
    @Body() body: { slideId?: string },
  ) {
    return this.analyticsService.getContentOptimization(
      projectId,
      body.slideId,
    );
  }

  /**
   * Get detailed AI recommendations for improving presentation
   */
  @Post(':projectId/ai-recommendations')
  @UseGuards(JwtAuthGuard)
  async getAIRecommendations(
    @Param('projectId') projectId: string,
    @Body() body: { presentationContent?: Record<string, unknown> },
  ) {
    return this.analyticsService.generateDetailedRecommendations(
      projectId,
      body.presentationContent,
    );
  }

  /**
   * Export analytics data
   */
  @Get(':projectId/export')
  @UseGuards(JwtAuthGuard)
  async exportAnalytics(
    @Param('projectId') projectId: string,
    @Query('format') format: 'json' | 'csv' = 'json',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.exportAnalyticsData(
      projectId,
      format,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
