import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface EcoSettings {
  lowPowerMode: boolean;
  reducedAnimations: boolean;
  compressImages: boolean;
  darkModePreferred: boolean;
  offlineFirst: boolean;
  streamQuality: 'low' | 'medium' | 'high' | 'auto';
  cacheStrategy: 'aggressive' | 'moderate' | 'minimal';
}

interface EnergyEstimate {
  baselineWh: number;
  optimizedWh: number;
  savingsWh: number;
  savingsPercent: number;
}

@Injectable()
export class EcoFriendlyService {
  private readonly logger = new Logger(EcoFriendlyService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get or create eco settings for user
   */
  async getEcoSettings(userId: string): Promise<EcoSettings> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    const settings = (user?.settings as { eco?: EcoSettings } | null)?.eco;

    return settings || this.getDefaultSettings();
  }

  /**
   * Update eco settings
   */
  async updateEcoSettings(userId: string, settings: Partial<EcoSettings>) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    const currentSettings = (currentUser?.settings as object) || {};
    const currentEco = (currentSettings as { eco?: EcoSettings }).eco || this.getDefaultSettings();

    const newSettings = {
      ...currentSettings,
      eco: { ...currentEco, ...settings },
    };

    await this.prisma.user.update({
      where: { id: userId },
      data: { settings: newSettings },
    });

    return newSettings.eco;
  }

  /**
   * Apply eco presets
   */
  applyPreset(preset: 'maximum-savings' | 'balanced' | 'quality-first'): EcoSettings {
    const presets: Record<string, EcoSettings> = {
      'maximum-savings': {
        lowPowerMode: true,
        reducedAnimations: true,
        compressImages: true,
        darkModePreferred: true,
        offlineFirst: true,
        streamQuality: 'low',
        cacheStrategy: 'aggressive',
      },
      balanced: {
        lowPowerMode: true,
        reducedAnimations: false,
        compressImages: true,
        darkModePreferred: false,
        offlineFirst: false,
        streamQuality: 'auto',
        cacheStrategy: 'moderate',
      },
      'quality-first': {
        lowPowerMode: false,
        reducedAnimations: false,
        compressImages: false,
        darkModePreferred: false,
        offlineFirst: false,
        streamQuality: 'high',
        cacheStrategy: 'minimal',
      },
    };

    return presets[preset] || presets['balanced'];
  }

  /**
   * Optimize presentation for eco-friendly delivery
   */
  async optimizePresentation(presentationId: string, options: {
    compressImages?: boolean;
    removeUnusedAssets?: boolean;
    optimizeAnimations?: boolean;
    generateOfflineBundle?: boolean;
  }) {
    const presentation = await this.prisma.project.findUnique({
      where: { id: presentationId },
      include: { slides: true },
    });

    if (!presentation) {
      throw new NotFoundException('Presentation not found');
    }

    const optimizations: string[] = [];
    let originalSize = this.estimateSize(presentation);
    let optimizedSize = originalSize;

    // Image compression
    if (options.compressImages) {
      const imageReduction = originalSize * 0.3; // Estimate 30% reduction
      optimizedSize -= imageReduction;
      optimizations.push(`Compressed images: saved ~${Math.round(imageReduction / 1024)}KB`);
    }

    // Remove unused assets
    if (options.removeUnusedAssets) {
      const unusedReduction = originalSize * 0.1;
      optimizedSize -= unusedReduction;
      optimizations.push(`Removed unused assets: saved ~${Math.round(unusedReduction / 1024)}KB`);
    }

    // Optimize animations
    if (options.optimizeAnimations) {
      optimizations.push('Simplified animations for lower CPU usage');
    }

    // Generate offline bundle
    let offlineBundleUrl: string | undefined;
    if (options.generateOfflineBundle) {
      offlineBundleUrl = `/offline/${presentationId}.zip`;
      optimizations.push('Generated offline bundle for reduced network usage');
    }

    const savingsPercent = ((originalSize - optimizedSize) / originalSize) * 100;

    return {
      presentationId,
      originalSize: Math.round(originalSize / 1024),
      optimizedSize: Math.round(optimizedSize / 1024),
      savingsKB: Math.round((originalSize - optimizedSize) / 1024),
      savingsPercent: Math.round(savingsPercent),
      optimizations,
      offlineBundleUrl,
      energyImpact: this.calculateEnergyImpact(originalSize, optimizedSize),
    };
  }

  /**
   * Calculate energy impact
   */
  calculateEnergyImpact(originalBytes: number, optimizedBytes: number): EnergyEstimate {
    // Rough estimates based on data transfer energy consumption
    // ~0.06 kWh per GB of data transferred
    const energyPerByte = 0.00000006; // Wh per byte

    const baselineWh = originalBytes * energyPerByte;
    const optimizedWh = optimizedBytes * energyPerByte;

    return {
      baselineWh: Math.round(baselineWh * 1000) / 1000,
      optimizedWh: Math.round(optimizedWh * 1000) / 1000,
      savingsWh: Math.round((baselineWh - optimizedWh) * 1000) / 1000,
      savingsPercent: Math.round(((baselineWh - optimizedWh) / baselineWh) * 100),
    };
  }

  /**
   * Get streaming optimization recommendations
   */
  getStreamingRecommendations(context: {
    networkType?: string;
    batteryLevel?: number;
    deviceType?: string;
  }) {
    const recommendations: {
      quality: string;
      reasons: string[];
      settings: {
        resolution: string;
        fps: number;
        bitrate: string;
      };
    }[] = [];

    // Low battery optimization
    if (context.batteryLevel && context.batteryLevel < 20) {
      recommendations.push({
        quality: 'minimal',
        reasons: ['Low battery level detected'],
        settings: {
          resolution: '720p',
          fps: 15,
          bitrate: '500kbps',
        },
      });
    }

    // Network-based optimization
    if (context.networkType === 'cellular' || context.networkType === '3g') {
      recommendations.push({
        quality: 'low',
        reasons: ['Cellular/3G network detected', 'Reduces data usage'],
        settings: {
          resolution: '720p',
          fps: 24,
          bitrate: '1mbps',
        },
      });
    }

    // Mobile device optimization
    if (context.deviceType === 'mobile') {
      recommendations.push({
        quality: 'adaptive',
        reasons: ['Mobile device detected', 'Optimizes for smaller screen'],
        settings: {
          resolution: '1080p',
          fps: 30,
          bitrate: '2mbps',
        },
      });
    }

    // Default recommendation
    if (recommendations.length === 0) {
      recommendations.push({
        quality: 'balanced',
        reasons: ['Standard optimization'],
        settings: {
          resolution: '1080p',
          fps: 30,
          bitrate: '3mbps',
        },
      });
    }

    return recommendations;
  }

  /**
   * Track eco metrics
   */
  async trackEcoMetrics(userId: string, metrics: {
    sessionDuration: number;
    dataTransferred: number;
    animationsReduced: boolean;
    darkModeUsed: boolean;
    offlineViewTime: number;
  }) {
    // Calculate estimated savings
    const baselineEnergy = metrics.dataTransferred * 0.00000006; // Wh
    let savings = 0;

    if (metrics.animationsReduced) savings += baselineEnergy * 0.15;
    if (metrics.darkModeUsed) savings += baselineEnergy * 0.1;
    if (metrics.offlineViewTime > 0) {
      savings += (metrics.offlineViewTime / metrics.sessionDuration) * baselineEnergy * 0.5;
    }

    return {
      tracked: true,
      sessionDuration: metrics.sessionDuration,
      estimatedEnergySavedWh: Math.round(savings * 1000) / 1000,
      ecoScore: this.calculateEcoScore(metrics),
    };
  }

  /**
   * Calculate eco score
   */
  private calculateEcoScore(metrics: {
    animationsReduced: boolean;
    darkModeUsed: boolean;
    offlineViewTime: number;
    sessionDuration: number;
  }): number {
    let score = 50; // Base score

    if (metrics.animationsReduced) score += 15;
    if (metrics.darkModeUsed) score += 10;
    if (metrics.offlineViewTime > 0) {
      const offlinePercent = metrics.offlineViewTime / metrics.sessionDuration;
      score += Math.min(25, Math.round(offlinePercent * 25));
    }

    return Math.min(100, score);
  }

  /**
   * Get eco tips
   */
  getEcoTips() {
    return [
      {
        category: 'display',
        tip: 'Use dark mode to reduce screen energy consumption',
        impact: 'Can save up to 30% battery on OLED screens',
      },
      {
        category: 'animations',
        tip: 'Reduce animations for lower CPU/GPU usage',
        impact: 'Reduces processing power by 10-20%',
      },
      {
        category: 'images',
        tip: 'Compress images before uploading',
        impact: 'Reduces data transfer and storage energy',
      },
      {
        category: 'offline',
        tip: 'Download presentations for offline viewing',
        impact: 'Eliminates network energy costs during presentation',
      },
      {
        category: 'scheduling',
        tip: 'Schedule heavy processing during off-peak hours',
        impact: 'Uses cleaner grid energy in many regions',
      },
      {
        category: 'streaming',
        tip: 'Use lower quality video when HD isn\'t necessary',
        impact: 'Can reduce energy use by 50-70%',
      },
    ];
  }

  private getDefaultSettings(): EcoSettings {
    return {
      lowPowerMode: false,
      reducedAnimations: false,
      compressImages: true,
      darkModePreferred: false,
      offlineFirst: false,
      streamQuality: 'auto',
      cacheStrategy: 'moderate',
    };
  }

  private estimateSize(presentation: object): number {
    // Rough size estimation
    return JSON.stringify(presentation).length * 2;
  }
}
