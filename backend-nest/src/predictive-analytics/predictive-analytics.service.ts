import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AIService } from '../ai/ai.service';

export interface PredictionMetrics {
  engagement: number;
  completion: number;
  conversion: number;
  shareability: number;
  overallScore: number;
}

export interface EngagementFactors {
  slideCount: number;
  averageWordsPerSlide: number;
  imageRatio: number;
  interactiveElements: number;
  videosIncluded: boolean;
  brandConsistency: number;
}

@Injectable()
export class PredictiveAnalyticsService {
  private readonly logger = new Logger(PredictiveAnalyticsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Generate predictive insights for a project
   */
  async generatePredictions(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        slides: {
          include: { blocks: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Calculate engagement factors
    const factors = this.calculateEngagementFactors(
      project as {
        slides: Array<{
          blocks: Array<{ blockType: string; content: unknown }>;
        }>;
      },
    );

    // Generate predictions
    const predictions = this.predictMetrics(factors);

    // Generate AI recommendations
    const recommendations = await this.generateRecommendations(
      factors,
      predictions,
    );

    // Store prediction
    const insight = await this.prisma.predictiveInsight.create({
      data: {
        projectId,
        userId,
        type: 'engagement',
        insightType: 'engagement_prediction',
        prediction: {
          metrics: predictions,
          factors,
        } as unknown as Prisma.InputJsonValue,
        recommendations: recommendations as unknown as Prisma.InputJsonValue,
        confidence: this.calculateConfidence(
          Array.isArray(project.analytics) ? project.analytics.length : 0,
        ),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Valid for 7 days
      },
    });

    // Create detailed engagement prediction
    await this.prisma.engagementPrediction.create({
      data: {
        projectId,
        predictedEngagement: predictions.engagement,
        predictedCompletion: predictions.completion,
        predictedShares: Math.round(predictions.shareability * 10),
        predictedScore: Math.round(predictions.overallScore * 100),
        factors: factors as unknown as Prisma.InputJsonValue,
        suggestions: recommendations as unknown as Prisma.InputJsonValue,
        modelVersion: '1.0.0',
      },
    });

    return {
      insight,
      predictions,
      factors,
      recommendations,
    };
  }

  /**
   * Calculate engagement factors from project data
   */
  private calculateEngagementFactors(project: {
    slides: Array<{ blocks: Array<{ blockType: string; content: unknown }> }>;
  }): EngagementFactors {
    const slides = project.slides;
    const totalBlocks = slides.flatMap((s) => s.blocks);

    let totalWords = 0;
    let imageCount = 0;
    let videoCount = 0;
    let interactiveCount = 0;

    totalBlocks.forEach((block) => {
      const content = (block.content as { text?: string }) || {};

      if (content.text) {
        totalWords += content.text.split(/\s+/).length;
      }

      if (block.blockType === 'image') imageCount++;
      if (block.blockType === 'video') videoCount++;
      if (['quiz', 'poll', 'form', 'button'].includes(block.blockType)) {
        interactiveCount++;
      }
    });

    const slideCount = slides.length;
    const averageWordsPerSlide = slideCount > 0 ? totalWords / slideCount : 0;
    const imageRatio =
      totalBlocks.length > 0 ? imageCount / totalBlocks.length : 0;

    return {
      slideCount,
      averageWordsPerSlide,
      imageRatio,
      interactiveElements: interactiveCount,
      videosIncluded: videoCount > 0,
      brandConsistency: 0.8, // Would calculate from style consistency
    };
  }

  /**
   * Predict engagement metrics based on factors
   */
  private predictMetrics(factors: EngagementFactors): PredictionMetrics {
    let engagement = 0.5; // Base engagement

    // Slide count impact (optimal: 8-15 slides)
    if (factors.slideCount >= 8 && factors.slideCount <= 15) {
      engagement += 0.15;
    } else if (factors.slideCount < 5 || factors.slideCount > 25) {
      engagement -= 0.1;
    }

    // Words per slide (optimal: 30-60 words)
    if (
      factors.averageWordsPerSlide >= 30 &&
      factors.averageWordsPerSlide <= 60
    ) {
      engagement += 0.1;
    } else if (factors.averageWordsPerSlide > 100) {
      engagement -= 0.15;
    }

    // Visual content boost
    if (factors.imageRatio >= 0.3) {
      engagement += 0.1;
    }

    // Video boost
    if (factors.videosIncluded) {
      engagement += 0.1;
    }

    // Interactive elements boost
    engagement += Math.min(factors.interactiveElements * 0.05, 0.15);

    // Brand consistency
    engagement += (factors.brandConsistency - 0.5) * 0.1;

    // Calculate completion (inversely related to length)
    let completion = 0.7;
    if (factors.slideCount > 20) completion -= 0.2;
    if (factors.slideCount <= 10) completion += 0.15;
    if (factors.averageWordsPerSlide > 80) completion -= 0.1;

    // Calculate shareability
    let shareability = 0.3;
    if (factors.imageRatio > 0.4) shareability += 0.2;
    if (factors.interactiveElements > 0) shareability += 0.15;
    if (factors.videosIncluded) shareability += 0.1;

    // Calculate conversion
    let conversion = 0.1;
    if (factors.interactiveElements > 2) conversion += 0.1;
    if (engagement > 0.7) conversion += 0.05;

    // Normalize all values between 0 and 1
    engagement = Math.max(0, Math.min(1, engagement));
    completion = Math.max(0, Math.min(1, completion));
    shareability = Math.max(0, Math.min(1, shareability));
    conversion = Math.max(0, Math.min(1, conversion));

    const overallScore =
      engagement * 0.4 +
      completion * 0.3 +
      shareability * 0.2 +
      conversion * 0.1;

    return {
      engagement: Math.round(engagement * 100) / 100,
      completion: Math.round(completion * 100) / 100,
      conversion: Math.round(conversion * 100) / 100,
      shareability: Math.round(shareability * 100) / 100,
      overallScore: Math.round(overallScore * 100) / 100,
    };
  }

  /**
   * Generate AI-powered recommendations
   */
  private async generateRecommendations(
    factors: EngagementFactors,
    predictions: PredictionMetrics,
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Rule-based recommendations
    if (factors.slideCount > 20) {
      recommendations.push(
        'Consider reducing slide count to under 20 for better completion rates',
      );
    }

    if (factors.averageWordsPerSlide > 80) {
      recommendations.push(
        'Reduce text density - aim for 30-60 words per slide',
      );
    }

    if (factors.imageRatio < 0.3) {
      recommendations.push('Add more visual content to increase engagement');
    }

    if (factors.interactiveElements === 0) {
      recommendations.push(
        'Add polls, quizzes, or interactive elements to boost engagement',
      );
    }

    if (!factors.videosIncluded) {
      recommendations.push(
        'Consider adding video content for higher shareability',
      );
    }

    if (predictions.engagement < 0.5) {
      recommendations.push(
        'Overall engagement is low - consider restructuring content',
      );
    }

    // AI-powered recommendations for more specific advice
    if (recommendations.length < 3) {
      try {
        const aiRecommendations = await this.aiService.generateText(
          `Based on these presentation analytics, provide 2 specific recommendations:
- Slide count: ${factors.slideCount}
- Words per slide: ${factors.averageWordsPerSlide}
- Image ratio: ${Math.round(factors.imageRatio * 100)}%
- Interactive elements: ${factors.interactiveElements}
- Predicted engagement: ${Math.round(predictions.engagement * 100)}%

Return only the recommendations, one per line.`,
          { maxTokens: 100 },
        );

        const aiRecs = aiRecommendations.split('\n').filter((r) => r.trim());
        recommendations.push(...aiRecs.slice(0, 2));
      } catch {
        // Use rule-based only if AI fails
      }
    }

    return recommendations.slice(0, 5);
  }

  /**
   * Calculate confidence based on historical data
   */
  private calculateConfidence(dataPoints: number): number {
    if (dataPoints >= 100) return 0.95;
    if (dataPoints >= 50) return 0.85;
    if (dataPoints >= 20) return 0.75;
    if (dataPoints >= 10) return 0.65;
    return 0.5; // Minimum confidence for new presentations
  }

  /**
   * Get prediction history for a project
   */
  async getPredictionHistory(projectId: string) {
    return this.prisma.predictiveInsight.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  /**
   * Compare actual vs predicted metrics
   */
  async compareActualVsPredicted(projectId: string) {
    const [predictions, analytics] = await Promise.all([
      this.prisma.engagementPrediction.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.presentationView.aggregate({
        where: { projectId },
        _count: true,
        _avg: {
          totalDuration: true,
        },
      }),
    ]);

    if (!predictions) {
      return { message: 'No predictions found' };
    }

    const totalAnalytics = analytics._count || 0;

    return {
      predicted: {
        engagement: predictions.predictedEngagement,
        completion: predictions.predictedCompletion,
      },
      actual: {
        views: totalAnalytics,
        avgDuration: analytics._avg?.totalDuration || 0,
        avgSlideReached: 0, // Not available in current schema
      },
      accuracy: this.calculateAccuracy(predictions, analytics),
    };
  }

  /**
   * Calculate prediction accuracy
   */
  private calculateAccuracy(
    predictions: {
      actualEngagement?: number | null;
      actualCompletion?: number | null;
      predictedEngagement?: number | null;
      predictedCompletion?: number | null;
    },
    _analytics: { _avg?: Record<string, number | null> | null },
  ): number | null {
    if (!predictions.actualEngagement) return null;
    if (
      predictions.predictedEngagement == null ||
      predictions.predictedCompletion == null
    )
      return null;

    const engagementError = Math.abs(
      (predictions.predictedEngagement || 0) -
        (predictions.actualEngagement || 0),
    );
    const completionError = Math.abs(
      (predictions.predictedCompletion || 0) -
        (predictions.actualCompletion || 0),
    );

    const avgError = (engagementError + completionError) / 2;
    return Math.round((1 - avgError) * 100) / 100;
  }

  /**
   * Get benchmarks for comparison
   */
  async getBenchmarks(projectId?: string) {
    // If a projectId is provided, limit benchmarks to that project; otherwise use global averages
    const where: { projectId?: string } | undefined = projectId
      ? { projectId }
      : undefined;

    const benchmarks = await this.prisma.engagementPrediction.aggregate({
      where,
      _avg: {
        predictedEngagement: true,
        predictedCompletion: true,
        predictedShares: true,
      },
    });

    return {
      averageEngagement: benchmarks._avg?.predictedEngagement ?? 0.5,
      averageCompletion: benchmarks._avg?.predictedCompletion ?? 0.6,
      averageShares: benchmarks._avg?.predictedShares ?? 5,
    };
  }

  /**
   * Schedule prediction updates
   */
  scheduleUpdate(_projectId: string, _userId: string) {
    // In production, this would create a scheduled job
    return {
      scheduled: true,
      nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }
}
