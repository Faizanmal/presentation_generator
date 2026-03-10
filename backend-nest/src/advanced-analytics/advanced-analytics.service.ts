import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AudienceInsightsService } from './audience-insights.service';
import { PredictiveAnalyticsService } from './predictive-analytics.service';

export interface AnalyticsDashboard {
  overview: {
    totalPresentations: number;
    totalViews: number;
    avgEngagement: number;
    topPerformer: { id: string; title: string; views: number } | null;
  };
  trends: {
    viewsTrend: Array<{ date: string; views: number }>;
    engagementTrend: Array<{ date: string; engagement: number }>;
  };
  insights: Array<{
    type: 'success' | 'warning' | 'info';
    message: string;
    metric?: string;
    action?: string;
  }>;
}

export interface ComparisonResult {
  presentations: Array<{
    id: string;
    title: string;
    metrics: Record<string, number>;
  }>;
  bestPerformer: { metric: string; presentationId: string };
  insights: string[];
}

@Injectable()
export class AdvancedAnalyticsService {
  private readonly logger = new Logger(AdvancedAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audienceService: AudienceInsightsService,
    private readonly predictiveService: PredictiveAnalyticsService,
    @InjectQueue('analytics-processing') private analyticsQueue: Queue,
  ) {}

  /**
   * Get comprehensive analytics dashboard
   */
  async getDashboard(
    userId: string,
    options: {
      period?: 'day' | 'week' | 'month' | 'year';
      organizationId?: string;
    } = {},
  ): Promise<AnalyticsDashboard> {
    const periodDays = { day: 1, week: 7, month: 30, year: 365 };
    const days = periodDays[options.period || 'month'];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get overview
    const presentations = await this.prisma.project.findMany({
      where: {
        ownerId: userId,
      },
      include: {
        views: {
          where: { viewedAt: { gte: startDate } },
        },
      },
    });

    const totalPresentations = presentations.length;
    const totalViews = presentations.reduce(
      (acc, p) => acc + p.views.length,
      0,
    );

    // Calculate average engagement
    const allViews = presentations.flatMap((p) => p.views);
    const avgEngagement =
      allViews.length > 0
        ? Math.round(
            allViews.reduce((acc, v) => acc + (v.completionRate || 0), 0) /
              allViews.length,
          )
        : 0;

    // Find top performer
    const presWithViews = presentations
      .map((p) => ({
        id: p.id,
        title: p.title || 'Untitled',
        views: p.views.length,
      }))
      .sort((a, b) => b.views - a.views);

    const topPerformer = presWithViews[0] || null;

    // Get trends
    const viewsTrend = await this.getViewsTrend(userId, startDate);
    const engagementTrend = await this.getEngagementTrend(userId, startDate);

    // Generate insights
    const validViews = allViews.filter(
      (v) => v.viewedAt !== null && v.completionRate !== null,
    ) as Array<{ viewedAt: Date; completionRate?: number }>;

    const insights = this.generateDashboardInsights(
      userId,
      presentations,
      validViews,
      startDate,
    );

    return {
      overview: {
        totalPresentations,
        totalViews,
        avgEngagement,
        topPerformer,
      },
      trends: {
        viewsTrend,
        engagementTrend,
      },
      insights,
    };
  }

  private async getViewsTrend(
    userId: string,
    since: Date,
  ): Promise<Array<{ date: string; views: number }>> {
    const views = await this.prisma.presentationView.findMany({
      where: {
        project: { ownerId: userId },
        viewedAt: { gte: since },
      },
      select: { viewedAt: true },
    });

    const dailyCounts: Record<string, number> = {};
    views.forEach((v) => {
      const date = v.viewedAt!.toISOString().split('T')[0];
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });

    return Object.entries(dailyCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, views]) => ({ date, views }));
  }

  private async getEngagementTrend(
    userId: string,
    since: Date,
  ): Promise<Array<{ date: string; engagement: number }>> {
    const views = await this.prisma.presentationView.findMany({
      where: {
        project: { ownerId: userId },
        viewedAt: { gte: since },
      },
      select: { viewedAt: true, completionRate: true },
    });

    const dailyEngagement: Record<string, { total: number; count: number }> =
      {};
    views.forEach((v) => {
      const date = v.viewedAt!.toISOString().split('T')[0];
      if (!dailyEngagement[date]) {
        dailyEngagement[date] = { total: 0, count: 0 };
      }
      dailyEngagement[date].total += v.completionRate || 0;
      dailyEngagement[date].count++;
    });

    return Object.entries(dailyEngagement)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        engagement: Math.round(stats.total / stats.count),
      }));
  }

  private generateDashboardInsights(
    _userId: string,
    presentations: Array<{
      id: string;
      title?: string | null;
      views: unknown[];
    }>,
    views: Array<{ viewedAt: Date; completionRate?: number }>,
    since: Date,
  ): AnalyticsDashboard['insights'] {
    const insights: AnalyticsDashboard['insights'] = [];

    // Check for growth
    const midPoint = new Date((since.getTime() + Date.now()) / 2);
    const firstHalfViews = views.filter((v) => v.viewedAt < midPoint).length;
    const secondHalfViews = views.filter((v) => v.viewedAt >= midPoint).length;

    if (secondHalfViews > firstHalfViews * 1.2) {
      insights.push({
        type: 'success',
        message: `Views are up ${Math.round(((secondHalfViews - firstHalfViews) / Math.max(firstHalfViews, 1)) * 100)}% compared to the previous period`,
        metric: 'views',
      });
    } else if (secondHalfViews < firstHalfViews * 0.8) {
      insights.push({
        type: 'warning',
        message: `Views have decreased by ${Math.round(((firstHalfViews - secondHalfViews) / Math.max(firstHalfViews, 1)) * 100)}%`,
        metric: 'views',
        action: 'Consider sharing your presentations more actively',
      });
    }

    // Check engagement
    const avgCompletion =
      views.length > 0
        ? views.reduce((acc, v) => acc + (v.completionRate || 0), 0) /
          views.length
        : 0;

    if (avgCompletion > 75) {
      insights.push({
        type: 'success',
        message: 'Excellent engagement! Average completion rate is above 75%',
        metric: 'engagement',
      });
    } else if (avgCompletion < 40) {
      insights.push({
        type: 'warning',
        message:
          'Low engagement detected. Consider shorter presentations or more interactive content',
        metric: 'engagement',
        action: 'Add interactive elements or shorten content',
      });
    }

    // Check for unused presentations
    const unusedPresentations = presentations.filter(
      (p) => p.views.length === 0,
    );
    if (unusedPresentations.length > 3) {
      insights.push({
        type: 'info',
        message: `${unusedPresentations.length} presentations haven't been viewed yet`,
        action: 'Share them to increase visibility',
      });
    }

    return insights;
  }

  /**
   * Compare multiple presentations
   */
  async comparePresentations(
    presentationIds: string[],
  ): Promise<ComparisonResult> {
    const presentations = await this.prisma.project.findMany({
      where: { id: { in: presentationIds } },
      include: {
        views: true,
        slides: true,
      },
    });

    const results = presentations.map((p) => {
      const views = p.views.length;
      const avgEngagement =
        views > 0
          ? Math.round(
              p.views.reduce((acc, v) => acc + (v.completionRate || 0), 0) /
                views,
            )
          : 0;
      const avgDuration =
        views > 0
          ? Math.round(
              p.views.reduce((acc, v) => acc + (v.duration || 0), 0) / views,
            )
          : 0;
      const shareRate =
        views > 0
          ? Math.round((p.views.filter((v) => v.shared).length / views) * 100)
          : 0;

      return {
        id: p.id,
        title: p.title || 'Untitled',
        metrics: {
          views,
          avgEngagement,
          avgDuration,
          shareRate,
          slideCount: p.slides.length,
        },
      };
    });

    // Find best performer by views
    const bestByViews = [...results].sort(
      (a, b) => b.metrics.views - a.metrics.views,
    )[0];

    // Generate insights
    const insights: string[] = [];

    if (results.length >= 2) {
      const [first, second] = results.sort(
        (a, b) => b.metrics.avgEngagement - a.metrics.avgEngagement,
      );
      if (first.metrics.avgEngagement > second.metrics.avgEngagement * 1.2) {
        insights.push(
          `"${first.title}" has significantly higher engagement (${first.metrics.avgEngagement}%) than others`,
        );
      }

      const avgSlides =
        results.reduce((acc, r) => acc + r.metrics.slideCount, 0) /
        results.length;
      const bestEngagement = results.sort(
        (a, b) => b.metrics.avgEngagement - a.metrics.avgEngagement,
      )[0];
      if (bestEngagement.metrics.slideCount < avgSlides * 0.8) {
        insights.push(
          'Shorter presentations tend to have higher engagement in your content',
        );
      }
    }

    return {
      presentations: results,
      bestPerformer: {
        metric: 'views',
        presentationId: bestByViews?.id || '',
      },
      insights,
    };
  }

  /**
   * Export analytics report
   */
  async exportReport(
    userId: string,
    options: {
      presentationIds?: string[];
      period?: { start: Date; end: Date };
      format: 'pdf' | 'csv' | 'json';
      includeCharts?: boolean;
    },
  ): Promise<{ reportId: string; status: 'processing' }> {
    const reportId = `report-${Date.now()}`;

    await this.analyticsQueue.add('generate-report', {
      reportId,
      userId,
      ...options,
    });

    return { reportId, status: 'processing' };
  }

  /**
   * Get report status
   */
  async getReportStatus(reportId: string): Promise<{
    status: 'processing' | 'ready' | 'failed';
    downloadUrl?: string;
  }> {
    const report = await this.prisma.analyticsReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return { status: 'processing' };
    }

    return {
      status: report.status as 'processing' | 'ready' | 'failed',
      downloadUrl: report.downloadUrl ?? undefined,
    };
  }

  /**
   * Track custom event
   */
  async trackEvent(
    presentationId: string,
    event: {
      type: string;
      viewerId?: string;
      sessionId: string;
      slideNumber?: number;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    await this.prisma.viewerEvent.create({
      data: {
        presentationId,
        eventType: event.type,
        viewerId: event.viewerId,
        sessionId: event.sessionId,
        slideNumber: event.slideNumber,
        metadata: event.metadata
          ? JSON.parse(JSON.stringify(event.metadata))
          : {},
      },
    });
  }

  /**
   * Get content performance metrics
   */
  async getContentPerformance(
    userId: string,
    options: {
      groupBy?: 'presentation' | 'slide' | 'block';
      period?: 'day' | 'week' | 'month';
    } = {},
  ): Promise<
    Array<{
      id: string;
      name: string;
      views: number;
      avgEngagement: number;
      trend: 'up' | 'down' | 'stable';
    }>
  > {
    const periodDays = { day: 1, week: 7, month: 30 };
    const days = periodDays[options.period || 'month'];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const midDate = new Date(Date.now() - (days / 2) * 24 * 60 * 60 * 1000);

    if (options.groupBy === 'slide') {
      const slideAnalytics = await this.prisma.slideAnalytics.findMany({
        where: {
          project: { ownerId: userId },
          updatedAt: { gte: startDate },
        },
        orderBy: { avgTimeSpent: 'desc' },
        take: 20,
      });

      return slideAnalytics.map((s) => ({
        id: s.slideId,
        name: `Slide ${s.slideNumber}`,
        views: s.viewCount,
        avgEngagement: Math.round((1 - s.dropOffRate / 100) * 100),
        trend: 'stable' as const,
      }));
    }

    // Default: group by presentation
    const presentations = await this.prisma.project.findMany({
      where: { ownerId: userId },
      include: {
        views: {
          where: { viewedAt: { gte: startDate } },
          select: { viewedAt: true, completionRate: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    return presentations.map((p) => {
      const firstHalf = p.views.filter(
        (v) => v.viewedAt && v.viewedAt < midDate,
      );
      const secondHalf = p.views.filter(
        (v) => v.viewedAt && v.viewedAt >= midDate,
      );

      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (secondHalf.length > firstHalf.length * 1.1) trend = 'up';
      else if (secondHalf.length < firstHalf.length * 0.9) trend = 'down';

      const avgEngagement =
        p.views.length > 0
          ? Math.round(
              p.views.reduce((acc, v) => acc + (v.completionRate || 0), 0) /
                p.views.length,
            )
          : 0;

      return {
        id: p.id,
        name: p.title || 'Untitled',
        views: p.views.length,
        avgEngagement,
        trend,
      };
    });
  }

  /**
   * Get share of voice (competitive analysis placeholder)
   */
  getShareOfVoice(_organizationId: string): {
    yourShare: number;
    trend: 'up' | 'down' | 'stable';
    insights: string[];
  } {
    // Placeholder for competitive analysis
    // In production, this would compare against industry benchmarks
    return {
      yourShare: 15,
      trend: 'up',
      insights: [
        'Your content engagement is 23% above industry average',
        'Consider increasing publishing frequency to capture more market share',
      ],
    };
  }
}
