import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

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
        startTime: new Date(),
        // store aggregated metrics in `summary` JSON; raw metric records live in `WellnessMetric` table
        summary: {
          speakingPaceWPM: 0,
          pauseFrequency: 0,
          avgPauseDuration: 0,
          volumeVariation: 0,
          fillerWordCount: 0,
          stressIndicators: 0,
        } as Prisma.InputJsonValue,
        breaksTaken: 0,
        wellnessScore: 100,
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

    const currentMetrics = (session.summary as unknown as WellnessMetrics) || {
      speakingPaceWPM: 0,
      pauseFrequency: 0,
      avgPauseDuration: 0,
      volumeVariation: 0,
      fillerWordCount: 0,
      stressIndicators: 0,
    };
    const updatedMetrics = { ...currentMetrics, ...metrics };

    // Calculate wellness score
    const wellnessScore = this.calculateWellnessScore(
      updatedMetrics as WellnessMetrics,
    );

    return this.prisma.wellnessSession.update({
      where: { id: sessionId },
      data: {
        summary: updatedMetrics as Prisma.InputJsonValue,
        wellnessScore,
      },
    });
  }

  /**
   * Calculate wellness score based on metrics
   */
  private calculateWellnessScore(metrics: WellnessMetrics): number {
    let score = 100;

    // Speaking pace analysis (ideal: 120-150 WPM)
    if (metrics.speakingPaceWPM < 100) {
      score -= 10; // Too slow
    } else if (metrics.speakingPaceWPM > 180) {
      score -= 15; // Too fast, may indicate stress
    }

    // Filler word penalty
    score -= Math.min(20, metrics.fillerWordCount * 2);

    // Stress indicator penalty
    score -= Math.min(15, metrics.stressIndicators * 3);

    // Pause frequency bonus (good for engagement)
    if (metrics.pauseFrequency >= 3 && metrics.pauseFrequency <= 8) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * End session and generate summary
   */
  async endSession(sessionId: string) {
    const session = await this.prisma.wellnessSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Wellness session not found');
    }

    const endTime = new Date();
    const start = session.startTime ?? session.startedAt;
    const duration =
      (endTime.getTime() - (start?.getTime() ?? endTime.getTime())) / 1000 / 60; // minutes

    const metrics = (session.summary as unknown as WellnessMetrics) || {
      speakingPaceWPM: 0,
      pauseFrequency: 0,
      avgPauseDuration: 0,
      volumeVariation: 0,
      fillerWordCount: 0,
      stressIndicators: 0,
    };
    const recommendations = this.generateRecommendations(metrics, duration);

    const updated = await this.prisma.wellnessSession.update({
      where: { id: sessionId },
      data: {
        endTime,
        recommendations: recommendations as object[],
      },
    });

    return {
      ...updated,
      durationMinutes: Math.round(duration),
      summary: this.generateSummary(metrics, duration, session.breaksTaken),
      recommendations,
    };
  }

  /**
   * Generate recommendations based on metrics
   */
  private generateRecommendations(
    metrics: WellnessMetrics,
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

    // Speaking pace
    if (metrics.speakingPaceWPM > 170) {
      recommendations.push({
        category: 'pace',
        issue: 'Speaking too fast',
        suggestion:
          'Practice deliberate pauses and slow down to 130-150 WPM for better comprehension',
        priority: 'high',
      });
    } else if (metrics.speakingPaceWPM < 100) {
      recommendations.push({
        category: 'pace',
        issue: 'Speaking pace is slow',
        suggestion: 'Pick up the pace slightly to maintain audience engagement',
        priority: 'medium',
      });
    }

    // Filler words
    if (metrics.fillerWordCount > 10) {
      recommendations.push({
        category: 'clarity',
        issue: 'Excessive filler words detected',
        suggestion:
          'Practice pausing instead of using filler words like "um", "uh", "like"',
        priority: 'high',
      });
    }

    // Stress indicators
    if (metrics.stressIndicators > 3) {
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
    if (metrics.pauseFrequency < 2) {
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
   * Generate wellness summary
   */
  private generateSummary(
    metrics: WellnessMetrics,
    durationMinutes: number,
    breaksTaken: number,
  ): {
    overallRating: 'excellent' | 'good' | 'fair' | 'needs-improvement';
    highlights: string[];
    areasForImprovement: string[];
  } {
    const score = this.calculateWellnessScore(metrics);

    let overallRating: 'excellent' | 'good' | 'fair' | 'needs-improvement';
    if (score >= 85) overallRating = 'excellent';
    else if (score >= 70) overallRating = 'good';
    else if (score >= 50) overallRating = 'fair';
    else overallRating = 'needs-improvement';

    const highlights: string[] = [];
    const areasForImprovement: string[] = [];

    // Analyze metrics
    if (metrics.speakingPaceWPM >= 120 && metrics.speakingPaceWPM <= 150) {
      highlights.push('Optimal speaking pace maintained');
    } else {
      areasForImprovement.push('Speaking pace could be adjusted');
    }

    if (metrics.fillerWordCount < 5) {
      highlights.push('Minimal filler words used');
    } else {
      areasForImprovement.push('Reduce filler word usage');
    }

    if (breaksTaken > 0 && durationMinutes > 30) {
      highlights.push('Took healthy breaks during presentation');
    }

    if (metrics.volumeVariation > 0.3) {
      highlights.push('Good vocal variety and emphasis');
    }

    return { overallRating, highlights, areasForImprovement };
  }

  /**
   * Record break taken
   */
  async recordBreak(sessionId: string, _breakType: string) {
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
    const sessions = await this.prisma.wellnessSession.findMany({
      where: { userId },
      orderBy: { startTime: 'desc' },
      take: limit,
      select: {
        id: true,
        startTime: true,
        endTime: true,
        wellnessScore: true,
        breaksTaken: true,
        presentation: true,
      },
    });

    // presentation is a JSON column; return as-is so frontend can access title if present
    return sessions;
  }

  /**
   * Get wellness trends
   */
  async getWellnessTrends(userId: string) {
    const sessions = await this.prisma.wellnessSession.findMany({
      where: { userId, endTime: { not: null } },
      orderBy: { startTime: 'desc' },
      take: 20,
    });

    if (sessions.length < 2) {
      return {
        trend: 'insufficient-data',
        message: 'Need more sessions for trend analysis',
      };
    }

    const recentAvg =
      sessions.slice(0, 5).reduce((sum, s) => sum + (s.wellnessScore ?? 0), 0) /
      5;
    const olderAvg =
      sessions.slice(-5).reduce((sum, s) => sum + (s.wellnessScore ?? 0), 0) /
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
      insights: this.generateTrendInsights(
        sessions.map((s) => ({
          metrics: (s.summary as unknown as object) || {},
          wellnessScore: s.wellnessScore || 0,
        })),
      ),
    };
  }

  /**
   * Generate trend insights
   */
  private generateTrendInsights(
    sessions: { metrics: object; wellnessScore: number }[],
  ): string[] {
    const insights: string[] = [];

    const avgScore =
      sessions.reduce((sum, s) => sum + s.wellnessScore, 0) / sessions.length;

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
      const m = s.metrics as WellnessMetrics;
      return m.speakingPaceWPM > 170;
    }).length;

    if (fastPaceCount > sessions.length / 2) {
      insights.push('You tend to speak quickly. Practice deliberate pacing.');
    }

    return insights;
  }
}
