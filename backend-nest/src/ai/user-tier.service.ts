import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Helper service for getting user subscription tier
 */
@Injectable()
export class UserTierService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get user's subscription tier
   */
  async getUserTier(userId: string): Promise<'free' | 'pro' | 'enterprise'> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    });

    if (!user || !user.subscriptionTier) {
      return 'free';
    }

    const tier = user.subscriptionTier.toLowerCase();

    if (tier === 'pro') return 'pro';
    if (tier === 'enterprise') return 'enterprise';

    return 'free';
  }

  /**
   * Check if user can use expensive feature
   */
  async canUseFeature(
    userId: string,
    feature: 'dall-e' | 'tts-hd' | 'advanced-analysis' | 'video-export',
  ): Promise<boolean> {
    const tier = await this.getUserTier(userId);

    const restrictions: Record<string, string[]> = {
      free: ['dall-e', 'tts-hd', 'advanced-analysis', 'video-export'],
      pro: ['tts-hd', 'video-export'],
      enterprise: [], // No restrictions
    };

    return !restrictions[tier]?.includes(feature);
  }
}
