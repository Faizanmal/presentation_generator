import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface WellnessMetrics {
  speakingPaceWPM: number;
  pauseFrequency: number;
  avgPauseDuration: number;
  volumeVariation: number;
  fillerWordCount: number;
  stressIndicators: number;
}

export interface BreakReminder {
  type: 'hydration' | 'stretch' | 'eye-rest' | 'breathing' | 'posture';
  message: string;
  intervalMinutes: number;
}

@Injectable()
export class PresenterWellnessService {
  private readonly logger = new Logger(PresenterWellnessService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Start wellness session
   */
  async startSession(userId: string, presentationId: string) {
    return this.prisma.wellnessSession.create({
      data: {
        userId,
        projectId: presentationId,
        startedAt: new Date(),
        summary: {},
      },
    });
  }

  /**
   * Update session metrics
   */
  async updateMetrics(sessionId: string, metrics: Partial<WellnessMetrics>) {
    const session = await this.prisma.wellnessSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Wellness session not found');
    }

    // Create individual metric records
    const metricCreates = Object.entries(metrics).map(([key, value]) => ({
      sessionId,
      metricType: key,
      value: value as number,
      raw: { originalKey: key, value },
    }));

    await this.prisma.wellnessMetric.createMany({
      data: metricCreates,
    });

    // Update session summary with latest metrics
    const latestMetrics = await this.prisma.wellnessMetric.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    const summary = this.calculateSummary(latestMetrics);

    return this.prisma.wellnessSession.update({
      where: { id: sessionId },
      data: { summary },
    });
  }

  /**
   * Calculate session summary from metrics
   */
  private calculateSummary(metrics: any[]): object {
    if (metrics.length === 0) {
      return {};
    }

    // Group metrics by type and get latest values
    const latestByType = {};
    metrics.forEach(metric => {
      if (!latestByType[metric.metricType] || metric.timestamp > latestByType[metric.metricType].timestamp) {
        latestByType[metric.metricType] = metric;
      }
    });

    // Calculate averages
    const averages = {};
    const grouped = metrics.reduce((acc, metric) => {
      if (!acc[metric.metricType]) acc[metric.metricType] = [];
      acc[metric.metricType].push(metric.value);
      return acc;
    }, {});

    Object.keys(grouped).forEach(type => {
      averages[type] = grouped[type].reduce((sum, val) => sum + val, 0) / grouped[type].length;
    });

    // Calculate wellness score based on latest metrics
    let score = 100;
    const latestValues = Object.values(latestByType);

    latestValues.forEach((metric: any) => {
      switch (metric.metricType) {
        case 'speakingPaceWPM':
          if (metric.value < 100) score -= 10;
          else if (metric.value > 180) score -= 15;
          break;
        case 'fillerWordCount':
          score -= Math.min(20, metric.value * 2);
          break;
        case 'stressIndicators':
          score -= Math.min(15, metric.value * 3);
          break;
        case 'pauseFrequency':
          if (metric.value >= 3 && metric.value <= 8) score += 5;
          break;
      }
    });

    return {
      wellnessScore: Math.max(0, Math.min(100, score)),
      averages,
      latest: latestByType,
      totalMetrics: metrics.length,
    };
  }

  /**
   * End session and generate summary
   */
  async endSession(sessionId: string) {
    const session = await this.prisma.wellnessSession.findUnique({
      where: { id: sessionId },
      include: { metrics: true },
    });

    if (!session) {
      throw new NotFoundException('Wellness session not found');
    }

    const endTime = new Date();
    const duration = Math.round((endTime.getTime() - session.startedAt.getTime()) / 1000 / 60); // minutes

    const recommendations = this.generateRecommendations(session.metrics, duration);

    const summary = this.calculateSummary(session.metrics);

    const updated = await this.prisma.wellnessSession.update({
      where: { id: sessionId },
      data: {
        endedAt: endTime,
        status: 'completed',
        duration,
        recommendations: recommendations as any,
        summary,
      },
    });

    return {
      ...updated,
      durationMinutes: duration,
      recommendations,
    };
  }

  /**
   * Generate recommendations based on metrics
   */
  private generateRecommendations(
    metrics: any[],
    durationMinutes: number,
  ): {
    category: string;
    issue: string;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
  }[] {
    const recommendations: {
      category: string;
      issue: string;
      suggestion: string;
      priority: 'high' | 'medium' | 'low';
    }[] = [];

    // Get latest values for each metric type
    const latestValues = {};
    metrics.forEach(metric => {
      latestValues[metric.metricType] = metric.value;
    });

    const speakingPaceWPM = latestValues['speakingPaceWPM'] || 0;
    const fillerWordCount = latestValues['fillerWordCount'] || 0;
    const stressIndicators = latestValues['stressIndicators'] || 0;
    const pauseFrequency = latestValues['pauseFrequency'] || 0;

    // Speaking pace
    if (speakingPaceWPM > 170) {
      recommendations.push({
        category: 'pace',
        issue: 'Speaking too fast',
        suggestion:
          'Practice deliberate pauses and slow down to 130-150 WPM for better comprehension',
        priority: 'high',
      });
    } else if (speakingPaceWPM < 100) {
      recommendations.push({
        category: 'pace',
        issue: 'Speaking pace is slow',
        suggestion: 'Pick up the pace slightly to maintain audience engagement',
        priority: 'medium',
      });
    }

    // Filler words
    if (fillerWordCount > 10) {
      recommendations.push({
        category: 'clarity',
        issue: 'Excessive filler words detected',
        suggestion:
          'Practice pausing instead of using filler words like "um", "uh", "like"',
        priority: 'high',
      });
    }

    // Stress indicators
    if (stressIndicators > 3) {
      recommendations.push({
        category: 'stress',
        issue: 'High stress levels detected',
        suggestion:
          'Try deep breathing exercises before presenting. Consider reducing caffeine.',
        priority: 'high',
      });
    }

    // Duration
    if (durationMinutes > 45) {
      recommendations.push({
        category: 'endurance',
        issue: 'Long presentation duration',
        suggestion:
          'Consider breaking into smaller segments with Q&A or activity breaks',
        priority: 'medium',
      });
    }

    // Pauses
    if (pauseFrequency < 2) {
      recommendations.push({
        category: 'engagement',
        issue: 'Few pauses detected',
        suggestion:
          'Add strategic pauses for emphasis and to let key points sink in',
        priority: 'medium',
      });
    }

    return recommendations;
  }

  /**
   * Record break taken
   */
  async recordBreak(sessionId: string, breakType: string) {
    const session = await this.prisma.wellnessSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return this.prisma.wellnessSession.update({
      where: { id: sessionId },
      data: {
        breaksTaken: session.breaksTaken + 1,
      },
    });
  }

  /**
   * Get break reminders configuration
   */
  getBreakReminders(): BreakReminder[] {
    return [
      {
        type: 'hydration',
        message:
          'Time for a sip of water! Staying hydrated helps maintain vocal clarity.',
        intervalMinutes: 20,
      },
      {
        type: 'stretch',
        message:
          'Quick stretch break! Roll your shoulders and stretch your neck.',
        intervalMinutes: 30,
      },
      {
        type: 'eye-rest',
        message: 'Look away from the screen for 20 seconds to rest your eyes.',
        intervalMinutes: 20,
      },
      {
        type: 'breathing',
        message: 'Take 3 deep breaths to maintain calm and focus.',
        intervalMinutes: 15,
      },
      {
        type: 'posture',
        message: 'Check your posture! Stand tall with shoulders back.',
        intervalMinutes: 25,
      },
    ];
  }

  /**
   * Analyze speaking pace from audio data
   */
  analyzeSpeakingPace(audioMetrics: {
    wordCount: number;
    durationSeconds: number;
    pauses: { start: number; end: number }[];
  }): {
    wpm: number;
    rating: 'too-slow' | 'slow' | 'optimal' | 'fast' | 'too-fast';
    suggestion: string;
  } {
    const wpm = Math.round(
      (audioMetrics.wordCount / audioMetrics.durationSeconds) * 60,
    );

    let rating: 'too-slow' | 'slow' | 'optimal' | 'fast' | 'too-fast';
    let suggestion: string;

    if (wpm < 100) {
      rating = 'too-slow';
      suggestion =
        'Your pace is quite slow. Consider increasing to 120-150 WPM for better engagement.';
    } else if (wpm < 120) {
      rating = 'slow';
      suggestion = 'Slightly below optimal pace. You can speed up a bit.';
    } else if (wpm <= 150) {
      rating = 'optimal';
      suggestion =
        'Great pace! Maintain this for optimal audience comprehension.';
    } else if (wpm <= 180) {
      rating = 'fast';
      suggestion = 'A bit fast. Consider slowing down for better clarity.';
    } else {
      rating = 'too-fast';
      suggestion = 'Speaking too fast. Slow down significantly and add pauses.';
    }

    return { wpm, rating, suggestion };
  }

  /**
   * Detect stress indicators from voice analysis
   */
  detectStressIndicators(voiceMetrics: {
    pitchVariation: number;
    tempo: number;
    volumeSpikes: number;
    breathingPattern: 'normal' | 'shallow' | 'irregular';
  }): {
    stressLevel: 'low' | 'moderate' | 'high';
    indicators: string[];
    copingStrategies: string[];
  } {
    const indicators: string[] = [];
    let stressScore = 0;

    if (voiceMetrics.tempo > 170) {
      indicators.push('Rapid speaking pace');
      stressScore += 2;
    }

    if (voiceMetrics.volumeSpikes > 5) {
      indicators.push('Irregular volume patterns');
      stressScore += 1;
    }

    if (voiceMetrics.breathingPattern === 'shallow') {
      indicators.push('Shallow breathing detected');
      stressScore += 2;
    } else if (voiceMetrics.breathingPattern === 'irregular') {
      indicators.push('Irregular breathing pattern');
      stressScore += 1;
    }

    if (voiceMetrics.pitchVariation > 0.8) {
      indicators.push('High pitch variation');
      stressScore += 1;
    }

    let stressLevel: 'low' | 'moderate' | 'high';
    if (stressScore <= 2) stressLevel = 'low';
    else if (stressScore <= 4) stressLevel = 'moderate';
    else stressLevel = 'high';

    const copingStrategies = this.getCopingStrategies(stressLevel);

    return { stressLevel, indicators, copingStrategies };
  }

  /**
   * Get coping strategies based on stress level
   */
  private getCopingStrategies(
    stressLevel: 'low' | 'moderate' | 'high',
  ): string[] {
    const baseStrategies = [
      'Take a deep breath before starting each major section',
      'Maintain good posture to support breathing',
    ];

    if (stressLevel === 'low') {
      return baseStrategies;
    }

    const moderateStrategies = [
      ...baseStrategies,
      'Practice box breathing: 4 seconds in, hold 4, out 4, hold 4',
      'Focus on friendly faces in the audience',
      'Slow down deliberately when feeling rushed',
    ];

    if (stressLevel === 'moderate') {
      return moderateStrategies;
    }

    return [
      ...moderateStrategies,
      'Consider a brief pause to collect yourself',
      'Ground yourself by feeling your feet on the floor',
      'Remember: the audience wants you to succeed',
      'Take a sip of water to reset your pace',
    ];
  }

  /**
   * Get wellness history for user
   */
  async getWellnessHistory(userId: string, limit = 10) {
    return this.prisma.wellnessSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get wellness trends
   */
  async getWellnessTrends(userId: string) {
    const sessions = await this.prisma.wellnessSession.findMany({
      where: { userId, endedAt: { not: null } },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    if (sessions.length < 2) {
      return {
        trend: 'insufficient-data',
        message: 'Need more sessions for trend analysis',
      };
    }

    const recentAvg =
      sessions.slice(0, 5).reduce((sum, s) => sum + ((s.summary as any)?.wellnessScore || 50), 0) / 5;
    const olderAvg =
      sessions.slice(-5).reduce((sum, s) => sum + ((s.summary as any)?.wellnessScore || 50), 0) /
      Math.min(5, sessions.length);

    const trend =
      recentAvg > olderAvg + 5
        ? 'improving'
        : recentAvg < olderAvg - 5
          ? 'declining'
          : 'stable';

    return {
      trend,
      recentAverageScore: Math.round(recentAvg),
      historicalAverageScore: Math.round(olderAvg),
      totalSessions: sessions.length,
      insights: this.generateTrendInsights(sessions),
    };
  }

  /**
   * Generate trend insights
   */
  private generateTrendInsights(
    sessions: any[],
  ): string[] {
    const insights: string[] = [];

    const avgScore =
      sessions.reduce((sum, s) => sum + ((s.summary as any)?.wellnessScore || 50), 0) / sessions.length;

    if (avgScore >= 80) {
      insights.push('Your overall wellness scores are excellent!');
    } else if (avgScore >= 60) {
      insights.push('Your wellness scores are good with room for improvement.');
    } else {
      insights.push(
        'Consider focusing on stress reduction and pacing techniques.',
      );
    }

    // Analyze common patterns
    const fastPaceCount = sessions.filter((s) => {
      const metrics = s.metrics || [];
      const speakingPace = metrics.find((m: any) => m.metricType === 'speakingPaceWPM');
      return speakingPace && speakingPace.value > 170;
    }).length;

    if (fastPaceCount > sessions.length / 2) {
      insights.push('You tend to speak quickly. Practice deliberate pacing.');
    }

    return insights;
  }
}
