import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';

type SignLanguageCode =
  | 'ASL'
  | 'BSL'
  | 'JSL'
  | 'AUSLAN'
  | 'FSL'
  | 'DGS'
  | 'ISL';

interface AvatarConfig {
  style: 'realistic' | 'stylized' | 'minimal';
  speed: 'slow' | 'normal' | 'fast';
  size: 'small' | 'medium' | 'large';
  position: 'bottom-right' | 'bottom-left' | 'side-panel';
}

export interface SignSequence {
  text: string;
  signs: Array<{
    gloss: string;
    animation?: string;
    duration: number;
  }>;
}

@Injectable()
export class SignLanguageService {
  private readonly logger = new Logger(SignLanguageService.name);

  // Common sign mappings (simplified - real implementation would use ML models)
  private readonly commonSigns: Record<string, string[]> = {
    hello: ['WAVE', 'HELLO'],
    thank: ['THANK', 'YOU'],
    question: ['QUESTION-MARK'],
    important: ['IMPORTANT', 'EMPHASIS'],
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Configure sign language for a project
   */
  async configureProject(
    projectId: string,
    userId: string,
    config: {
      enabled: boolean;
      language: SignLanguageCode;
      avatarConfig?: AvatarConfig;
    },
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.ownerId !== userId) {
      throw new BadRequestException('Project not found or unauthorized');
    }

    const existing = await this.prisma.signLanguageConfig.findFirst({
      where: { projectId },
    });

    const avatarConfig: AvatarConfig = config.avatarConfig || {
      style: 'stylized',
      speed: 'normal',
      size: 'medium',
      position: 'bottom-right',
    };

    if (existing) {
      return this.prisma.signLanguageConfig.update({
        where: { id: existing.id },
        data: {
          enabled: config.enabled,
          language: config.language,
          avatarStyle: avatarConfig.style,
          avatarPosition: avatarConfig.position,
          speed: avatarConfig.speed,
        },
      });
    }

    return this.prisma.signLanguageConfig.create({
      data: {
        projectId,
        enabled: config.enabled,
        language: config.language,
        avatarStyle: avatarConfig.style,
        avatarPosition: avatarConfig.position,
        speed: avatarConfig.speed,
      },
    });
  }

  /**
   * Get project configuration
   */
  async getConfiguration(projectId: string) {
    const config = await this.prisma.signLanguageConfig.findFirst({
      where: { projectId },
    });

    if (!config) {
      return {
        enabled: false,
        language: 'ASL',
        avatarStyle: 'stylized',
        avatarPosition: 'bottom-right',
        avatarSize: 'medium',
        speed: 'normal',
      };
    }

    return {
      enabled: config.enabled,
      language: config.language,
      avatarStyle: config.avatarStyle,
      avatarPosition: config.avatarPosition,
      avatarSize: config.avatarSize,
      speed: config.speed,
    };
  }

  /**
   * Translate text to sign language sequence
   */
  async translateToSigns(
    text: string,
    language: SignLanguageCode = 'ASL',
  ): Promise<SignSequence> {
    // Simplified translation - real implementation would use ML models
    const words = text.toLowerCase().split(/\s+/);
    const signs: SignSequence['signs'] = [];

    for (const word of words) {
      const gloss = this.textToGloss(word);
      signs.push({
        gloss,
        duration: this.estimateDuration(gloss),
      });
    }

    return { text, signs };
  }

  /**
   * Convert text to sign language gloss notation
   */
  private textToGloss(word: string): string {
    // Check common mappings
    const mapped = this.commonSigns[word];
    if (mapped) {
      return mapped.join('-');
    }

    // For unknown words, fingerspell
    if (word.length <= 4) {
      return `FS:${word.toUpperCase()}`;
    }

    // Default: use word as gloss
    return word.toUpperCase();
  }

  /**
   * Estimate sign duration in milliseconds
   */
  private estimateDuration(gloss: string): number {
    if (gloss.startsWith('FS:')) {
      // Fingerspelling takes longer
      return gloss.length * 300;
    }
    return 800; // Average sign duration
  }

  /**
   * Generate sign language translation for a slide
   */
  async translateSlide(slideId: string, language: SignLanguageCode = 'ASL') {
    const slide = await this.prisma.slide.findUnique({
      where: { id: slideId },
      include: { blocks: true },
    });

    if (!slide) {
      throw new NotFoundException('Slide not found');
    }

    // Extract all text content
    const textContent: string[] = [];

    if (slide.title) textContent.push(slide.title);

    for (const block of slide.blocks) {
      const content = (block.content as { text?: string }) || {};
      if (content.text) {
        textContent.push(content.text);
      }
    }

    const fullText = textContent.join('. ');

    // Translate
    const translation = await this.translateToSigns(fullText, language);

    // Store translation
    const stored = await this.prisma.signLanguageTranslation.create({
      data: {
        slideId,
        language,
        originalText: fullText,
        glossSequence: translation.signs.map((s) => s.gloss),
        timing: translation.signs.map((s) => s.duration),
        status: 'generated',
      },
    });

    return {
      translation: stored,
      sequence: translation,
    };
  }

  /**
   * Get stored translation for slide
   */
  async getSlideTranslation(slideId: string, language?: SignLanguageCode) {
    const where: { slideId: string; language?: string } = { slideId };
    if (language) {
      where.language = language;
    }

    return this.prisma.signLanguageTranslation.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Generate translations for entire project
   */
  async translateProject(
    projectId: string,
    userId: string,
    language: SignLanguageCode = 'ASL',
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { slides: true },
    });

    if (!project || project.ownerId !== userId) {
      throw new BadRequestException('Project not found or unauthorized');
    }

    const results: Array<{ slideId: string; status: string }> = [];

    for (const slide of project.slides) {
      try {
        await this.translateSlide(slide.id, language);
        results.push({ slideId: slide.id, status: 'success' });
      } catch (error) {
        results.push({ slideId: slide.id, status: 'failed' });
      }
    }

    return {
      projectId,
      language,
      slides: results,
      successCount: results.filter((r) => r.status === 'success').length,
    };
  }

  /**
   * Get available sign languages
   */
  getSupportedLanguages() {
    return [
      { code: 'ASL', name: 'American Sign Language', country: 'USA' },
      { code: 'BSL', name: 'British Sign Language', country: 'UK' },
      { code: 'JSL', name: 'Japanese Sign Language', country: 'Japan' },
      {
        code: 'AUSLAN',
        name: 'Australian Sign Language',
        country: 'Australia',
      },
      { code: 'FSL', name: 'French Sign Language', country: 'France' },
      { code: 'DGS', name: 'German Sign Language', country: 'Germany' },
      {
        code: 'ISL',
        name: 'International Sign Language',
        country: 'International',
      },
    ];
  }

  /**
   * Get avatar embed code
   */
  async getAvatarEmbed(projectId: string) {
    const config = await this.getConfiguration(projectId);

    if (!config.enabled) {
      return null;
    }

    // Generate embed configuration
    return {
      embedCode: `<sign-language-avatar
        project-id="${projectId}"
        language="${(config as any).language}"
        style="${(config as any).avatarStyle}"
        position="${(config as any).avatarPosition}"
        speed="${(config as any).speed}"
      ></sign-language-avatar>`,
      scriptUrl: '/scripts/sign-language-avatar.js',
      config,
    };
  }

  /**
   * Preview sign for a word
   */
  async previewSign(word: string, language: SignLanguageCode = 'ASL') {
    const gloss = this.textToGloss(word);

    return {
      word,
      language,
      gloss,
      duration: this.estimateDuration(gloss),
      // In production, this would return animation data or video URL
      previewUrl: `/api/sign-language/preview/${language}/${gloss}`,
    };
  }
}
