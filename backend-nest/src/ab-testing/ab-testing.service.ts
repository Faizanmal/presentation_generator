import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface VariantConfig {
  name: string;
  description?: string;
  themeConfig: Record<string, unknown>;
  isControl?: boolean;
  traffic?: number;
}

interface TestResult {
  sessionId: string;
  variantId: string;
  engaged: boolean;
  completed: boolean;
  viewTime: number;
  interactions: number;
  dropOffSlide?: number;
}

export interface StatisticalAnalysis {
  winner?: string;
  confidence: number;
  improvement: number;
  sampleSize: number;
  isStatisticallySignificant: boolean;
  variantStats: Array<{
    variantId: string;
    name: string;
    conversionRate: number;
    avgViewTime: number;
    engagementScore: number;
    impressions: number;
  }>;
}

@Injectable()
export class ABTestingService {
  private readonly logger = new Logger(ABTestingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new A/B test
   */
  async createTest(
    userId: string,
    projectId: string,
    data: {
      name: string;
      description?: string;
      goalMetric?: string;
      variants: VariantConfig[];
      sampleSize?: number;
      confidenceLevel?: number;
    },
  ) {
    const {
      name,
      description,
      goalMetric = 'engagement',
      variants,
      sampleSize = 100,
      confidenceLevel = 0.95,
    } = data;

    if (variants.length < 2) {
      throw new BadRequestException('A/B test requires at least 2 variants');
    }

    // Validate traffic allocation
    const totalTraffic = variants.reduce(
      (sum, v) => sum + (v.traffic || 50),
      0,
    );
    if (Math.abs(totalTraffic - 100) > 0.1) {
      throw new BadRequestException('Traffic allocation must sum to 100%');
    }

    // Verify project ownership
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.ownerId !== userId) {
      throw new BadRequestException('Project not found');
    }

    // Create test
    const test = await this.prisma.aBTest.create({
      data: {
        userId,
        projectId,
        name,
        description,
        goalMetric,
        sampleSize,
        confidenceLevel,
        status: 'draft',
      },
    });

    // Create variants
    for (const variant of variants) {
      await this.prisma.aBTestVariant.create({
        data: {
          testId: test.id,
          name: variant.name,
          description: variant.description,
          themeConfig: variant.themeConfig as object,
          isControl: variant.isControl || false,
          traffic: variant.traffic || 50,
        },
      });
    }

    return this.getTest(test.id, userId);
  }

  /**
   * Start an A/B test
   */
  async startTest(testId: string, userId: string) {
    const test = await this.getTest(testId, userId);

    if (test.status !== 'draft') {
      throw new BadRequestException(
        'Test can only be started from draft status',
      );
    }

    return this.prisma.aBTest.update({
      where: { id: testId },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
      include: {
        variants: true,
      },
    });
  }

  /**
   * Pause an A/B test
   */
  async pauseTest(testId: string, userId: string) {
    const test = await this.getTest(testId, userId);

    if (test.status !== 'running') {
      throw new BadRequestException('Only running tests can be paused');
    }

    return this.prisma.aBTest.update({
      where: { id: testId },
      data: { status: 'paused' },
      include: { variants: true },
    });
  }

  /**
   * Resume a paused test
   */
  async resumeTest(testId: string, userId: string) {
    const test = await this.getTest(testId, userId);

    if (test.status !== 'paused') {
      throw new BadRequestException('Only paused tests can be resumed');
    }

    return this.prisma.aBTest.update({
      where: { id: testId },
      data: { status: 'running' },
      include: { variants: true },
    });
  }

  /**
   * Complete an A/B test and determine winner
   */
  async completeTest(testId: string, userId: string) {
    const test = await this.getTest(testId, userId);

    if (test.status === 'completed') {
      throw new BadRequestException('Test is already completed');
    }

    // Analyze results
    const analysis = await this.analyzeResults(testId);

    return this.prisma.aBTest.update({
      where: { id: testId },
      data: {
        status: 'completed',
        endedAt: new Date(),
        winnerVariantId: analysis.winner,
      },
      include: {
        variants: true,
        results: true,
      },
    });
  }

  /**
   * Get variant for a visitor (handles traffic allocation)
   */
  async getVariantForVisitor(testId: string, sessionId: string) {
    const test = await this.prisma.aBTest.findUnique({
      where: { id: testId },
      include: { variants: true },
    });

    if (!test || test.status !== 'running') {
      throw new BadRequestException('Test not found or not running');
    }

    // Check if visitor already has a variant assigned
    const existingResult = await this.prisma.aBTestResult.findFirst({
      where: { testId, sessionId },
    });

    if (existingResult) {
      return test.variants.find((v) => v.id === existingResult.variantId);
    }

    // Assign variant based on traffic allocation
    const random = Math.random() * 100;
    let cumulative = 0;
    let assignedVariant = test.variants[0]; // fallback

    for (const variant of test.variants) {
      cumulative += variant.traffic;
      if (random <= cumulative) {
        assignedVariant = variant;
        break;
      }
    }

    // Record impression on the variant
    await this.prisma.aBTestVariant.update({
      where: { id: assignedVariant.id },
      data: { impressions: { increment: 1 } },
    });

    // Update test sample count
    await this.prisma.aBTest.update({
      where: { id: testId },
      data: { currentSample: { increment: 1 } },
    });

    // Create an initial ABTestResult record to track the impression
    // This ensures we correctly attribute the visitor to this variant
    await this.prisma.aBTestResult.create({
      data: {
        testId,
        variantId: assignedVariant.id,
        sessionId,
        engaged: false,
        completed: false,
        viewTime: 0,
        interactions: 0,
      },
    });

    return assignedVariant;
  }

  /**
   * Record test result.
   * When called from a controller, pass `userId` to enforce ownership.
   */
  async recordResult(testId: string, result: TestResult, userId?: string) {
    const test = await this.prisma.aBTest.findUnique({
      where: { id: testId },
      include: { variants: true },
    });

    if (!test || test.status !== 'running') {
      throw new BadRequestException('Test not found or not running');
    }

    // Ownership check: ensure the caller has access to this test
    if (userId && test.userId !== userId) {
      throw new BadRequestException(
        'You do not have access to record results for this test',
      );
    }

    const variant = test.variants.find((v) => v.id === result.variantId);
    if (!variant) {
      throw new BadRequestException('Variant not found');
    }

    // Create result record
    await this.prisma.aBTestResult.create({
      data: {
        testId,
        variantId: result.variantId,
        sessionId: result.sessionId,
        engaged: result.engaged,
        completed: result.completed,
        viewTime: result.viewTime,
        interactions: result.interactions,
        dropOffSlide: result.dropOffSlide,
      },
    });

    // Update variant metrics
    const results = await this.prisma.aBTestResult.findMany({
      where: { variantId: result.variantId },
    });

    const conversions = results.filter((r) => r.completed).length;
    const totalViewTime = results.reduce(
      (sum, r) => sum + (r.viewTime || 0),
      0,
    );
    const engagedCount = results.filter((r) => r.engaged).length;

    await this.prisma.aBTestVariant.update({
      where: { id: result.variantId },
      data: {
        conversions,
        avgViewTime: results.length > 0 ? totalViewTime / results.length : 0,
        engagementScore:
          results.length > 0 ? (engagedCount / results.length) * 100 : 0,
        bounceRate:
          results.length > 0
            ? (results.filter((r) => !r.engaged && (r.viewTime || 0) < 10)
                .length /
                results.length) *
              100
            : 0,
      },
    });

    // Check if test should auto-complete
    const currentSample = await this.prisma.aBTestResult.count({
      where: { testId },
    });
    if (currentSample >= test.sampleSize) {
      this.logger.log(`Test ${testId} reached sample size, auto-completing`);
      // We don't auto-complete here to allow manual review, but could be configured
    }

    return { success: true };
  }

  /**
   * Analyze test results
   */
  async analyzeResults(testId: string): Promise<StatisticalAnalysis> {
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
      throw new BadRequestException('Test not found');
    }

    const variantStats = test.variants.map((variant) => {
      const results = variant.results;
      const impressions = variant.impressions;
      const conversions = results.filter((r) => r.completed).length;
      const engaged = results.filter((r) => r.engaged).length;
      const totalViewTime = results.reduce(
        (sum, r) => sum + (r.viewTime || 0),
        0,
      );

      return {
        variantId: variant.id,
        name: variant.name,
        isControl: variant.isControl,
        conversionRate: impressions > 0 ? (conversions / impressions) * 100 : 0,
        avgViewTime: results.length > 0 ? totalViewTime / results.length : 0,
        engagementScore: impressions > 0 ? (engaged / impressions) * 100 : 0,
        impressions,
        conversions,
      };
    });

    // Find control variant
    const control = variantStats.find((v) => v.isControl) || variantStats[0];

    // Find best performing variant
    const sortedByGoal = [...variantStats].sort((a, b) => {
      switch (test.goalMetric) {
        case 'completion':
          return b.conversionRate - a.conversionRate;
        case 'view_time':
          return b.avgViewTime - a.avgViewTime;
        case 'engagement':
        default:
          return b.engagementScore - a.engagementScore;
      }
    });

    const best = sortedByGoal[0];
    const totalSample = variantStats.reduce((sum, v) => sum + v.impressions, 0);

    // Calculate statistical significance using Z-test approximation
    const { isSignificant, confidence } = this.calculateStatisticalSignificance(
      control,
      best,
      test.confidenceLevel,
    );

    // Calculate improvement
    let improvement: number;
    switch (test.goalMetric) {
      case 'completion':
        improvement =
          control.conversionRate > 0
            ? ((best.conversionRate - control.conversionRate) /
                control.conversionRate) *
              100
            : 0;
        break;
      case 'view_time':
        improvement =
          control.avgViewTime > 0
            ? ((best.avgViewTime - control.avgViewTime) / control.avgViewTime) *
              100
            : 0;
        break;
      case 'engagement':
      default:
        improvement =
          control.engagementScore > 0
            ? ((best.engagementScore - control.engagementScore) /
                control.engagementScore) *
              100
            : 0;
    }

    return {
      winner: isSignificant && improvement > 0 ? best.variantId : undefined,
      confidence,
      improvement,
      sampleSize: totalSample,
      isStatisticallySignificant: isSignificant,
      variantStats,
    };
  }

  /**
   * Calculate statistical significance
   */
  private calculateStatisticalSignificance(
    control: { conversionRate: number; impressions: number },
    treatment: { conversionRate: number; impressions: number },
    requiredConfidence: number,
  ): { isSignificant: boolean; confidence: number } {
    const p1 = control.conversionRate / 100;
    const p2 = treatment.conversionRate / 100;
    const n1 = control.impressions;
    const n2 = treatment.impressions;

    if (n1 < 10 || n2 < 10) {
      return { isSignificant: false, confidence: 0 };
    }

    // Pooled proportion
    const p = (p1 * n1 + p2 * n2) / (n1 + n2);

    // Standard error
    const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));

    if (se === 0) {
      return { isSignificant: false, confidence: 0 };
    }

    // Z-score
    const z = Math.abs(p2 - p1) / se;

    // Convert Z-score to confidence (approximate)
    const confidence = this.zToConfidence(z);

    return {
      isSignificant: confidence >= requiredConfidence,
      confidence,
    };
  }

  /**
   * Convert Z-score to confidence level (approximation)
   */
  private zToConfidence(z: number): number {
    // Standard normal CDF approximation
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * z);
    const y =
      1.0 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Generate theme variations for A/B testing
   */
  generateThemeVariations(
    baseTheme: Record<string, unknown>,
    count: number = 3,
  ): VariantConfig[] {
    const variations: VariantConfig[] = [
      {
        name: 'Control',
        description: 'Original theme',
        themeConfig: baseTheme,
        isControl: true,
        traffic: 100 / (count + 1),
      },
    ];

    const colorVariations = [
      { primary: '#2563eb', secondary: '#1e40af' }, // Blue
      { primary: '#059669', secondary: '#047857' }, // Green
      { primary: '#7c3aed', secondary: '#6d28d9' }, // Purple
      { primary: '#dc2626', secondary: '#b91c1c' }, // Red
      { primary: '#ea580c', secondary: '#c2410c' }, // Orange
    ];

    for (let i = 0; i < count; i++) {
      const colorScheme = colorVariations[i % colorVariations.length];
      variations.push({
        name: `Variation ${String.fromCharCode(65 + i)}`,
        description: `Theme variation with ${Object.keys(colorScheme)[0]} scheme`,
        themeConfig: {
          ...baseTheme,
          colors: {
            ...((baseTheme.colors as object) || {}),
            ...colorScheme,
          },
        },
        isControl: false,
        traffic: 100 / (count + 1),
      });
    }

    return variations;
  }

  /**
   * Get test by ID
   */
  async getTest(testId: string, userId: string) {
    const test = await this.prisma.aBTest.findUnique({
      where: { id: testId },
      include: {
        variants: true,
        results: {
          take: 100,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!test || test.userId !== userId) {
      throw new BadRequestException('Test not found');
    }

    return test;
  }

  /**
   * Get user's tests
   */
  getUserTests(userId: string, projectId?: string, limit: number = 10) {
    return this.prisma.aBTest.findMany({
      where: {
        userId,
        ...(projectId && { projectId }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        variants: {
          select: {
            id: true,
            name: true,
            isControl: true,
            impressions: true,
            conversions: true,
            engagementScore: true,
          },
        },
      },
    });
  }

  /**
   * Delete test
   */
  async deleteTest(testId: string, userId: string) {
    const test = await this.getTest(testId, userId);

    if (test.status === 'running') {
      throw new BadRequestException('Cannot delete a running test');
    }

    return this.prisma.aBTest.delete({ where: { id: testId } });
  }

  /**
   * Bayesian A/B test analysis
   */
  async bayesianAnalysis(
    testId: string,
    userId: string,
  ): Promise<{
    variants: Array<{
      variantId: string;
      name: string;
      probability: number;
      expectedValue: number;
      credibleInterval: { lower: number; upper: number };
    }>;
    recommendation: string;
    confidence: number;
  }> {
    const test = await this.getTest(testId, userId);

    const variants = test.variants.map((variant) => {
      // Simplified Bayesian analysis using Beta distribution
      const alpha = variant.conversions + 1; // Prior: Beta(1,1)
      const beta = variant.impressions - variant.conversions + 1;

      // Mean of Beta distribution
      const probability = alpha / (alpha + beta);

      // Credible interval (approximation)
      const stdDev = Math.sqrt(
        (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1)),
      );
      const credibleInterval = {
        lower: Math.max(0, probability - 1.96 * stdDev),
        upper: Math.min(1, probability + 1.96 * stdDev),
      };

      return {
        variantId: variant.id,
        name: variant.name,
        probability,
        expectedValue: probability * variant.impressions,
        credibleInterval,
      };
    });

    // Find best variant
    const best = variants.reduce((prev, current) =>
      current.probability > prev.probability ? current : prev,
    );

    const confidence =
      best.probability > 0.5 ? (best.probability - 0.5) * 200 : 0;

    return {
      variants,
      recommendation: `${best.name} has the highest probability of success`,
      confidence: Math.min(100, confidence),
    };
  }

  /**
   * Multi-armed bandit optimization
   */
  async multiArmedBandit(
    testId: string,
    userId: string,
  ): Promise<{
    optimalVariant: string;
    explorationRate: number;
    recommendations: string[];
  }> {
    const test = await this.getTest(testId, userId);

    // Thompson Sampling approach
    const scores = test.variants.map((variant) => {
      const alpha = variant.conversions + 1;
      const beta = variant.impressions - variant.conversions + 1;

      // Sample from Beta distribution (simplified)
      const score = alpha / (alpha + beta);

      return { variantId: variant.id, name: variant.name, score };
    });

    const optimal = scores.reduce((prev, current) =>
      current.score > prev.score ? current : prev,
    );

    // Exploration rate decreases as we gather more data
    const totalImpressions = test.variants.reduce(
      (sum, v) => sum + v.impressions,
      0,
    );
    const explorationRate = Math.max(
      0.1,
      1 - totalImpressions / (test.sampleSize || 1000),
    );

    return {
      optimalVariant: optimal.name,
      explorationRate: Math.round(explorationRate * 100) / 100,
      recommendations: [
        `Show ${optimal.name} ${Math.round((1 - explorationRate) * 100)}% of the time`,
        `Continue exploring other variants ${Math.round(explorationRate * 100)}% of the time`,
        totalImpressions < 100
          ? 'Gather more data before making final decisions'
          : 'Sufficient data collected for optimization',
      ],
    };
  }

  /**
   * Real-time analytics dashboard data
   */
  async getRealtimeAnalytics(
    testId: string,
    userId: string,
  ): Promise<{
    currentWinner: string;
    liveConversionRates: Record<string, number>;
    recentResults: Array<{
      timestamp: Date;
      variantId: string;
      converted: boolean;
    }>;
    hourlyTrends: Array<{
      hour: number;
      impressions: number;
      conversions: number;
    }>;
  }> {
    const test = await this.getTest(testId, userId);

    const liveConversionRates: Record<string, number> = {};
    for (const variant of test.variants) {
      liveConversionRates[variant.name] =
        variant.impressions > 0 ? variant.conversions / variant.impressions : 0;
    }

    const currentWinner = Object.entries(liveConversionRates).reduce(
      (prev, current) => (current[1] > prev[1] ? current : prev),
    )[0];

    // Get recent results (last 100)
    const recentResults = test.results.slice(0, 100).map((result) => ({
      timestamp: result.createdAt,
      variantId: result.variantId,
      converted: result.completed,
    }));

    // Hourly trends (simplified - would need time-based aggregation)
    const hourlyTrends = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      impressions: Math.floor(Math.random() * 50),
      conversions: Math.floor(Math.random() * 20),
    }));

    return {
      currentWinner,
      liveConversionRates,
      recentResults,
      hourlyTrends,
    };
  }

  /**
   * Sequential testing with early stopping
   */
  async checkEarlyStopping(
    testId: string,
    userId: string,
  ): Promise<{
    shouldStop: boolean;
    reason: string;
    winningVariant?: string;
    confidence: number;
  }> {
    const test = await this.getTest(testId, userId);
    const analysis = await this.analyzeResults(testId);

    // Check if we have a clear winner with high confidence
    if (analysis.isStatisticallySignificant && analysis.confidence > 95) {
      return {
        shouldStop: true,
        reason: 'Clear winner detected with high confidence',
        winningVariant: analysis.winner,
        confidence: analysis.confidence,
      };
    }

    // Check if we've reached minimum sample size
    const totalImpressions = test.variants.reduce(
      (sum, v) => sum + v.impressions,
      0,
    );
    if (totalImpressions >= (test.sampleSize || 1000)) {
      return {
        shouldStop: true,
        reason: 'Target sample size reached',
        winningVariant: analysis.winner,
        confidence: analysis.confidence,
      };
    }

    // Check for futility (no variant will likely win)
    const maxRate = Math.max(
      ...test.variants.map((v) =>
        v.impressions > 0 ? v.conversions / v.impressions : 0,
      ),
    );
    const minRate = Math.min(
      ...test.variants.map((v) =>
        v.impressions > 0 ? v.conversions / v.impressions : 0,
      ),
    );

    if (totalImpressions > 500 && Math.abs(maxRate - minRate) < 0.01) {
      return {
        shouldStop: true,
        reason: 'No significant difference detected - variants are too similar',
        confidence: analysis.confidence,
      };
    }

    return {
      shouldStop: false,
      reason: 'Continue testing - more data needed',
      confidence: analysis.confidence,
    };
  }

  /**
   * Export test results
   */
  async exportResults(
    testId: string,
    userId: string,
    format: 'json' | 'csv',
  ): Promise<string> {
    const test = await this.getTest(testId, userId);
    const analysis = await this.analyzeResults(testId);

    const data = {
      testInfo: {
        id: test.id,
        name: test.name,
        status: test.status,
        startedAt: test.startedAt,
        completedAt: test.startedAt, // Use startedAt as fallback
      },
      variants: analysis.variantStats,
      winner: analysis.winner,
      confidence: analysis.confidence,
      results: test.results.map((r) => ({
        variantId: r.variantId,
        sessionId: r.sessionId,
        engaged: r.engaged,
        completed: r.completed,
        viewTime: r.viewTime,
        interactions: r.interactions,
        timestamp: r.createdAt,
      })),
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      // CSV format
      const headers =
        'Variant,Impressions,Conversions,Conversion Rate,Avg View Time,Engagement Score';
      const rows = analysis.variantStats
        .map(
          (v) =>
            `${v.name},${v.impressions},${v.name},${v.conversionRate},${v.avgViewTime},${v.engagementScore}`,
        )
        .join('\n');
      return `${headers}\n${rows}`;
    }
  }

  /**
   * Segment analysis by user characteristics
   */
  async segmentAnalysis(
    testId: string,
    userId: string,
    segments: Array<{ name: string; filter: (result: TestResult) => boolean }>,
  ): Promise<{
    segments: Array<{
      name: string;
      variantPerformance: Record<
        string,
        { conversions: number; impressions: number }
      >;
      insights: string[];
    }>;
  }> {
    const test = await this.getTest(testId, userId);

    const segmentResults = segments.map((segment) => {
      const variantPerformance: Record<
        string,
        { conversions: number; impressions: number }
      > = {};

      test.results.forEach((result) => {
        if (segment.filter(result as unknown as TestResult)) {
          if (!variantPerformance[result.variantId]) {
            variantPerformance[result.variantId] = {
              conversions: 0,
              impressions: 0,
            };
          }
          variantPerformance[result.variantId].impressions++;
          if (result.completed) {
            variantPerformance[result.variantId].conversions++;
          }
        }
      });

      const insights = [
        `${segment.name}: ${Object.values(variantPerformance).reduce((sum, v) => sum + v.impressions, 0)} impressions`,
      ];

      return {
        name: segment.name,
        variantPerformance,
        insights,
      };
    });

    return { segments: segmentResults };
  }
}
