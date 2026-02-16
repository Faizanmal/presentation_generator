import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface VariantConfig {
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

interface StatisticalAnalysis {
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
    const { name, description, goalMetric = 'engagement', variants, sampleSize = 100, confidenceLevel = 0.95 } = data;

    if (variants.length < 2) {
      throw new BadRequestException('A/B test requires at least 2 variants');
    }

    // Validate traffic allocation
    const totalTraffic = variants.reduce((sum, v) => sum + (v.traffic || 50), 0);
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
      throw new BadRequestException('Test can only be started from draft status');
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

    for (const variant of test.variants) {
      cumulative += variant.traffic;
      if (random <= cumulative) {
        // Record impression
        await this.prisma.aBTestVariant.update({
          where: { id: variant.id },
          data: { impressions: { increment: 1 } },
        });

        // Update test sample count
        await this.prisma.aBTest.update({
          where: { id: testId },
          data: { currentSample: { increment: 1 } },
        });

        return variant;
      }
    }

    // Fallback to first variant
    return test.variants[0];
  }

  /**
   * Record test result
   */
  async recordResult(testId: string, result: TestResult) {
    const test = await this.prisma.aBTest.findUnique({
      where: { id: testId },
      include: { variants: true },
    });

    if (!test || test.status !== 'running') {
      throw new BadRequestException('Test not found or not running');
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
    const totalViewTime = results.reduce((sum, r) => sum + (r.viewTime || 0), 0);
    const engagedCount = results.filter((r) => r.engaged).length;

    await this.prisma.aBTestVariant.update({
      where: { id: result.variantId },
      data: {
        conversions,
        avgViewTime: results.length > 0 ? totalViewTime / results.length : 0,
        engagementScore: results.length > 0 ? (engagedCount / results.length) * 100 : 0,
        bounceRate: results.length > 0 
          ? (results.filter((r) => !r.engaged && (r.viewTime || 0) < 10).length / results.length) * 100 
          : 0,
      },
    });

    // Check if test should auto-complete
    const currentSample = await this.prisma.aBTestResult.count({ where: { testId } });
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
      const totalViewTime = results.reduce((sum, r) => sum + (r.viewTime || 0), 0);

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
    let improvement = 0;
    switch (test.goalMetric) {
      case 'completion':
        improvement = control.conversionRate > 0 
          ? ((best.conversionRate - control.conversionRate) / control.conversionRate) * 100 
          : 0;
        break;
      case 'view_time':
        improvement = control.avgViewTime > 0 
          ? ((best.avgViewTime - control.avgViewTime) / control.avgViewTime) * 100 
          : 0;
        break;
      case 'engagement':
      default:
        improvement = control.engagementScore > 0 
          ? ((best.engagementScore - control.engagementScore) / control.engagementScore) * 100 
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
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Generate theme variations for A/B testing
   */
  async generateThemeVariations(
    baseTheme: Record<string, unknown>,
    count: number = 3,
  ): Promise<VariantConfig[]> {
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
            ...(baseTheme.colors as object || {}),
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
  async getUserTests(userId: string, projectId?: string, limit: number = 10) {
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
}
