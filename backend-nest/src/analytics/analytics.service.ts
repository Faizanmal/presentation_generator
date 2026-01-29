import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import OpenAI from 'openai';

interface TrackViewDto {
  projectId: string;
  viewerId?: string;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
}

interface TrackSlideViewDto {
  presentationViewId: string;
  slideId: string;
  slideIndex: number;
}

interface TrackHeatmapDto {
  projectId: string;
  slideId: string;
  x: number;
  y: number;
}

export interface AnalyticsSummary {
  totalViews: number;
  uniqueViews: number;
  averageDuration: number;
  completionRate: number;
  dropOffSlide: number | null;
  topSlides: Array<{
    slideIndex: number;
    averageDuration: number;
    viewCount: number;
  }>;
  viewsByDay: Array<{
    date: string;
    views: number;
    uniqueViews: number;
  }>;
  insights: string[];
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private openai: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  // ============================================
  // VIEW TRACKING
  // ============================================

  /**
   * Start tracking a new presentation view session
   */
  async startView(dto: TrackViewDto) {
    return this.prisma.presentationView.create({
      data: {
        projectId: dto.projectId,
        viewerId: dto.viewerId,
        sessionId: dto.sessionId,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
        referrer: dto.referrer,
      },
    });
  }

  /**
   * End a presentation view session
   */
  async endView(presentationViewId: string) {
    const view = await this.prisma.presentationView.findUnique({
      where: { id: presentationViewId },
    });

    if (!view) {
      throw new NotFoundException('View session not found');
    }

    const endedAt = new Date();
    const totalDuration = Math.floor(
      (endedAt.getTime() - view.startedAt.getTime()) / 1000,
    );

    return this.prisma.presentationView.update({
      where: { id: presentationViewId },
      data: {
        endedAt,
        totalDuration,
      },
    });
  }

  /**
   * Track when a user enters a slide
   */
  async trackSlideEnter(dto: TrackSlideViewDto) {
    return this.prisma.slideView.create({
      data: {
        presentationViewId: dto.presentationViewId,
        slideId: dto.slideId,
        slideIndex: dto.slideIndex,
      },
    });
  }

  /**
   * Track when a user exits a slide
   */
  async trackSlideExit(slideViewId: string) {
    const slideView = await this.prisma.slideView.findUnique({
      where: { id: slideViewId },
    });

    if (!slideView) {
      return null;
    }

    const exitTime = new Date();
    const duration = Math.floor(
      (exitTime.getTime() - slideView.enterTime.getTime()) / 1000,
    );

    return this.prisma.slideView.update({
      where: { id: slideViewId },
      data: {
        exitTime,
        duration,
      },
    });
  }

  /**
   * Track slide interaction (click)
   */
  async trackSlideInteraction(slideViewId: string) {
    return this.prisma.slideView.update({
      where: { id: slideViewId },
      data: {
        interactions: { increment: 1 },
      },
    });
  }

  /**
   * Track heatmap click
   */
  async trackHeatmapClick(dto: TrackHeatmapDto) {
    // Round positions to create a grid
    const gridX = Math.round(dto.x * 20) / 20; // 5% grid
    const gridY = Math.round(dto.y * 20) / 20;

    return this.prisma.engagementHeatmap.upsert({
      where: {
        projectId_slideId_x_y: {
          projectId: dto.projectId,
          slideId: dto.slideId,
          x: gridX,
          y: gridY,
        },
      },
      update: {
        clickCount: { increment: 1 },
      },
      create: {
        projectId: dto.projectId,
        slideId: dto.slideId,
        x: gridX,
        y: gridY,
        clickCount: 1,
      },
    });
  }

  // ============================================
  // ANALYTICS RETRIEVAL
  // ============================================

  /**
   * Get analytics summary for a project
   */
  async getAnalyticsSummary(
    projectId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AnalyticsSummary> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate || new Date();

    // Get all views in the time range
    const views = await this.prisma.presentationView.findMany({
      where: {
        projectId,
        startedAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        slideViews: true,
      },
    });

    const totalViews = views.length;
    const uniqueViewers = new Set(
      views.filter((v) => v.viewerId).map((v) => v.viewerId),
    ).size;
    const uniqueSessions = new Set(views.map((v) => v.sessionId)).size;

    // Calculate average duration
    const completedViews = views.filter((v) => v.totalDuration);
    const averageDuration =
      completedViews.length > 0
        ? completedViews.reduce((sum, v) => sum + (v.totalDuration || 0), 0) /
        completedViews.length
        : 0;

    // Get project slide count
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { slides: true },
    });
    const totalSlides = project?.slides?.length || 1;

    // Calculate completion rate (viewers who saw last slide)
    let completionRate = 0;
    let dropOffSlide: number | null = null;

    if (views.length > 0) {
      const viewsWithLastSlide = views.filter((v) =>
        v.slideViews.some((sv) => sv.slideIndex === totalSlides - 1),
      );
      completionRate = viewsWithLastSlide.length / views.length;

      // Find drop-off slide
      const slideViewCounts = new Map<number, number>();
      views.forEach((v) => {
        v.slideViews.forEach((sv) => {
          slideViewCounts.set(
            sv.slideIndex,
            (slideViewCounts.get(sv.slideIndex) || 0) + 1,
          );
        });
      });

      let maxDrop = 0;
      for (let i = 0; i < totalSlides - 1; i++) {
        const current = slideViewCounts.get(i) || 0;
        const next = slideViewCounts.get(i + 1) || 0;
        const drop = current - next;
        if (drop > maxDrop) {
          maxDrop = drop;
          dropOffSlide = i;
        }
      }
    }

    // Get top slides by engagement
    const allSlideViews = views.flatMap((v) => v.slideViews);
    const slideStats = new Map<
      number,
      { totalDuration: number; viewCount: number }
    >();

    allSlideViews.forEach((sv) => {
      const existing = slideStats.get(sv.slideIndex) || {
        totalDuration: 0,
        viewCount: 0,
      };
      slideStats.set(sv.slideIndex, {
        totalDuration: existing.totalDuration + (sv.duration || 0),
        viewCount: existing.viewCount + 1,
      });
    });

    const topSlides = Array.from(slideStats.entries())
      .map(([slideIndex, stats]) => ({
        slideIndex,
        averageDuration:
          stats.viewCount > 0 ? stats.totalDuration / stats.viewCount : 0,
        viewCount: stats.viewCount,
      }))
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 5);

    // Views by day
    const viewsByDay = this.aggregateViewsByDay(views, start, end);

    // Generate AI insights
    const insights = await this.generateInsights({
      totalViews,
      uniqueViews: uniqueViewers || uniqueSessions,
      averageDuration,
      completionRate,
      dropOffSlide,
      topSlides,
      totalSlides,
    });

    return {
      totalViews,
      uniqueViews: uniqueViewers || uniqueSessions,
      averageDuration: Math.round(averageDuration),
      completionRate: Math.round(completionRate * 100) / 100,
      dropOffSlide,
      topSlides,
      viewsByDay,
      insights,
    };
  }

  /**
   * Get heatmap data for a slide
   */
  async getSlideHeatmap(projectId: string, slideId: string) {
    return this.prisma.engagementHeatmap.findMany({
      where: { projectId, slideId },
      orderBy: { clickCount: 'desc' },
    });
  }

  /**
   * Get real-time active viewers for a project
   */
  async getActiveViewers(projectId: string) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    return this.prisma.presentationView.findMany({
      where: {
        projectId,
        startedAt: { gte: fiveMinutesAgo },
        endedAt: null,
      },
      select: {
        id: true,
        viewerId: true,
        sessionId: true,
        startedAt: true,
      },
    });
  }

  /**
   * Get slide-by-slide performance metrics
   */
  async getSlidePerformance(
    projectId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    // Get project slides
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { slides: { orderBy: { order: 'asc' } } },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Get all views in time range
    const views = await this.prisma.presentationView.findMany({
      where: {
        projectId,
        startedAt: { gte: start, lte: end },
      },
      include: { slideViews: true },
    });

    // Calculate per-slide metrics
    const slideMetrics = project.slides.map((slide, index) => {
      const slideViews = views.flatMap((v) =>
        v.slideViews.filter((sv) => sv.slideId === slide.id),
      );

      const viewCount = slideViews.length;
      const totalDuration = slideViews.reduce(
        (sum, sv) => sum + (sv.duration || 0),
        0,
      );
      const avgDuration = viewCount > 0 ? totalDuration / viewCount : 0;
      const totalInteractions = slideViews.reduce(
        (sum, sv) => sum + sv.interactions,
        0,
      );

      // Calculate drop-off rate
      const nextSlideViews = views.flatMap((v) =>
        v.slideViews.filter((sv) => sv.slideIndex === index + 1),
      );
      const dropOffRate =
        viewCount > 0
          ? ((viewCount - nextSlideViews.length) / viewCount) * 100
          : 0;

      return {
        slideId: slide.id,
        slideNumber: index + 1,
        slideTitle: `Slide ${index + 1}`,
        views: viewCount,
        avgDuration: Math.round(avgDuration),
        dropOffRate: Math.round(dropOffRate),
        clicks: totalInteractions,
      };
    });

    return slideMetrics;
  }

  /**
   * Get viewer sessions with pagination
   */
  async getViewerSessions(projectId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      this.prisma.presentationView.findMany({
        where: { projectId },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
        include: {
          slideViews: {
            orderBy: { enterTime: 'asc' },
          },
        },
      }),
      this.prisma.presentationView.count({
        where: { projectId },
      }),
    ]);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { slides: true },
    });
    const totalSlides = project?.slides.length || 1;

    // Parse user agent for device info
    const parseDevice = (ua: string | null): 'desktop' | 'mobile' | 'tablet' => {
      if (!ua) return 'desktop';
      if (/mobile/i.test(ua)) return 'mobile';
      if (/tablet|ipad/i.test(ua)) return 'tablet';
      return 'desktop';
    };

    return {
      data: sessions.map((session) => ({
        id: session.id,
        viewerName: session.viewerId ? undefined : 'Anonymous',
        viewerEmail: undefined,
        startTime: session.startedAt.toISOString(),
        duration: session.totalDuration || 0,
        slidesViewed: session.slideViews.length,
        device: parseDevice(session.userAgent),
        location: undefined,
        completionRate: Math.round(
          (session.slideViews.length / totalSlides) * 100,
        ),
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get overall presentation stats
   */
  async getPresentationStats(projectId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const views = await this.prisma.presentationView.findMany({
      where: {
        projectId,
        startedAt: { gte: thirtyDaysAgo },
      },
      include: { slideViews: true },
    });

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { slides: true },
    });
    const totalSlides = project?.slides.length || 1;

    const totalViews = views.length;
    const uniqueViewers = new Set(
      views.filter((v) => v.viewerId).map((v) => v.viewerId),
    ).size || new Set(views.map((v) => v.sessionId)).size;

    const completedViews = views.filter((v) => v.totalDuration);
    const avgViewDuration =
      completedViews.length > 0
        ? completedViews.reduce((sum, v) => sum + (v.totalDuration || 0), 0) /
        completedViews.length
        : 0;

    // Completion rate
    const viewsWithLastSlide = views.filter((v) =>
      v.slideViews.some((sv) => sv.slideIndex === totalSlides - 1),
    );
    const completionRate =
      views.length > 0
        ? Math.round((viewsWithLastSlide.length / views.length) * 100)
        : 0;

    // Share and download counts (placeholder - would need to track these)
    const shareCount = 0;
    const downloadCount = 0;

    // Last viewed
    const lastView = views[0];
    const lastViewed = lastView?.startedAt.toISOString() || null;

    return {
      totalViews,
      uniqueViewers,
      avgViewDuration: Math.round(avgViewDuration),
      completionRate,
      shareCount,
      downloadCount,
      lastViewed,
    };
  }

  // ============================================
  // AI INSIGHTS
  // ============================================

  private async generateInsights(data: {
    totalViews: number;
    uniqueViews: number;
    averageDuration: number;
    completionRate: number;
    dropOffSlide: number | null;
    topSlides: Array<{ slideIndex: number; averageDuration: number }>;
    totalSlides: number;
  }): Promise<string[]> {
    try {
      const prompt = `Analyze this presentation analytics data and provide 3-5 actionable insights:

Total Views: ${data.totalViews}
Unique Viewers: ${data.uniqueViews}
Average View Duration: ${data.averageDuration} seconds
Completion Rate: ${Math.round(data.completionRate * 100)}%
Total Slides: ${data.totalSlides}
${data.dropOffSlide !== null ? `Biggest Drop-off: Slide ${data.dropOffSlide + 1}` : ''}
Top Engaged Slides: ${data.topSlides.map((s) => `Slide ${s.slideIndex + 1} (${Math.round(s.averageDuration)}s avg)`).join(', ')}

Provide insights in JSON array format: ["insight 1", "insight 2", ...]
Focus on:
- Engagement patterns
- Potential improvements
- Content optimization suggestions`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content || '[]';
      return JSON.parse(content) as string[];
    } catch (error) {
      this.logger.error('Failed to generate insights', error);
      return this.generateFallbackInsights(data);
    }
  }

  private generateFallbackInsights(data: {
    totalViews: number;
    uniqueViews: number;
    averageDuration: number;
    completionRate: number;
    dropOffSlide: number | null;
    topSlides: Array<{ slideIndex: number }>;
    totalSlides: number;
  }): string[] {
    const insights: string[] = [];

    if (data.completionRate < 0.5) {
      insights.push(
        'Less than 50% of viewers complete the presentation. Consider shortening it or improving the first few slides.',
      );
    }

    if (data.dropOffSlide !== null) {
      insights.push(
        `Viewers tend to leave at slide ${data.dropOffSlide + 1}. Review this slide for engaging content.`,
      );
    }

    if (data.averageDuration < 30 && data.totalSlides > 5) {
      insights.push(
        'Average viewing time is quite short. Consider adding more engaging visuals or reducing content density.',
      );
    }

    if (data.uniqueViews < data.totalViews * 0.7) {
      insights.push(
        'Many viewers return multiple times. This indicates high interest in your content.',
      );
    }

    return insights.length > 0
      ? insights
      : ['Keep creating engaging presentations to gather more analytics data.'];
  }

  // ============================================
  // AGGREGATION HELPERS
  // ============================================

  private aggregateViewsByDay(
    views: { startedAt: Date; sessionId: string }[],
    start: Date,
    end: Date,
  ): Array<{ date: string; views: number; uniqueViews: number }> {
    const dayMap = new Map<string, { views: number; sessions: Set<string> }>();

    // Initialize all days in range
    const current = new Date(start);
    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];
      dayMap.set(dateKey, { views: 0, sessions: new Set() });
      current.setDate(current.getDate() + 1);
    }

    // Aggregate views
    views.forEach((v) => {
      const dateKey = v.startedAt.toISOString().split('T')[0];
      const day = dayMap.get(dateKey);
      if (day) {
        day.views++;
        day.sessions.add(v.sessionId);
      }
    });

    return Array.from(dayMap.entries())
      .map(([date, data]) => ({
        date,
        views: data.views,
        uniqueViews: data.sessions.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // ============================================
  // SCHEDULED TASKS
  // ============================================

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async aggregateDailyAnalytics() {
    this.logger.log('Running daily analytics aggregation');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all projects with views yesterday
    const views = await this.prisma.presentationView.findMany({
      where: {
        startedAt: {
          gte: yesterday,
          lt: today,
        },
      },
      include: {
        slideViews: true,
      },
    });

    // Group by project
    const projectViews = new Map<string, typeof views>();
    views.forEach((v) => {
      const existing = projectViews.get(v.projectId) || [];
      existing.push(v);
      projectViews.set(v.projectId, existing);
    });

    // Create snapshots for each project
    for (const [projectId, projectViewsList] of projectViews) {
      const uniqueSessions = new Set(projectViewsList.map((v) => v.sessionId))
        .size;
      const completedViews = projectViewsList.filter((v) => v.totalDuration);
      const avgDuration =
        completedViews.length > 0
          ? completedViews.reduce((sum, v) => sum + (v.totalDuration || 0), 0) /
          completedViews.length
          : 0;

      await this.prisma.analyticsSnapshot.upsert({
        where: {
          projectId_date: { projectId, date: yesterday },
        },
        update: {
          views: projectViewsList.length,
          uniqueViews: uniqueSessions,
          avgDuration,
        },
        create: {
          projectId,
          date: yesterday,
          views: projectViewsList.length,
          uniqueViews: uniqueSessions,
          avgDuration,
        },
      });
    }

    this.logger.log(`Aggregated analytics for ${projectViews.size} projects`);
  }

  // ============================================
  // DETAILED AI RECOMMENDATIONS
  // ============================================

  async generateDetailedRecommendations(
    projectId: string,
    presentationContent?: any,
  ): Promise<{
    recommendations: Array<{
      category: string;
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
      impact: string;
      implementation: string;
    }>;
    overallScore: number;
    generatedAt: string;
  }> {
    try {
      // Get analytics data
      const summary = await this.getAnalyticsSummary(projectId);
      const slidePerformance = await this.getSlidePerformance(projectId);

      const prompt = `You are a presentation optimization expert. Analyze this presentation data and provide detailed, actionable recommendations.

ANALYTICS DATA:
- Total Views: ${summary.totalViews}
- Unique Viewers: ${summary.uniqueViews}
- Average Duration: ${summary.averageDuration} seconds
- Completion Rate: ${Math.round(summary.completionRate * 100)}%
- Drop-off Slide: ${summary.dropOffSlide !== null ? `Slide ${summary.dropOffSlide + 1}` : 'None identified'}

SLIDE PERFORMANCE:
${slidePerformance.map((s: any) => `Slide ${s.slideNumber}: ${s.views} views, ${s.avgDuration}s avg, ${s.dropOffRate}% drop-off`).join('\n')}

${presentationContent ? `CONTENT OVERVIEW:\n${JSON.stringify(presentationContent).substring(0, 2000)}` : ''}

Provide recommendations in JSON format:
{
  "recommendations": [
    {
      "category": "Content|Design|Engagement|Structure|Performance",
      "title": "Short title",
      "description": "Detailed explanation of the issue",
      "priority": "high|medium|low",
      "impact": "Expected improvement description",
      "implementation": "Step-by-step implementation guide"
    }
  ],
  "overallScore": 75
}

Provide 5-8 specific, actionable recommendations based on the data patterns.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return this.getDefaultRecommendations(summary);
      }

      const parsed = JSON.parse(content);
      return {
        recommendations: parsed.recommendations || [],
        overallScore: parsed.overallScore || 70,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to generate detailed recommendations', error);
      return this.getDefaultRecommendations(await this.getAnalyticsSummary(projectId));
    }
  }

  private getDefaultRecommendations(summary: AnalyticsSummary) {
    const recommendations: any[] = [];

    if (summary.completionRate < 0.5) {
      recommendations.push({
        category: 'Structure',
        title: 'Improve Presentation Flow',
        description: 'Less than 50% of viewers complete the presentation.',
        priority: 'high' as const,
        impact: 'Could increase completion rate by 20-30%',
        implementation: 'Consider reducing the number of slides, adding more visual elements, or restructuring content to front-load key information.',
      });
    }

    if (summary.dropOffSlide !== null) {
      recommendations.push({
        category: 'Content',
        title: `Review Slide ${summary.dropOffSlide + 1}`,
        description: 'This slide has the highest viewer drop-off rate.',
        priority: 'high' as const,
        impact: 'Could reduce drop-off by 15-25%',
        implementation: 'Analyze the content density, add engaging visuals, or consider splitting into multiple slides.',
      });
    }

    if (summary.averageDuration < 60) {
      recommendations.push({
        category: 'Engagement',
        title: 'Increase Viewer Engagement',
        description: 'Average viewing time is under 1 minute.',
        priority: 'medium' as const,
        impact: 'Could increase engagement time by 50%',
        implementation: 'Add interactive elements, embed videos, or include thought-provoking questions.',
      });
    }

    recommendations.push({
      category: 'Performance',
      title: 'Optimize for Mobile',
      description: 'Ensure presentation is mobile-friendly.',
      priority: 'medium' as const,
      impact: 'Could increase mobile viewership by 40%',
      implementation: 'Use larger fonts, reduce text density, and test on various screen sizes.',
    });

    return {
      recommendations,
      overallScore: 70,
      generatedAt: new Date().toISOString(),
    };
  }

  // ============================================
  // EXPORT ANALYTICS DATA
  // ============================================

  async exportAnalyticsData(
    projectId: string,
    format: 'json' | 'csv',
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ data: string; filename: string; mimeType: string }> {
    const summary = await this.getAnalyticsSummary(projectId, startDate, endDate);
    const slidePerformance = await this.getSlidePerformance(projectId, startDate, endDate);
    const { data: sessions } = await this.getViewerSessions(projectId, 1, 1000);

    const exportData = {
      summary,
      slidePerformance,
      sessions,
      exportedAt: new Date().toISOString(),
      dateRange: {
        start: startDate?.toISOString() || 'Last 30 days',
        end: endDate?.toISOString() || 'Now',
      },
    };

    if (format === 'csv') {
      const csvData = this.convertToCSV(exportData);
      return {
        data: csvData,
        filename: `analytics-${projectId}-${Date.now()}.csv`,
        mimeType: 'text/csv',
      };
    }

    return {
      data: JSON.stringify(exportData, null, 2),
      filename: `analytics-${projectId}-${Date.now()}.json`,
      mimeType: 'application/json',
    };
  }

  private convertToCSV(data: any): string {
    const lines: string[] = [];

    // Summary section
    lines.push('SUMMARY');
    lines.push('Metric,Value');
    lines.push(`Total Views,${data.summary.totalViews}`);
    lines.push(`Unique Views,${data.summary.uniqueViews}`);
    lines.push(`Average Duration (s),${data.summary.averageDuration}`);
    lines.push(`Completion Rate,${data.summary.completionRate}`);
    lines.push('');

    // Slide Performance section
    lines.push('SLIDE PERFORMANCE');
    lines.push('Slide,Views,Avg Duration (s),Drop-off Rate (%),Clicks');
    data.slidePerformance.forEach((slide: any) => {
      lines.push(`${slide.slideNumber},${slide.views},${slide.avgDuration},${slide.dropOffRate},${slide.clicks}`);
    });
    lines.push('');

    // Sessions section
    lines.push('VIEWER SESSIONS');
    lines.push('ID,Start Time,Duration (s),Slides Viewed,Device,Completion Rate (%)');
    data.sessions.forEach((session: any) => {
      lines.push(`${session.id},${session.startTime},${session.duration},${session.slidesViewed},${session.device},${session.completionRate}`);
    });

    return lines.join('\n');
  }
}
