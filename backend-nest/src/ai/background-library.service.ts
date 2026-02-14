import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface GeneratedBackground {
  id: string;
  userId: string;
  url: string;
  prompt: string;
  style: string;
  colorScheme?: string;
  createdAt: Date;
}

@Injectable()
export class BackgroundLibraryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Save generated background to user's library
   */
  async saveBackground(
    userId: string,
    url: string,
    prompt: string,
    style: string,
    colorScheme?: string,
  ): Promise<GeneratedBackground> {
    // In a real implementation, you'd save this to a dedicated table
    // For now, we'll use the Asset table
    const asset = await this.prisma.asset.create({
      data: {
        userId,
        url,
        filename: `background-${Date.now()}.png`,
        mimeType: 'image/png',
        size: 0, // Would need to fetch actual size
      },
    });

    return {
      id: asset.id,
      userId: asset.userId,
      url: asset.url,
      prompt,
      style,
      colorScheme,
      createdAt: asset.createdAt,
    };
  }

  /**
   * Get user's background library
   */
  async getUserBackgrounds(userId: string): Promise<GeneratedBackground[]> {
    const assets = await this.prisma.asset.findMany({
      where: {
        userId,
        mimeType: 'image/png',
        filename: { startsWith: 'background-' },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return assets.map((asset) => ({
      id: asset.id,
      userId: asset.userId,
      url: asset.url,
      prompt: '', // Would need to store this in metadata
      style: '',
      createdAt: asset.createdAt,
    }));
  }

  /**
   * Delete background from library
   */
  async deleteBackground(userId: string, backgroundId: string): Promise<void> {
    await this.prisma.asset.deleteMany({
      where: {
        id: backgroundId,
        userId, // Ensure user owns this asset
      },
    });
  }

  /**
   * Get background presets by industry
   */
  getPresetPrompts(industry: string, style: string): string[] {
    const presets: Record<string, Record<string, string[]>> = {
      tech: {
        professional: [
          'Modern tech circuit board pattern',
          'Minimalist digital network nodes',
          'Clean technology infrastructure',
        ],
        abstract: [
          'Digital data streams flowing',
          'Abstract AI neural network',
          'Cyberpunk neon elements',
        ],
      },
      finance: {
        professional: [
          'Corporate skyline at dusk',
          'Modern financial district',
          'Professional stock market charts',
        ],
        elegant: [
          'Luxury gold and navy pattern',
          'Sophisticated marble texture',
          'Premium financial aesthetic',
        ],
      },
      education: {
        minimal: [
          'Clean chalkboard texture',
          'Simple book and learning elements',
          'Academic workspace aesthetic',
        ],
        creative: [
          'Colorful educational icons',
          'Inspiring learning environment',
          'Innovative classroom design',
        ],
      },
      creative: {
        vibrant: [
          'Bold artistic paint splashes',
          'Vibrant creative workspace',
          'Dynamic color explosion',
        ],
        abstract: [
          'Abstract artistic composition',
          'Creative design elements',
          'Imaginative visual patterns',
        ],
      },
      business: {
        professional: [
          'Modern office environment',
          'Corporate meeting room',
          'Professional workspace',
        ],
        minimal: [
          'Clean business aesthetic',
          'Minimalist office design',
          'Simple professional pattern',
        ],
      },
    };

    return presets[industry]?.[style] || [];
  }
}
