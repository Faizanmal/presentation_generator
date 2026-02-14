import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ViewEvent {
  projectId: string;
  sessionId: string;
  userId?: string;
  slideId?: string;
  timestamp: Date;
  eventType: 'view' | 'slide_change' | 'interaction' | 'exit';
  duration?: number;
  metadata?: Record<string, any>;
}

export interface AudienceInsights {
  totalViews: number;
  uniqueViewers: number;
  averageViewDuration: number;
  completionRate: number;
  dropOffSlide: string | null;
  peakViewingTime: string;
  deviceBreakdown: { device: string; count: number; percentage: number }[];
  locationBreakdown: { location: string; count: number; percentage: number }[];
  slideEngagement: SlideEngagement[];
  viewerTimeline: { date: string; views: number }[];
  interactionHotspots: {
    slideId: string;
    x: number;
    y: number;
    count: number;
  }[];
}

export interface SlideEngagement {
  slideId: string;
  slideNumber: number;
  title: string;
  views: number;
  averageTimeSpent: number;
  dropOffRate: number;
  interactions: number;
  heatmapData?: { x: number; y: number; intensity: number }[];
}

export interface ViewerSession {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  userId?: string;
  userAgent: string;
  location?: string;
  slidesViewed: string[];
  totalDuration: number;
  completed: boolean;
}

@Injectable()
export class AudienceAnalyticsService {
  private events: ViewEvent[] = [];
  private sessions: Map<string, ViewerSession> = new Map();

  constructor(private prisma: PrismaService) {}

  trackEvent(event: Omit<ViewEvent, 'timestamp'>): void {
    const fullEvent: ViewEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.events.push(fullEvent);

    // Update session tracking
    this.updateSession(fullEvent);

    // Persist to database in batches
    if (this.events.length >= 100) {
      this.flushEvents();
    }
  }

  async getInsights(
    projectId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      granularity?: 'hour' | 'day' | 'week' | 'month';
    } = {},
  ): Promise<AudienceInsights> {
    const events = this.events.filter(
      (e) =>
        e.projectId === projectId &&
        (!options.startDate || e.timestamp >= options.startDate) &&
        (!options.endDate || e.timestamp <= options.endDate),
    );

    const sessions = Array.from(this.sessions.values()).filter((s) =>
      events.some((e) => e.sessionId === s.sessionId),
    );

    const uniqueViewers = new Set(
      events.filter((e) => e.userId).map((e) => e.userId),
    ).size;
    const totalViews = sessions.length;

    const completedSessions = sessions.filter((s) => s.completed);
    const completionRate =
      totalViews > 0 ? completedSessions.length / totalViews : 0;

    const totalDuration = sessions.reduce((sum, s) => sum + s.totalDuration, 0);
    const averageViewDuration = totalViews > 0 ? totalDuration / totalViews : 0;

    // Device breakdown
    const deviceCounts = new Map<string, number>();
    for (const session of sessions) {
      const device = this.parseDevice(session.userAgent);
      deviceCounts.set(device, (deviceCounts.get(device) || 0) + 1);
    }
    const deviceBreakdown = Array.from(deviceCounts.entries()).map(
      ([device, count]) => ({
        device,
        count,
        percentage: (count / totalViews) * 100,
      }),
    );

    // Location breakdown
    const locationCounts = new Map<string, number>();
    for (const session of sessions) {
      const location = session.location || 'Unknown';
      locationCounts.set(location, (locationCounts.get(location) || 0) + 1);
    }
    const locationBreakdown = Array.from(locationCounts.entries())
      .map(([location, count]) => ({
        location,
        count,
        percentage: (count / totalViews) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Slide engagement
    const slideEngagement = await this.calculateSlideEngagement(
      projectId,
      events,
    );

    // Drop-off analysis
    const dropOffSlide = this.findDropOffSlide(slideEngagement);

    // Peak viewing time
    const peakViewingTime = this.calculatePeakViewingTime(events);

    // Timeline
    const viewerTimeline = this.calculateTimeline(
      sessions,
      options.granularity || 'day',
    );

    // Interaction hotspots
    const interactionHotspots = this.calculateInteractionHotspots(events);

    return {
      totalViews,
      uniqueViewers,
      averageViewDuration,
      completionRate,
      dropOffSlide,
      peakViewingTime,
      deviceBreakdown,
      locationBreakdown,
      slideEngagement,
      viewerTimeline,
      interactionHotspots,
    };
  }

  getSlideHeatmap(
    projectId: string,
    slideId: string,
  ): { x: number; y: number; intensity: number }[] {
    const interactionEvents = this.events.filter(
      (e) =>
        e.projectId === projectId &&
        e.slideId === slideId &&
        e.eventType === 'interaction' &&
        e.metadata?.x !== undefined,
    );

    const heatmapData = new Map<
      string,
      { x: number; y: number; count: number }
    >();

    for (const event of interactionEvents) {
      const x = Math.round(event.metadata!.x / 10) * 10;
      const y = Math.round(event.metadata!.y / 10) * 10;
      const key = `${x},${y}`;

      if (!heatmapData.has(key)) {
        heatmapData.set(key, { x, y, count: 0 });
      }
      heatmapData.get(key)!.count++;
    }

    const maxCount = Math.max(
      ...Array.from(heatmapData.values()).map((d) => d.count),
      1,
    );

    return Array.from(heatmapData.values()).map((d) => ({
      x: d.x,
      y: d.y,
      intensity: d.count / maxCount,
    }));
  }

  getViewerSessions(
    projectId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {},
  ): { sessions: ViewerSession[]; total: number } {
    const projectEvents = this.events.filter((e) => e.projectId === projectId);
    const sessionIds = new Set(projectEvents.map((e) => e.sessionId));

    const sessions = Array.from(sessionIds)
      .map((id) => this.sessions.get(id))
      .filter((s): s is ViewerSession => s !== undefined)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    const limit = options.limit || 20;
    const offset = options.offset || 0;

    return {
      sessions: sessions.slice(offset, offset + limit),
      total: sessions.length,
    };
  }

  async exportAnalytics(
    projectId: string,
    format: 'csv' | 'json' | 'pdf',
  ): Promise<Buffer> {
    const insights = await this.getInsights(projectId);
    const { sessions } = this.getViewerSessions(projectId, {
      limit: 1000,
    });

    if (format === 'json') {
      return Buffer.from(JSON.stringify({ insights, sessions }, null, 2));
    }

    if (format === 'csv') {
      const headers = [
        'Session ID',
        'Start Time',
        'Duration (s)',
        'Slides Viewed',
        'Completed',
        'Location',
      ].join(',');

      const rows = sessions.map((s) =>
        [
          s.sessionId,
          s.startTime.toISOString(),
          s.totalDuration,
          s.slidesViewed.length,
          s.completed,
          s.location || '',
        ].join(','),
      );

      return Buffer.from([headers, ...rows].join('\n'));
    }

    // PDF would require additional library
    return Buffer.from(JSON.stringify(insights));
  }

  getRealtimeViewers(projectId: string): {
    count: number;
    viewers: { sessionId: string; currentSlide: string; duration: number }[];
  } {
    const recentThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes

    const recentEvents = this.events.filter(
      (e) => e.projectId === projectId && e.timestamp >= recentThreshold,
    );

    const activeSessionIds = new Set(recentEvents.map((e) => e.sessionId));

    const viewers = Array.from(activeSessionIds).map((sessionId) => {
      const session = this.sessions.get(sessionId);
      const lastEvent = recentEvents
        .filter((e) => e.sessionId === sessionId)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

      return {
        sessionId,
        currentSlide: lastEvent?.slideId || 'unknown',
        duration: session?.totalDuration || 0,
      };
    });

    return {
      count: viewers.length,
      viewers,
    };
  }

  private updateSession(event: ViewEvent): void {
    let session = this.sessions.get(event.sessionId);

    if (!session) {
      session = {
        sessionId: event.sessionId,
        startTime: event.timestamp,
        userId: event.userId,
        userAgent:
          ((event.metadata as Record<string, any>)?.userAgent as string) ||
          'Unknown',
        location: (event.metadata as Record<string, any>)?.location as string,
        slidesViewed: [],
        totalDuration: 0,
        completed: false,
      };
      this.sessions.set(event.sessionId, session);
    }

    // At this point, session is guaranteed to be defined
    const currentSession = session;

    if (event.slideId && !currentSession.slidesViewed.includes(event.slideId)) {
      currentSession.slidesViewed.push(event.slideId);
    }

    if (event.duration) {
      currentSession.totalDuration += event.duration;
    }

    if (event.eventType === 'exit') {
      currentSession.endTime = event.timestamp;
      currentSession.completed =
        ((event.metadata as Record<string, any>)?.completed as boolean) ||
        false;
    }
  }

  private flushEvents(): void {
    // In a real implementation, batch insert to database
    // For now, just clear old events (keep last 10000)
    if (this.events.length > 10000) {
      this.events = this.events.slice(-10000);
    }
  }

  private parseDevice(userAgent: string): string {
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Tablet')) return 'Tablet';
    return 'Desktop';
  }

  private async calculateSlideEngagement(
    projectId: string,
    events: ViewEvent[],
  ): Promise<SlideEngagement[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { slides: { orderBy: { order: 'asc' } } },
    });

    if (!project) return [];

    return project.slides.map((slide, index) => {
      const slideEvents = events.filter((e) => e.slideId === slide.id);
      const views = new Set(slideEvents.map((e) => e.sessionId)).size;

      const timeSpent = slideEvents
        .filter((e) => e.duration)
        .reduce((sum, e) => sum + (e.duration || 0), 0);

      const avgTimeSpent = views > 0 ? timeSpent / views : 0;

      // Calculate drop-off rate
      const nextSlide = project.slides[index + 1];
      let dropOffRate = 0;
      if (nextSlide) {
        const nextSlideViews = new Set(
          events
            .filter((e) => e.slideId === nextSlide.id)
            .map((e) => e.sessionId),
        ).size;
        dropOffRate = views > 0 ? (views - nextSlideViews) / views : 0;
      }

      const interactions = slideEvents.filter(
        (e) => e.eventType === 'interaction',
      ).length;

      return {
        slideId: slide.id,
        slideNumber: index + 1,
        title: (slide as { title?: string }).title || `Slide ${index + 1}`,
        views,
        averageTimeSpent: avgTimeSpent,
        dropOffRate,
        interactions,
      };
    });
  }

  private findDropOffSlide(engagement: SlideEngagement[]): string | null {
    const maxDropOff = Math.max(...engagement.map((e) => e.dropOffRate));
    const dropOffSlide = engagement.find((e) => e.dropOffRate === maxDropOff);
    return dropOffSlide && maxDropOff > 0.3 ? dropOffSlide.slideId : null;
  }

  private calculatePeakViewingTime(events: ViewEvent[]): string {
    const hourCounts = new Map<number, number>();

    for (const event of events) {
      const hour = event.timestamp.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }

    let peakHour = 12;
    let maxCount = 0;

    for (const [hour, count] of hourCounts) {
      if (count > maxCount) {
        maxCount = count;
        peakHour = hour;
      }
    }

    return `${peakHour.toString().padStart(2, '0')}:00`;
  }

  private calculateTimeline(
    sessions: ViewerSession[],
    granularity: 'hour' | 'day' | 'week' | 'month',
  ): { date: string; views: number }[] {
    const dateCounts = new Map<string, number>();

    for (const session of sessions) {
      let key: string;
      const date = session.startTime;

      switch (granularity) {
        case 'hour':
          key = date.toISOString().substring(0, 13);
          break;
        case 'day':
          key = date.toISOString().substring(0, 10);
          break;
        case 'week': {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().substring(0, 10);
          break;
        }
        case 'month':
          key = date.toISOString().substring(0, 7);
          break;
      }

      dateCounts.set(key, (dateCounts.get(key) || 0) + 1);
    }

    return Array.from(dateCounts.entries())
      .map(([date, views]) => ({ date, views }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateInteractionHotspots(
    events: ViewEvent[],
  ): { slideId: string; x: number; y: number; count: number }[] {
    const hotspots = new Map<
      string,
      { slideId: string; x: number; y: number; count: number }
    >();

    for (const event of events) {
      if (
        event.eventType === 'interaction' &&
        event.slideId &&
        event.metadata?.x !== undefined
      ) {
        const x = Math.round(event.metadata.x / 50) * 50;
        const y = Math.round(event.metadata.y / 50) * 50;
        const key = `${event.slideId}:${x},${y}`;

        if (!hotspots.has(key)) {
          hotspots.set(key, { slideId: event.slideId, x, y, count: 0 });
        }
        hotspots.get(key)!.count++;
      }
    }

    return Array.from(hotspots.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }
}
