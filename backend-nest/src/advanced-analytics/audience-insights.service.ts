import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AudienceSegment {
  id: string;
  name: string;
  criteria: {
    demographics?: {
      age?: { min?: number; max?: number };
      gender?: string[];
      location?: string[];
      language?: string[];
    };
    behavior?: {
      viewCount?: { min?: number; max?: number };
      avgWatchTime?: { min?: number; max?: number };
      completionRate?: { min?: number; max?: number };
      engagement?: 'low' | 'medium' | 'high';
    };
    source?: {
      referrer?: string[];
      device?: ('desktop' | 'mobile' | 'tablet')[];
      browser?: string[];
    };
  };
  size: number;
  lastUpdated: Date;
}

export interface ViewerProfile {
  id: string;
  sessionId: string;
  userId?: string;
  demographics: {
    country?: string;
    region?: string;
    city?: string;
    language?: string;
    timezone?: string;
  };
  device: {
    type: 'desktop' | 'mobile' | 'tablet';
    os?: string;
    browser?: string;
    screenSize?: string;
  };
  engagement: {
    totalViews: number;
    totalWatchTime: number;
    avgCompletionRate: number;
    interactionCount: number;
    lastViewedAt: Date;
  };
  interests: string[];
  segments: string[];
}

@Injectable()
export class AudienceInsightsService {
  private readonly logger = new Logger(AudienceInsightsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get audience overview for a presentation
   */
  async getAudienceOverview(presentationId: string): Promise<{
    totalViewers: number;
    uniqueViewers: number;
    returningViewers: number;
    avgSessionDuration: number;
    peakViewTime: string;
    demographics: {
      countries: Array<{ country: string; count: number; percentage: number }>;
      devices: Array<{ device: string; count: number; percentage: number }>;
      browsers: Array<{ browser: string; count: number; percentage: number }>;
    };
  }> {
    const views = await this.prisma.presentationView.findMany({
      where: { projectId: presentationId },
    });

    const totalViewers = views.length;
    const uniqueViewerIds = new Set(
      views.map((v) => v.viewerId || v.sessionId),
    );
    const uniqueViewers = uniqueViewerIds.size;

    // Count viewers with multiple sessions
    const viewerCounts = views.reduce(
      (acc, v) => {
        const key = v.viewerId || v.sessionId;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const returningViewers = Object.values(viewerCounts).filter(
      (c) => c > 1,
    ).length;

    // Calculate average session duration
    const durations = views.map((v) => v.duration || 0);
    const avgSessionDuration =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

    // Find peak view time
    const hourCounts: Record<number, number> = {};
    views.forEach((v) => {
      if (!v.viewedAt) return;
      const hour = v.viewedAt.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const peakHour = Object.entries(hourCounts).sort(
      ([, a], [, b]) => b - a,
    )[0];
    const peakViewTime = peakHour ? `${peakHour[0]}:00` : 'N/A';

    // Demographics
    const countryCounts: Record<string, number> = {};
    const deviceCounts: Record<string, number> = {};
    const browserCounts: Record<string, number> = {};

    views.forEach((v) => {
      if (v.country)
        countryCounts[v.country] = (countryCounts[v.country] || 0) + 1;
      if (v.deviceType)
        deviceCounts[v.deviceType] = (deviceCounts[v.deviceType] || 0) + 1;
      if (v.browser)
        browserCounts[v.browser] = (browserCounts[v.browser] || 0) + 1;
    });

    const toPercentageArray = (counts: Record<string, number>, key: string) =>
      Object.entries(counts)
        .map(([name, count]) => ({
          [key]: name,
          count,
          percentage: Math.round((count / totalViewers) * 100),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10) as Array<{
        [k: string]: string | number;
        count: number;
        percentage: number;
      }>;

    return {
      totalViewers,
      uniqueViewers,
      returningViewers,
      avgSessionDuration: Math.round(avgSessionDuration),
      peakViewTime,
      demographics: {
        countries: toPercentageArray(countryCounts, 'country') as {
          country: string;
          count: number;
          percentage: number;
        }[],
        devices: toPercentageArray(deviceCounts, 'device') as {
          device: string;
          count: number;
          percentage: number;
        }[],
        browsers: toPercentageArray(browserCounts, 'browser') as {
          browser: string;
          count: number;
          percentage: number;
        }[],
      },
    };
  }

  /**
   * Create audience segment
   */
  async createSegment(
    organizationId: string,
    segment: Omit<AudienceSegment, 'id' | 'size' | 'lastUpdated'>,
  ): Promise<AudienceSegment> {
    const size = await this.calculateSegmentSize(
      organizationId,
      segment.criteria,
    );

    const created = await this.prisma.audienceSegment.create({
      data: {
        userId: organizationId,
        name: segment.name,
        criteria: segment.criteria as object,
        memberCount: size,
      },
    });

    return {
      id: created.id,
      name: created.name,
      criteria: created.criteria as AudienceSegment['criteria'],
      size: created.memberCount,
      lastUpdated: created.updatedAt,
    };
  }

  /**
   * Get all segments for organization
   */
  async getSegments(organizationId: string): Promise<AudienceSegment[]> {
    const segments = await this.prisma.audienceSegment.findMany({
      where: { userId: organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return segments.map((s) => ({
      id: s.id,
      name: s.name,
      criteria: s.criteria as AudienceSegment['criteria'],
      size: s.memberCount,
      lastUpdated: s.updatedAt,
    }));
  }

  /**
   * Calculate segment size based on criteria
   */
  private async calculateSegmentSize(
    organizationId: string,
    criteria: AudienceSegment['criteria'],
  ): Promise<number> {
    const where: Record<string, unknown> = {
      project: { ownerId: organizationId },
    };

    if (criteria.demographics?.location?.length) {
      where.country = { in: criteria.demographics.location };
    }

    if (criteria.source?.device?.length) {
      where.deviceType = { in: criteria.source.device };
    }

    if (criteria.behavior?.engagement) {
      const engagementMap = { low: [0, 30], medium: [30, 70], high: [70, 100] };
      const [min, max] = engagementMap[criteria.behavior.engagement];
      where.completionRate = { gte: min, lte: max };
    }

    return this.prisma.presentationView.count({ where });
  }

  /**
   * Get engagement heatmap by slide
   */
  async getSlideEngagementHeatmap(presentationId: string): Promise<
    Array<{
      slideId: string;
      slideNumber: number;
      avgTimeSpent: number;
      dropOffRate: number;
      interactionCount: number;
      engagementScore: number;
    }>
  > {
    const slideAnalytics = await this.prisma.slideAnalytics.findMany({
      where: { projectId: presentationId },
      orderBy: { slideNumber: 'asc' },
    });

    return slideAnalytics.map((s) => ({
      slideId: s.slideId,
      slideNumber: s.slideNumber,
      avgTimeSpent: s.avgTimeSpent,
      dropOffRate: s.dropOffRate,
      interactionCount: Math.round(s.interactionRate * s.viewCount),
      engagementScore: this.calculateEngagementScore(
        s.avgTimeSpent,
        s.dropOffRate,
        Math.round(s.interactionRate * s.viewCount),
      ),
    }));
  }

  private calculateEngagementScore(
    avgTime: number,
    dropOff: number,
    interactions: number,
  ): number {
    // Normalize and combine metrics
    const timeScore = Math.min(avgTime / 30, 1) * 40; // 30s optimal
    const retentionScore = (1 - dropOff / 100) * 40;
    const interactionScore = Math.min(interactions / 10, 1) * 20;

    return Math.round(timeScore + retentionScore + interactionScore);
  }

  /**
   * Get viewer journey/funnel analysis
   */
  async getViewerFunnel(presentationId: string): Promise<{
    stages: Array<{
      stage: string;
      count: number;
      percentage: number;
      dropOff: number;
    }>;
  }> {
    const views = await this.prisma.presentationView.findMany({
      where: { projectId: presentationId },
      select: {
        id: true,
        completionRate: true,
        interacted: true,
        shared: true,
        converted: true,
      },
    });

    const total = views.length;
    if (total === 0) {
      return { stages: [] };
    }

    const started = total;
    const watchedHalf = views.filter(
      (v) => (v.completionRate || 0) >= 50,
    ).length;
    const completed = views.filter((v) => (v.completionRate || 0) >= 90).length;
    const interacted = views.filter((v) => v.interacted).length;
    const shared = views.filter((v) => v.shared).length;
    const converted = views.filter((v) => v.converted).length;

    const stages = [
      { stage: 'Started', count: started },
      { stage: 'Watched 50%', count: watchedHalf },
      { stage: 'Completed', count: completed },
      { stage: 'Interacted', count: interacted },
      { stage: 'Shared', count: shared },
      { stage: 'Converted', count: converted },
    ];

    return {
      stages: stages.map((s, i) => ({
        ...s,
        percentage: Math.round((s.count / total) * 100),
        dropOff:
          i > 0
            ? Math.round(
                ((stages[i - 1].count - s.count) / stages[i - 1].count) * 100,
              )
            : 0,
      })),
    };
  }

  /**
   * Get real-time viewer activity
   */
  async getRealTimeActivity(presentationId: string): Promise<{
    activeViewers: number;
    currentSlideDistribution: Array<{ slideNumber: number; viewers: number }>;
    recentEvents: Array<{ type: string; timestamp: Date; details: object }>;
  }> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const activeViews = await this.prisma.presentationView.findMany({
      where: {
        projectId: presentationId,
        startedAt: { gte: fiveMinutesAgo },
        endedAt: null,
      },
      select: { currentSlide: true },
    });

    const slideDistribution: Record<number, number> = {};
    activeViews.forEach((v) => {
      const slide = v.currentSlide || 1;
      slideDistribution[slide] = (slideDistribution[slide] || 0) + 1;
    });

    const recentEvents = await this.prisma.viewerEvent.findMany({
      where: {
        projectId: presentationId,
        timestamp: { gte: fiveMinutesAgo },
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
      select: {
        eventType: true,
        timestamp: true,
        metadata: true,
      },
    });

    return {
      activeViewers: activeViews.length,
      currentSlideDistribution: Object.entries(slideDistribution).map(
        ([slideNumber, viewers]) => ({
          slideNumber: parseInt(slideNumber),
          viewers,
        }),
      ),
      recentEvents: recentEvents.map((e) => ({
        type: e.eventType,
        timestamp: e.timestamp,
        details: e.metadata as object,
      })),
    };
  }

  /**
   * Get audience growth over time
   */
  async getAudienceGrowth(
    organizationId: string,
    period: 'day' | 'week' | 'month' | 'year' = 'month',
  ): Promise<
    Array<{ date: string; newViewers: number; totalViewers: number }>
  > {
    const periodDays = { day: 1, week: 7, month: 30, year: 365 };
    const days = periodDays[period];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const views = await this.prisma.presentationView.findMany({
      where: {
        project: { ownerId: organizationId },
        viewedAt: { gte: startDate },
      },
      select: {
        viewedAt: true,
        viewerId: true,
        sessionId: true,
      },
      orderBy: { viewedAt: 'asc' },
    });

    // Group by date
    const dailyStats: Record<string, { new: Set<string>; total: number }> = {};
    const seenViewers = new Set<string>();

    views.forEach((v) => {
      if (!v.viewedAt) return;
      const date = v.viewedAt.toISOString().split('T')[0];
      const viewerId = v.viewerId || v.sessionId;

      if (!dailyStats[date]) {
        dailyStats[date] = { new: new Set(), total: 0 };
      }

      if (!seenViewers.has(viewerId)) {
        dailyStats[date].new.add(viewerId);
        seenViewers.add(viewerId);
      }
      dailyStats[date].total++;
    });

    return Object.entries(dailyStats)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        newViewers: stats.new.size,
        totalViewers: stats.total,
      }));
  }

  /**
   * Compare audience across presentations
   */
  async compareAudiences(presentationIds: string[]): Promise<
    Array<{
      presentationId: string;
      uniqueViewers: number;
      avgEngagement: number;
      topCountries: string[];
      topDevices: string[];
    }>
  > {
    const comparisons = await Promise.all(
      presentationIds.map(async (id) => {
        const overview = await this.getAudienceOverview(id);
        return {
          presentationId: id,
          uniqueViewers: overview.uniqueViewers,
          avgEngagement: Math.round(
            (overview.avgSessionDuration / 60) *
              (overview.returningViewers /
                Math.max(overview.uniqueViewers, 1)) *
              100,
          ),
          topCountries: overview.demographics.countries
            .slice(0, 3)
            .map((c) => c.country),
          topDevices: overview.demographics.devices
            .slice(0, 2)
            .map((d) => d.device),
        };
      }),
    );

    return comparisons;
  }
}
