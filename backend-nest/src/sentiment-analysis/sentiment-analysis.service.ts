import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';

export interface SentimentMetrics {
  positive: number;
  neutral: number;
  negative: number;
  engagement: number;
  confusion: number;
  excitement: number;
}

interface AudienceSignal {
  type: 'reaction' | 'expression' | 'engagement' | 'question';
  value: string | number;
  timestamp: number;
  participantId?: string;
}

@Injectable()
export class SentimentAnalysisService {
  private readonly logger = new Logger(SentimentAnalysisService.name);
  private activeSessions = new Map<
    string,
    {
      signals: AudienceSignal[];
      lastSnapshot: Date;
    }
  >();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Start sentiment tracking session
   */
  async startSession(hostId: string, projectId: string, slideId?: string) {
    const session = await this.prisma.sentimentSession.create({
      data: {
        presenterId: hostId,
        projectId,
        slideId,
        status: 'active',
        startedAt: new Date(),
      },
    });

    this.activeSessions.set(session.id, {
      signals: [],
      lastSnapshot: new Date(),
    });

    return session;
  }

  /**
   * Record audience signal
   */
  async recordSignal(sessionId: string, signal: AudienceSignal) {
    const sessionData = this.activeSessions.get(sessionId);

    if (!sessionData) {
      const session = await this.prisma.sentimentSession.findUnique({
        where: { id: sessionId },
      });
      if (!session || session.status !== 'active') {
        throw new NotFoundException('Session not found or inactive');
      }
      this.activeSessions.set(sessionId, {
        signals: [signal],
        lastSnapshot: new Date(),
      });
    } else {
      sessionData.signals.push(signal);

      // Check if we should create a snapshot
      const settings = await this.getSessionSettings(sessionId);
      const timeSinceSnapshot = Date.now() - sessionData.lastSnapshot.getTime();

      if (timeSinceSnapshot >= settings.snapshotInterval * 1000) {
        await this.createSnapshot(sessionId);
      }
    }
  }

  /**
   * Record reaction (emoji, thumbs up/down)
   */
  async recordReaction(
    sessionId: string,
    reaction: string,
    participantId?: string,
  ) {
    return this.recordSignal(sessionId, {
      type: 'reaction',
      value: reaction,
      timestamp: Date.now(),
      participantId,
    });
  }

  /**
   * Record engagement metric (attention, participation)
   */
  async recordEngagement(
    sessionId: string,
    engagement: number,
    participantId?: string,
  ) {
    return this.recordSignal(sessionId, {
      type: 'engagement',
      value: Math.max(0, Math.min(1, engagement)),
      timestamp: Date.now(),
      participantId,
    });
  }

  /**
   * Analyze facial expressions (from video feed)
   */
  async analyzeExpression(
    sessionId: string,
    expressionData: {
      happy: number;
      sad: number;
      angry: number;
      surprised: number;
      neutral: number;
      confused: number;
    },
    participantId?: string,
  ) {
    // Determine dominant expression
    const expressions = Object.entries(expressionData);
    const _dominant = expressions.reduce((a, b) => (a[1] > b[1] ? a : b));

    return this.recordSignal(sessionId, {
      type: 'expression',
      value: JSON.stringify(expressionData),
      timestamp: Date.now(),
      participantId,
    });
  }

  /**
   * Create snapshot of current sentiment
   */
  async createSnapshot(sessionId: string): Promise<SentimentMetrics> {
    const sessionData = this.activeSessions.get(sessionId);

    if (!sessionData || sessionData.signals.length === 0) {
      return this.getDefaultMetrics();
    }

    const metrics = this.calculateMetrics(sessionData.signals);

    // Get current slide if available
    const session = await this.prisma.sentimentSession.findUnique({
      where: { id: sessionId },
    });

    // Store snapshot
    const dominantSentiment =
      metrics.positive > metrics.negative
        ? 'positive'
        : metrics.negative > metrics.neutral
          ? 'negative'
          : 'neutral';
    const confidence = Math.max(
      metrics.positive,
      metrics.negative,
      metrics.neutral,
    );

    await this.prisma.sentimentSnapshot.create({
      data: {
        sessionId,
        slideIndex: 0, // Default, can be updated based on current slide
        slideId: session?.slideId,
        sentiment: dominantSentiment,
        confidence,
        participantCount: this.getUniqueParticipants(sessionData.signals),
        timestamp: new Date(),
      },
    });

    // Clear processed signals and update timestamp
    sessionData.signals = [];
    sessionData.lastSnapshot = new Date();

    // Check for alerts
    await this.checkAlerts(sessionId, metrics);

    return metrics;
  }

  /**
   * Calculate metrics from signals
   */
  private calculateMetrics(signals: AudienceSignal[]): SentimentMetrics {
    const metrics: SentimentMetrics = {
      positive: 0,
      neutral: 0,
      negative: 0,
      engagement: 0,
      confusion: 0,
      excitement: 0,
    };

    if (signals.length === 0) return metrics;

    let positiveCount = 0;
    let negativeCount = 0;
    let engagementSum = 0;
    let engagementCount = 0;
    let confusionCount = 0;
    let excitementCount = 0;

    const positiveReactions = [
      '👍',
      '❤️',
      '😊',
      '🎉',
      '👏',
      'like',
      'love',
      'great',
    ];
    const negativeReactions = ['👎', '😕', '😴', 'confused', 'bored'];
    const excitedReactions = ['🎉', '🔥', '💯', 'wow', 'amazing'];

    for (const signal of signals) {
      if (signal.type === 'reaction') {
        const reaction = String(signal.value).toLowerCase();

        if (positiveReactions.some((r) => reaction.includes(r))) {
          positiveCount++;
        } else if (negativeReactions.some((r) => reaction.includes(r))) {
          negativeCount++;
        }

        if (excitedReactions.some((r) => reaction.includes(r))) {
          excitementCount++;
        }
      } else if (signal.type === 'engagement') {
        engagementSum += Number(signal.value);
        engagementCount++;
      } else if (signal.type === 'expression') {
        try {
          const expr = JSON.parse(String(signal.value));
          if (expr.confused > 0.5) confusionCount++;
          if (expr.happy > 0.5) positiveCount++;
          if (expr.sad > 0.3 || expr.angry > 0.3) negativeCount++;
          if (expr.surprised > 0.5) excitementCount++;
        } catch {
          // Skip invalid expression data
        }
      }
    }

    const total = Math.max(positiveCount + negativeCount + 1, signals.length);

    metrics.positive = positiveCount / total;
    metrics.negative = negativeCount / total;
    metrics.neutral = 1 - metrics.positive - metrics.negative;
    metrics.engagement =
      engagementCount > 0 ? engagementSum / engagementCount : 0.5;
    metrics.confusion = confusionCount / signals.length;
    metrics.excitement = excitementCount / signals.length;

    return metrics;
  }

  /**
   * Get unique participant count
   */
  private getUniqueParticipants(signals: AudienceSignal[]): number {
    const participants = new Set(
      signals.filter((s) => s.participantId).map((s) => s.participantId),
    );
    return participants.size || 1;
  }

  /**
   * Check and send alerts
   */
  private async checkAlerts(sessionId: string, metrics: SentimentMetrics) {
    const settings = await this.getSessionSettings(sessionId);

    const alerts: string[] = [];

    if (metrics.negative > settings.alertThreshold) {
      alerts.push('High negative sentiment detected');
    }

    if (metrics.confusion > 0.4) {
      alerts.push('Audience appears confused');
    }

    if (metrics.engagement < 0.3) {
      alerts.push('Low engagement detected');
    }

    if (alerts.length > 0) {
      // In production, send real-time alerts via WebSocket
      this.logger.warn(`Session ${sessionId} alerts: ${alerts.join(', ')}`);
    }

    return alerts;
  }

  /**
   * Get session settings
   */
  private async getSessionSettings(sessionId: string) {
    const session = await this.prisma.sentimentSession.findUnique({
      where: { id: sessionId },
    });

    const settings =
      (session?.settings as {
        trackReactions?: boolean;
        trackExpressions?: boolean;
        snapshotInterval?: number;
        alertThreshold?: number;
      }) || {};

    return {
      trackReactions: settings.trackReactions ?? true,
      trackExpressions: settings.trackExpressions ?? true,
      snapshotInterval: settings.snapshotInterval ?? 30,
      alertThreshold: settings.alertThreshold ?? 0.3,
    };
  }

  /**
   * Get default metrics
   */
  private getDefaultMetrics(): SentimentMetrics {
    return {
      positive: 0,
      neutral: 1,
      negative: 0,
      engagement: 0.5,
      confusion: 0,
      excitement: 0,
    };
  }

  /**
   * Get current sentiment
   */
  async getCurrentSentiment(sessionId: string): Promise<SentimentMetrics> {
    const sessionData = this.activeSessions.get(sessionId);

    if (!sessionData || sessionData.signals.length === 0) {
      // Get last snapshot
      const lastSnapshot = await this.prisma.sentimentSnapshot.findFirst({
        where: { sessionId },
        orderBy: { timestamp: 'desc' },
      });

      return (
        (lastSnapshot?.metrics as unknown as SentimentMetrics) ||
        this.getDefaultMetrics()
      );
    }

    return this.calculateMetrics(sessionData.signals);
  }

  /**
   * Get sentiment timeline
   */
  async getSentimentTimeline(sessionId: string) {
    const snapshots = await this.prisma.sentimentSnapshot.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
    });

    return snapshots.map((s) => ({
      timestamp: s.timestamp,
      slideId: s.slideId,
      metrics: s.metrics as unknown as SentimentMetrics,
      participants: s.participantCount,
    }));
  }

  /**
   * Get sentiment summary
   */
  async getSentimentSummary(sessionId: string) {
    const session = await this.prisma.sentimentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const snapshots = await this.prisma.sentimentSnapshot.findMany({
      where: { sessionId },
    });

    if (snapshots.length === 0) {
      return {
        session,
        summary: this.getDefaultMetrics(),
        snapshotCount: 0,
      };
    }

    // Calculate average metrics
    const avgMetrics: SentimentMetrics = {
      positive: 0,
      neutral: 0,
      negative: 0,
      engagement: 0,
      confusion: 0,
      excitement: 0,
    };

    snapshots.forEach((s) => {
      const m = s.metrics as unknown as SentimentMetrics;
      avgMetrics.positive += m.positive;
      avgMetrics.neutral += m.neutral;
      avgMetrics.negative += m.negative;
      avgMetrics.engagement += m.engagement;
      avgMetrics.confusion += m.confusion;
      avgMetrics.excitement += m.excitement;
    });

    const count = snapshots.length;
    Object.keys(avgMetrics).forEach((key) => {
      avgMetrics[key as keyof SentimentMetrics] /= count;
    });

    // Find peak moments
    const peakPositive = snapshots.reduce((max, s) => {
      const m = s.metrics as unknown as SentimentMetrics;
      return m.positive >
        (max?.metrics as unknown as SentimentMetrics)?.positive
        ? s
        : max;
    }, snapshots[0]);

    const peakNegative = snapshots.reduce((max, s) => {
      const m = s.metrics as unknown as SentimentMetrics;
      return m.negative >
        (max?.metrics as unknown as SentimentMetrics)?.negative
        ? s
        : max;
    }, snapshots[0]);

    return {
      session,
      summary: avgMetrics,
      snapshotCount: count,
      peaks: {
        mostPositive: {
          timestamp: peakPositive.timestamp,
          slideId: peakPositive.slideId,
        },
        mostEngaged: {
          timestamp: peakPositive.timestamp,
          slideId: peakPositive.slideId,
        },
        leastEngaged: {
          timestamp: peakNegative.timestamp,
          slideId: peakNegative.slideId,
        },
      },
    };
  }

  /**
   * End sentiment session
   */
  async endSession(sessionId: string, hostId: string) {
    const session = await this.prisma.sentimentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.presenterId !== hostId) {
      throw new NotFoundException('Session not found or unauthorized');
    }

    // Create final snapshot if there are pending signals
    const sessionData = this.activeSessions.get(sessionId);
    if (sessionData && sessionData.signals.length > 0) {
      await this.createSnapshot(sessionId);
    }

    this.activeSessions.delete(sessionId);

    return this.prisma.sentimentSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        endedAt: new Date(),
      },
    });
  }

  /**
   * Generate AI insights from sentiment data
   */
  async generateInsights(sessionId: string) {
    const summary = await this.getSentimentSummary(sessionId);
    const timeline = await this.getSentimentTimeline(sessionId);

    try {
      const insights = await this.aiService.generateText(
        `Analyze this presentation sentiment data and provide actionable insights:

Average Metrics:
- Positive: ${Math.round(summary.summary.positive * 100)}%
- Negative: ${Math.round(summary.summary.negative * 100)}%
- Engagement: ${Math.round(summary.summary.engagement * 100)}%
- Confusion: ${Math.round(summary.summary.confusion * 100)}%

Timeline has ${timeline.length} data points.
Peak positive at ${String(summary.peaks?.mostPositive?.timestamp ?? 'N/A')}
Lowest engagement at ${String(summary.peaks?.leastEngaged?.timestamp ?? 'N/A')}

Provide 3-5 specific insights and recommendations.`,
        { maxTokens: 300 },
      );

      return { summary: summary.summary, insights };
    } catch {
      return {
        summary: summary.summary,
        insights: 'Unable to generate AI insights',
      };
    }
  }
}
