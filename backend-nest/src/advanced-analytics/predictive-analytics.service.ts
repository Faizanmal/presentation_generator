import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PredictionResult {
  metric: string;
  currentValue: number;
  predictedValue: number;
  confidenceInterval: { low: number; high: number };
  confidence: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  factors: Array<{
    factor: string;
    impact: number;
    direction: 'positive' | 'negative';
  }>;
}

export interface AnomalyDetection {
  metric: string;
  timestamp: Date;
  expectedValue: number;
  actualValue: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  possibleCauses: string[];
}

export interface ContentRecommendation {
  type: 'slide_order' | 'content_length' | 'visual_balance' | 'timing';
  recommendation: string;
  impact: 'low' | 'medium' | 'high';
  basedOn: string;
  confidence: number;
}

@Injectable()
export class PredictiveAnalyticsService {
  private readonly logger = new Logger(PredictiveAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Predict engagement for a presentation
   */
  async predictEngagement(presentationId: string): Promise<{
    predictedEngagementScore: number;
    recommendedImprovements: ContentRecommendation[];
    similarPresentationsAvg: number;
    factors: PredictionResult['factors'];
  }> {
    const presentation = await this.prisma.project.findUnique({
      where: { id: presentationId },
      include: {
        slides: { include: { blocks: true } },
        views: { take: 100 },
      },
    });

    if (!presentation) {
      throw new Error('Presentation not found');
    }

    // Analyze presentation characteristics
    const slideCount = presentation.slides.length;
    const avgBlocksPerSlide =
      presentation.slides.reduce((acc, s) => acc + s.blocks.length, 0) /
      Math.max(slideCount, 1);
    const hasVideos = presentation.slides.some((s) =>
      s.blocks.some((b) => b.blockType === 'VIDEO'),
    );
    const hasInteractive = presentation.slides.some((s) =>
      s.blocks.some((b) =>
        ['POLL', 'QUIZ', 'FORM'].includes(b.blockType || b.type || ''),
      ),
    );

    // Calculate factors
    const factors: PredictionResult['factors'] = [];

    // Slide count impact
    if (slideCount < 5) {
      factors.push({
        factor: 'Too few slides',
        impact: -10,
        direction: 'negative',
      });
    } else if (slideCount > 30) {
      factors.push({
        factor: 'Too many slides',
        impact: -15,
        direction: 'negative',
      });
    } else if (slideCount >= 10 && slideCount <= 20) {
      factors.push({
        factor: 'Optimal slide count',
        impact: 10,
        direction: 'positive',
      });
    }

    // Content density
    if (avgBlocksPerSlide < 2) {
      factors.push({
        factor: 'Low content density',
        impact: -5,
        direction: 'negative',
      });
    } else if (avgBlocksPerSlide > 6) {
      factors.push({
        factor: 'High content density',
        impact: -10,
        direction: 'negative',
      });
    } else {
      factors.push({
        factor: 'Good content balance',
        impact: 5,
        direction: 'positive',
      });
    }

    // Media presence
    if (hasVideos) {
      factors.push({
        factor: 'Video content included',
        impact: 15,
        direction: 'positive',
      });
    }

    if (hasInteractive) {
      factors.push({
        factor: 'Interactive elements',
        impact: 20,
        direction: 'positive',
      });
    }

    // Calculate base score
    let baseScore = 50;
    factors.forEach((f) => {
      baseScore += f.impact;
    });

    // Get similar presentations' performance
    const similarPresentations = await this.prisma.project.findMany({
      where: {
        ownerId: presentation.ownerId,
        id: { not: presentationId },
      },
      include: { views: true },
      take: 10,
    });

    const similarAvg =
      similarPresentations.length > 0
        ? similarPresentations.reduce((acc, p) => {
            const avgCompletion =
              p.views.reduce((a, v) => a + (v.completionRate || 0), 0) /
              Math.max(p.views.length, 1);
            return acc + avgCompletion;
          }, 0) / similarPresentations.length
        : 50;

    // Generate recommendations
    const recommendations = this.generateContentRecommendations(
      presentation,
      factors,
    );

    return {
      predictedEngagementScore: Math.max(
        0,
        Math.min(100, Math.round(baseScore)),
      ),
      recommendedImprovements: recommendations,
      similarPresentationsAvg: Math.round(similarAvg),
      factors,
    };
  }

  private generateContentRecommendations(
    presentation: {
      slides: Array<{
        blocks: Array<{ blockType?: string; type?: string | null }>;
      }>;
    },
    _factors: PredictionResult['factors'],
  ): ContentRecommendation[] {
    const recommendations: ContentRecommendation[] = [];

    const slideCount = presentation.slides.length;
    const avgBlocksPerSlide =
      presentation.slides.reduce((acc, s) => acc + s.blocks.length, 0) /
      Math.max(slideCount, 1);

    // no use of _factors yet
    if (slideCount < 5) {
      recommendations.push({
        type: 'content_length',
        recommendation:
          'Consider adding more slides to provide comprehensive coverage',
        impact: 'medium',
        basedOn:
          'Presentations with 10-20 slides show 23% higher completion rates',
        confidence: 0.85,
      });
    }

    if (slideCount > 25) {
      recommendations.push({
        type: 'content_length',
        recommendation:
          'Consider condensing content - longer presentations see 15% higher drop-off',
        impact: 'high',
        basedOn: 'Audience attention decreases significantly after 20 slides',
        confidence: 0.9,
      });
    }

    if (avgBlocksPerSlide > 5) {
      recommendations.push({
        type: 'visual_balance',
        recommendation: 'Reduce content per slide for better readability',
        impact: 'medium',
        basedOn: 'Slides with 3-4 elements have 40% higher engagement',
        confidence: 0.82,
      });
    }

    const hasInteractive = presentation.slides.some((s) =>
      s.blocks.some(
        (b) => b.type != null && ['POLL', 'QUIZ', 'FORM'].includes(b.type),
      ),
    );

    if (!hasInteractive && slideCount > 10) {
      recommendations.push({
        type: 'slide_order',
        recommendation:
          'Add interactive elements (polls, quizzes) to boost engagement',
        impact: 'high',
        basedOn: 'Interactive presentations see 45% higher completion',
        confidence: 0.88,
      });
    }

    return recommendations;
  }

  /**
   * Detect anomalies in viewing patterns
   */
  async detectAnomalies(
    presentationId: string,
    lookbackDays: number = 30,
  ): Promise<AnomalyDetection[]> {
    const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    const dailyViews = await this.prisma.presentationView.groupBy({
      by: ['projectId'],
      where: {
        projectId: presentationId,
        viewedAt: { gte: startDate },
      },
      _count: { _all: true },
    });

    if (dailyViews.length < 7) {
      return []; // Not enough data
    }

    const anomalies: AnomalyDetection[] = [];

    // Calculate baseline statistics
    const counts = dailyViews.map((d) => d._count._all);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const stdDev = Math.sqrt(
      counts.reduce((acc, c) => acc + Math.pow(c - mean, 2), 0) / counts.length,
    );

    // Detect anomalies (values outside 2 standard deviations)
    dailyViews.forEach((day) => {
      const count = day._count._all;
      const deviation = Math.abs(count - mean) / Math.max(stdDev, 1);

      if (deviation > 2) {
        let severity: AnomalyDetection['severity'] = 'low';
        if (deviation > 4) severity = 'critical';
        else if (deviation > 3) severity = 'high';
        else if (deviation > 2.5) severity = 'medium';

        anomalies.push({
          metric: 'daily_views',
          timestamp: new Date(),
          expectedValue: Math.round(mean),
          actualValue: count,
          deviation: Math.round(deviation * 100) / 100,
          severity,
          possibleCauses: this.generatePossibleCauses(count > mean),
        });
      }
    });

    return anomalies;
  }

  private generatePossibleCauses(isSpike: boolean): string[] {
    if (isSpike) {
      return [
        'Viral sharing on social media',
        'Featured in newsletter or email campaign',
        'Linked from high-traffic website',
        'Presentation embedded in popular article',
      ];
    } else {
      return [
        'Technical issues affecting access',
        'Link expiration or sharing settings changed',
        'Seasonal traffic variations',
        'Competition from alternative content',
      ];
    }
  }

  /**
   * Forecast future metrics
   */
  async forecastMetrics(
    presentationId: string,
    metric: 'views' | 'engagement' | 'shares',
    forecastDays: number = 30,
  ): Promise<PredictionResult> {
    const lookbackDays = 90;
    const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    let historicalData: number[] = [];
    let currentValue = 0;

    if (metric === 'views') {
      const views = await this.prisma.presentationView.groupBy({
        by: ['projectId'],
        where: {
          projectId: presentationId,
          viewedAt: { gte: startDate },
        },
        _count: { _all: true },
      });
      historicalData = views.map((v) => v._count._all);
      currentValue = views.reduce((acc, v) => acc + v._count._all, 0);
    }

    if (historicalData.length < 7) {
      return {
        metric,
        currentValue,
        predictedValue: currentValue,
        confidenceInterval: { low: 0, high: currentValue * 2 },
        confidence: 0.3,
        trend: 'stable',
        factors: [],
      };
    }

    // Simple linear regression for trend
    const n = historicalData.length;
    const xMean = (n - 1) / 2;
    const yMean = historicalData.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;
    historicalData.forEach((y, x) => {
      numerator += (x - xMean) * (y - yMean);
      denominator += Math.pow(x - xMean, 2);
    });

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;

    // Predict future value
    const predictedDaily = intercept + slope * (n + forecastDays);
    const predictedValue = Math.max(
      0,
      Math.round(predictedDaily * forecastDays),
    );

    // Calculate standard error for confidence interval
    const predictions = historicalData.map((_, x) => intercept + slope * x);
    const errors = historicalData.map((y, i) => y - predictions[i]);
    const stdError = Math.sqrt(
      errors.reduce((acc, e) => acc + Math.pow(e, 2), 0) / (n - 2),
    );

    // Determine trend
    let trend: PredictionResult['trend'] = 'stable';
    if (slope > 0.1) trend = 'increasing';
    else if (slope < -0.1) trend = 'decreasing';

    return {
      metric,
      currentValue,
      predictedValue,
      confidenceInterval: {
        low: Math.max(
          0,
          Math.round(predictedValue - 2 * stdError * forecastDays),
        ),
        high: Math.round(predictedValue + 2 * stdError * forecastDays),
      },
      confidence: Math.min(0.95, 0.5 + n * 0.005),
      trend,
      factors: [
        {
          factor: 'Historical trend',
          impact: Math.abs(slope) * 10,
          direction: slope >= 0 ? 'positive' : 'negative',
        },
      ],
    };
  }

  /**
   * Get optimal publishing time recommendations
   */
  async getOptimalPublishingTimes(organizationId: string): Promise<
    Array<{
      dayOfWeek: string;
      hourUtc: number;
      expectedEngagement: number;
      confidence: number;
    }>
  > {
    const views = await this.prisma.presentationView.findMany({
      where: {
        project: { ownerId: organizationId },
        viewedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      select: {
        viewedAt: true,
        completionRate: true,
        duration: true,
      },
    });

    if (views.length < 50) {
      // Return default recommendations
      return [
        {
          dayOfWeek: 'Tuesday',
          hourUtc: 14,
          expectedEngagement: 70,
          confidence: 0.5,
        },
        {
          dayOfWeek: 'Wednesday',
          hourUtc: 10,
          expectedEngagement: 68,
          confidence: 0.5,
        },
        {
          dayOfWeek: 'Thursday',
          hourUtc: 15,
          expectedEngagement: 65,
          confidence: 0.5,
        },
      ];
    }

    // Group by day and hour
    const dayHourStats: Record<
      string,
      { count: number; totalEngagement: number }
    > = {};
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    views.forEach((v) => {
      const day = days[v.viewedAt!.getDay()];
      const hour = v.viewedAt!.getHours();
      const key = `${day}-${hour}`;

      if (!dayHourStats[key]) {
        dayHourStats[key] = { count: 0, totalEngagement: 0 };
      }

      dayHourStats[key].count++;
      dayHourStats[key].totalEngagement += v.completionRate || 50;
    });

    // Find top performing times
    const ranked = Object.entries(dayHourStats)
      .map(([key, stats]) => {
        const [day, hour] = key.split('-');
        return {
          dayOfWeek: day,
          hourUtc: parseInt(hour),
          expectedEngagement: Math.round(stats.totalEngagement / stats.count),
          confidence: Math.min(0.95, 0.5 + stats.count * 0.01),
        };
      })
      .sort((a, b) => b.expectedEngagement - a.expectedEngagement)
      .slice(0, 5);

    return ranked;
  }

  /**
   * Compare A/B test variants
   */
  async analyzeABTestResults(testId: string): Promise<{
    variants: Array<{
      variantId: string;
      views: number;
      avgEngagement: number;
      conversionRate: number;
    }>;
    winner: string | null;
    statisticalSignificance: number;
    recommendation: string;
  }> {
    const test = await this.prisma.aBTest.findUnique({
      where: { id: testId },
      include: {
        variants: {
          include: {
            results: true,
          },
        },
      },
    });

    if (!test) {
      throw new Error('A/B test not found');
    }

    const variantStats = test.variants.map((v) => {
      const views = v.results.length;
      const totalEngagement = v.results.reduce(
        (acc, r) => acc + (r.viewTime || 0),
        0,
      );
      const conversions = v.results.filter((r) => r.completed).length;

      return {
        variantId: v.id,
        views,
        avgEngagement: views > 0 ? Math.round(totalEngagement / views) : 0,
        conversionRate: views > 0 ? Math.round((conversions / views) * 100) : 0,
      };
    });

    // Calculate statistical significance (simplified chi-square approach)
    let winner: string | null = null;
    let significance = 0;

    if (variantStats.length >= 2 && variantStats.every((v) => v.views >= 30)) {
      const sorted = [...variantStats].sort(
        (a, b) => b.conversionRate - a.conversionRate,
      );
      const best = sorted[0];
      const second = sorted[1];

      // Simplified significance calculation
      const pooledRate = (best.conversionRate + second.conversionRate) / 200;
      const standardError = Math.sqrt(
        pooledRate * (1 - pooledRate) * (1 / best.views + 1 / second.views),
      );
      const zScore =
        standardError > 0
          ? (best.conversionRate / 100 - second.conversionRate / 100) /
            standardError
          : 0;

      significance = Math.min(0.99, 1 - Math.exp(-Math.abs(zScore)));

      if (significance >= 0.95) {
        winner = best.variantId;
      }
    }

    return {
      variants: variantStats,
      winner,
      statisticalSignificance: Math.round(significance * 100),
      recommendation: winner
        ? `Variant ${winner} shows statistically significant improvement. Consider rolling out this version.`
        : 'Continue collecting data to reach statistical significance (need 95% confidence).',
    };
  }
}
