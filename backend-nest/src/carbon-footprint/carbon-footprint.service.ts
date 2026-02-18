import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface CarbonFactors {
  dataTransferKgPerGB: number;
  computeKgPerHour: number;
  storageKgPerGBMonth: number;
  videoStreamingKgPerHour: number;
}

export interface EmissionBreakdown {
  dataTransfer: number;
  compute: number;
  storage: number;
  streaming: number;
  total: number;
}

@Injectable()
export class CarbonFootprintService {
  private readonly logger = new Logger(CarbonFootprintService.name);

  // Carbon emission factors (kg CO2e)
  private readonly carbonFactors: CarbonFactors = {
    dataTransferKgPerGB: 0.02, // ~20g CO2 per GB
    computeKgPerHour: 0.05, // ~50g CO2 per compute hour
    storageKgPerGBMonth: 0.001, // ~1g CO2 per GB/month
    videoStreamingKgPerHour: 0.036, // ~36g CO2 per hour of HD video
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Calculate carbon footprint for a presentation
   */
  async calculatePresentationFootprint(presentationId: string): Promise<{
    presentationId: string;
    emissions: EmissionBreakdown;
    comparisons: { item: string; equivalent: string }[];
    recommendations: string[];
  }> {
    const presentation = await this.prisma.project.findUnique({
      where: { id: presentationId },
      include: { slides: true },
    });

    if (!presentation) {
      throw new NotFoundException('Presentation not found');
    }

    // Estimate data size
    const dataSizeGB =
      JSON.stringify(presentation).length / (1024 * 1024 * 1024);

    // Calculate emissions
    const emissions: EmissionBreakdown = {
      dataTransfer: dataSizeGB * this.carbonFactors.dataTransferKgPerGB,
      compute: 0.1 * this.carbonFactors.computeKgPerHour, // Estimated compute time
      storage: dataSizeGB * this.carbonFactors.storageKgPerGBMonth,
      streaming: 0,
      total: 0,
    };

    emissions.total =
      emissions.dataTransfer + emissions.compute + emissions.storage;

    return {
      presentationId,
      emissions,
      comparisons: this.getComparisons(emissions.total),
      recommendations: this.getRecommendations(emissions),
    };
  }

  /**
   * Calculate session carbon footprint
   */
  calculateSessionFootprint(sessionData: {
    durationMinutes: number;
    attendees: number;
    streamQuality: 'low' | 'medium' | 'high';
    dataSentMB: number;
    dataReceivedMB: number;
  }): {
    emissions: EmissionBreakdown;
    perAttendee: number;
    comparisons: { item: string; equivalent: string }[];
    offsetCost: number;
  } {
    const qualityMultiplier = {
      low: 0.5,
      medium: 1,
      high: 2,
    };

    const streamingHours = sessionData.durationMinutes / 60;
    const totalDataGB =
      (sessionData.dataSentMB + sessionData.dataReceivedMB) / 1024;

    const emissions: EmissionBreakdown = {
      dataTransfer: totalDataGB * this.carbonFactors.dataTransferKgPerGB,
      compute:
        streamingHours *
        this.carbonFactors.computeKgPerHour *
        sessionData.attendees *
        0.1,
      storage: 0,
      streaming:
        streamingHours *
        this.carbonFactors.videoStreamingKgPerHour *
        qualityMultiplier[sessionData.streamQuality] *
        sessionData.attendees,
      total: 0,
    };

    emissions.total =
      emissions.dataTransfer + emissions.compute + emissions.streaming;

    const perAttendee = emissions.total / sessionData.attendees;

    return {
      emissions,
      perAttendee: Math.round(perAttendee * 1000) / 1000,
      comparisons: this.getComparisons(emissions.total),
      offsetCost: this.calculateOffsetCost(emissions.total),
    };
  }

  /**
   * Generate eco report
   */
  async generateEcoReport(userId: string, period: 'week' | 'month' | 'year') {
    const startDate = this.getStartDate(period);

    const presentations = await this.prisma.project.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      include: { slides: true },
    });

    // Calculate total footprint
    let totalEmissions = 0;
    const breakdown: {
      presentationId: string;
      title: string;
      emissions: number;
    }[] = [];

    for (const pres of presentations) {
      const footprint = await this.calculatePresentationFootprint(pres.id);
      totalEmissions += footprint.emissions.total;
      breakdown.push({
        presentationId: pres.id,
        title: pres.title,
        emissions: footprint.emissions.total,
      });
    }

    // Store report
    const report = await this.prisma.ecoReport.create({
      data: {
        userId,
        period,
        totalEmissions,
        breakdown: breakdown as object[],
        recommendations: this.getRecommendations({
          total: totalEmissions,
        } as EmissionBreakdown),
        generatedAt: new Date(),
      },
    });

    return {
      ...report,
      comparisons: this.getComparisons(totalEmissions),
      trendVsPrevious: await this.calculateTrend(
        userId,
        period,
        totalEmissions,
      ),
    };
  }

  /**
   * Calculate trend vs previous period
   */
  private async calculateTrend(
    userId: string,
    period: 'week' | 'month' | 'year',
    currentEmissions: number,
  ): Promise<{ change: number; direction: 'up' | 'down' | 'stable' }> {
    const previousReport = await this.prisma.ecoReport.findFirst({
      where: { userId, period },
      orderBy: { generatedAt: 'desc' },
      skip: 1,
    });

    if (!previousReport) {
      return { change: 0, direction: 'stable' };
    }

    const change =
      ((currentEmissions - previousReport.totalEmissions) /
        previousReport.totalEmissions) *
      100;

    return {
      change: Math.round(change),
      direction: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
    };
  }

  /**
   * Get carbon offset options
   */
  getOffsetOptions(emissionsKg: number): {
    provider: string;
    project: string;
    description: string;
    costUSD: number;
    certification: string;
  }[] {
    // Typical offset cost is $10-50 per tonne (1000kg) CO2
    const costPerKg = 0.02; // $20 per tonne

    return [
      {
        provider: 'Gold Standard',
        project: 'Renewable Energy - India',
        description: 'Solar power project providing clean electricity',
        costUSD: Math.round(emissionsKg * costPerKg * 100) / 100,
        certification: 'Gold Standard VER',
      },
      {
        provider: 'Verra',
        project: 'Forest Conservation - Brazil',
        description: 'Protecting Amazon rainforest from deforestation',
        costUSD: Math.round(emissionsKg * costPerKg * 1.5 * 100) / 100,
        certification: 'Verified Carbon Standard (VCS)',
      },
      {
        provider: 'Climate Action Reserve',
        project: 'Methane Capture - USA',
        description: 'Capturing methane from landfills',
        costUSD: Math.round(emissionsKg * costPerKg * 1.2 * 100) / 100,
        certification: 'Climate Action Reserve',
      },
      {
        provider: 'Plan Vivo',
        project: 'Community Reforestation - Kenya',
        description: 'Tree planting with local communities',
        costUSD: Math.round(emissionsKg * costPerKg * 1.3 * 100) / 100,
        certification: 'Plan Vivo Certificate',
      },
    ];
  }

  /**
   * Purchase carbon offset
   */
  async purchaseOffset(
    userId: string,
    offsetData: {
      provider: string;
      project: string;
      emissionsKg: number;
      costUSD: number;
    },
  ) {
    // In production, this would integrate with offset provider APIs
    const offset = await this.prisma.carbonOffset.create({
      data: {
        userId,
        provider: offsetData.provider,
        project: offsetData.project,
        amount: offsetData.emissionsKg,
        cost: offsetData.costUSD,
        status: 'pending',
        certificateUrl: null,
      },
    });

    // Simulate certificate generation
    setTimeout(() => {
      this.prisma.carbonOffset
        .update({
          where: { id: offset.id },
          data: {
            status: 'completed',
            certificateUrl: `/certificates/${offset.id}.pdf`,
          },
        })
        .catch((err) => this.logger.error('Failed to update carbon offset status', err));
    }, 5000);

    return {
      offsetId: offset.id,
      status: 'processing',
      message:
        'Your carbon offset purchase is being processed. Certificate will be available shortly.',
    };
  }

  /**
   * Get user's offset history
   */
  async getOffsetHistory(userId: string) {
    const offsets = await this.prisma.carbonOffset.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const totalOffset = offsets
      .filter((o) => o.status === 'completed')
      .reduce((sum, o) => sum + o.amount, 0);

    return {
      offsets,
      totalOffsetKg: totalOffset,
      totalSpentUSD: offsets.reduce((sum, o) => sum + o.cost, 0),
    };
  }

  /**
   * Get eco badges
   */
  async getEcoBadges(userId: string): Promise<{
    earned: { badge: string; earnedAt: Date; description: string }[];
    available: { badge: string; description: string; requirement: string }[];
  }> {
    const offsets = await this.prisma.carbonOffset.findMany({
      where: { userId, status: 'completed' },
    });

    const totalOffset = offsets.reduce((sum, o) => sum + o.amount, 0);
    const earned: { badge: string; earnedAt: Date; description: string }[] = [];

    if (offsets.length >= 1) {
      earned.push({
        badge: 'First Step',
        earnedAt: offsets[0].createdAt,
        description: 'Made your first carbon offset purchase',
      });
    }

    if (totalOffset >= 10) {
      earned.push({
        badge: 'Climate Champion',
        earnedAt: offsets[offsets.length - 1].createdAt,
        description: 'Offset over 10kg of CO2',
      });
    }

    if (totalOffset >= 100) {
      earned.push({
        badge: 'Carbon Neutral',
        earnedAt: offsets[offsets.length - 1].createdAt,
        description: 'Offset over 100kg of CO2',
      });
    }

    const available = [
      {
        badge: 'First Step',
        description: 'Make your first carbon offset purchase',
        requirement: 'Purchase 1 offset',
      },
      {
        badge: 'Climate Champion',
        description: 'Offset over 10kg of CO2',
        requirement: 'Total offsets >= 10kg',
      },
      {
        badge: 'Carbon Neutral',
        description: 'Offset over 100kg of CO2',
        requirement: 'Total offsets >= 100kg',
      },
      {
        badge: 'Green Presenter',
        description: 'Use eco-friendly mode for 10 presentations',
        requirement: '10 presentations in eco mode',
      },
    ].filter((b) => !earned.find((e) => e.badge === b.badge));

    return { earned, available };
  }

  /**
   * Get comparisons for emissions
   */
  private getComparisons(
    emissionsKg: number,
  ): { item: string; equivalent: string }[] {
    return [
      {
        item: 'Car travel',
        equivalent: `${Math.round((emissionsKg / 0.21) * 10) / 10} km driven`,
      },
      {
        item: 'Smartphone charges',
        equivalent: `${Math.round(emissionsKg / 0.008)} full charges`,
      },
      {
        item: 'LED bulb hours',
        equivalent: `${Math.round(emissionsKg / 0.01)} hours`,
      },
      {
        item: 'Tree absorption',
        equivalent: `${Math.round((emissionsKg / 21) * 100) / 100} tree-years to absorb`,
      },
    ];
  }

  /**
   * Get recommendations
   */
  private getRecommendations(emissions: EmissionBreakdown): string[] {
    const recommendations: string[] = [];

    if (emissions.dataTransfer > 0.01) {
      recommendations.push('Compress images and media to reduce data transfer');
    }

    if (emissions.streaming > 0.05) {
      recommendations.push(
        'Consider lower video quality for remote presentations',
      );
    }

    recommendations.push(
      'Enable eco-friendly mode for automatic optimizations',
    );
    recommendations.push('Use dark mode on OLED screens to save energy');
    recommendations.push(
      'Download presentations for offline viewing when possible',
    );

    return recommendations;
  }

  /**
   * Calculate offset cost
   */
  private calculateOffsetCost(emissionsKg: number): number {
    return Math.round(emissionsKg * 0.02 * 100) / 100; // $20 per tonne
  }

  /**
   * Get start date for period
   */
  private getStartDate(period: 'week' | 'month' | 'year'): Date {
    const now = new Date();
    switch (period) {
      case 'week':
        return new Date(now.setDate(now.getDate() - 7));
      case 'month':
        return new Date(now.setMonth(now.getMonth() - 1));
      case 'year':
        return new Date(now.setFullYear(now.getFullYear() - 1));
    }
  }
}
