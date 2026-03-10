import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface GeneratedBackground {
  id: string;
  userId: string;
  url: string;
  prompt: string;
  style: string;
  colorScheme?: string;
  tags: string[];
  createdAt: Date;
}

interface BackgroundMetadata {
  prompt: string;
  style: string;
  colorScheme?: string;
  generatedBy?: string;
}

@Injectable()
export class BackgroundLibraryService {
  private readonly logger = new Logger(BackgroundLibraryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Save generated background to user's library.
   * Uses the Upload model which has a metadata JSON column for storing
   * prompt, style, and color scheme information.
   */
  async saveBackground(
    userId: string,
    url: string,
    prompt: string,
    style: string,
    colorScheme?: string,
  ): Promise<GeneratedBackground> {
    const metadata: BackgroundMetadata = {
      prompt,
      style,
      colorScheme,
      generatedBy: 'ai-background-generator',
    };

    const upload = await this.prisma.upload.create({
      data: {
        userId,
        url,
        source: 'ai',
        filename: `background-${Date.now()}.png`,
        mimeType: 'image/png',
        size: 0,
        description: prompt,
        tags: ['background', style, ...(colorScheme ? [colorScheme] : [])],
        metadata: metadata as object,
      },
    });

    this.logger.log(
      `Saved background for user ${userId}: style=${style}, prompt="${prompt.substring(0, 50)}..."`,
    );

    return {
      id: upload.id,
      userId: upload.userId,
      url: upload.url,
      prompt,
      style,
      colorScheme,
      tags: upload.tags,
      createdAt: upload.createdAt,
    };
  }

  /**
   * Get user's background library with full metadata
   */
  async getUserBackgrounds(
    userId: string,
    options?: { limit?: number; style?: string },
  ): Promise<GeneratedBackground[]> {
    const { limit = 50, style } = options || {};

    const uploads = await this.prisma.upload.findMany({
      where: {
        userId,
        source: 'ai',
        tags: { has: 'background' },
        ...(style ? { tags: { hasEvery: ['background', style] } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return uploads.map((upload) => {
      const meta = (upload.metadata || {}) as unknown as BackgroundMetadata;
      return {
        id: upload.id,
        userId: upload.userId,
        url: upload.url,
        prompt: meta.prompt || upload.description || '',
        style: meta.style || '',
        colorScheme: meta.colorScheme,
        tags: upload.tags,
        createdAt: upload.createdAt,
      };
    });
  }

  /**
   * Delete background from library
   */
  async deleteBackground(userId: string, backgroundId: string): Promise<void> {
    await this.prisma.upload.deleteMany({
      where: {
        id: backgroundId,
        userId,
      },
    });
  }

  /**
   * Search backgrounds by keyword in prompt or tags
   */
  async searchBackgrounds(
    userId: string,
    query: string,
    limit = 20,
  ): Promise<GeneratedBackground[]> {
    const uploads = await this.prisma.upload.findMany({
      where: {
        userId,
        source: 'ai',
        tags: { has: 'background' },
        OR: [
          { description: { contains: query, mode: 'insensitive' } },
          { tags: { hasSome: query.toLowerCase().split(/\s+/) } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return uploads.map((upload) => {
      const meta = (upload.metadata || {}) as unknown as BackgroundMetadata;
      return {
        id: upload.id,
        userId: upload.userId,
        url: upload.url,
        prompt: meta.prompt || upload.description || '',
        style: meta.style || '',
        colorScheme: meta.colorScheme,
        tags: upload.tags,
        createdAt: upload.createdAt,
      };
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
