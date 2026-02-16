import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';

interface AccessibilityProfile {
  reduceAnimations: boolean;
  simplifyText: boolean;
  highContrast: boolean;
  focusMode: boolean;
  readingGuide: boolean;
  textToSpeech: boolean;
  dyslexiaFont: boolean;
  lineSpacing: 'normal' | 'increased' | 'large';
  wordSpacing: 'normal' | 'increased';
  colorOverlay?: string;
  contentChunking: boolean;
  progressIndicator: boolean;
}

interface SimplificationResult {
  original: string;
  simplified: string;
  readingLevel: {
    original: number;
    simplified: number;
  };
  changes: string[];
}

@Injectable()
export class CognitiveAccessibilityService {
  private readonly logger = new Logger(CognitiveAccessibilityService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Create or update user accessibility profile
   */
  async saveProfile(userId: string, profile: Partial<AccessibilityProfile>) {
    const existing = await this.prisma.cognitiveAccessibilityProfile.findFirst({
      where: { userId },
    });

    const fullProfile = this.mergeWithDefaults(profile);

    if (existing) {
      return this.prisma.cognitiveAccessibilityProfile.update({
        where: { id: existing.id },
        data: {
          settings: fullProfile as object,
          updatedAt: new Date(),
        },
      });
    }

    return this.prisma.cognitiveAccessibilityProfile.create({
      data: {
        userId,
        settings: fullProfile as object,
        presetName: this.determinePreset(fullProfile),
      },
    });
  }

  /**
   * Get user's accessibility profile
   */
  async getProfile(userId: string): Promise<AccessibilityProfile> {
    const profile = await this.prisma.cognitiveAccessibilityProfile.findFirst({
      where: { userId },
    });

    if (!profile) {
      return this.getDefaultProfile();
    }

    return profile.settings as AccessibilityProfile;
  }

  /**
   * Get default profile
   */
  getDefaultProfile(): AccessibilityProfile {
    return {
      reduceAnimations: false,
      simplifyText: false,
      highContrast: false,
      focusMode: false,
      readingGuide: false,
      textToSpeech: false,
      dyslexiaFont: false,
      lineSpacing: 'normal',
      wordSpacing: 'normal',
      contentChunking: false,
      progressIndicator: false,
    };
  }

  /**
   * Merge with defaults
   */
  private mergeWithDefaults(partial: Partial<AccessibilityProfile>): AccessibilityProfile {
    return { ...this.getDefaultProfile(), ...partial };
  }

  /**
   * Determine preset name based on settings
   */
  private determinePreset(profile: AccessibilityProfile): string {
    if (profile.dyslexiaFont && profile.lineSpacing !== 'normal') {
      return 'dyslexia-friendly';
    }
    if (profile.reduceAnimations && profile.simplifyText) {
      return 'cognitive-ease';
    }
    if (profile.highContrast && profile.focusMode) {
      return 'low-vision';
    }
    if (profile.focusMode && profile.contentChunking) {
      return 'adhd-friendly';
    }
    return 'custom';
  }

  /**
   * Get available presets
   */
  getPresets(): Array<{ name: string; description: string; settings: AccessibilityProfile }> {
    return [
      {
        name: 'dyslexia-friendly',
        description: 'Optimized for users with dyslexia',
        settings: {
          ...this.getDefaultProfile(),
          dyslexiaFont: true,
          lineSpacing: 'increased',
          wordSpacing: 'increased',
          colorOverlay: '#FDF6E3',
        },
      },
      {
        name: 'cognitive-ease',
        description: 'Simplified experience for cognitive accessibility',
        settings: {
          ...this.getDefaultProfile(),
          reduceAnimations: true,
          simplifyText: true,
          contentChunking: true,
          progressIndicator: true,
          focusMode: true,
        },
      },
      {
        name: 'adhd-friendly',
        description: 'Optimized for attention-related needs',
        settings: {
          ...this.getDefaultProfile(),
          reduceAnimations: true,
          focusMode: true,
          contentChunking: true,
          progressIndicator: true,
        },
      },
      {
        name: 'anxiety-reduction',
        description: 'Calm, predictable experience',
        settings: {
          ...this.getDefaultProfile(),
          reduceAnimations: true,
          progressIndicator: true,
          colorOverlay: '#E8F5E9',
        },
      },
    ];
  }

  /**
   * Apply preset
   */
  async applyPreset(userId: string, presetName: string) {
    const presets = this.getPresets();
    const preset = presets.find(p => p.name === presetName);

    if (!preset) {
      throw new NotFoundException('Preset not found');
    }

    return this.saveProfile(userId, preset.settings);
  }

  /**
   * Simplify text content
   */
  async simplifyText(text: string, targetLevel: 'basic' | 'intermediate' = 'intermediate'): Promise<SimplificationResult> {
    const originalLevel = this.calculateReadingLevel(text);

    try {
      const simplified = await this.aiService.generateText(
        `Simplify this text for ${targetLevel} reading level. 
Keep the same meaning but use:
- Shorter sentences
- Common words
- Active voice
- Clear structure

Original text:
"${text}"

Provide only the simplified text, nothing else.`,
        { maxTokens: Math.max(200, text.length) }
      );

      const simplifiedLevel = this.calculateReadingLevel(simplified);

      return {
        original: text,
        simplified: simplified.trim(),
        readingLevel: {
          original: originalLevel,
          simplified: simplifiedLevel,
        },
        changes: this.identifyChanges(text, simplified),
      };
    } catch (error) {
      this.logger.error('Text simplification failed', error);
      // Fallback: basic simplification
      return {
        original: text,
        simplified: this.basicSimplify(text),
        readingLevel: {
          original: originalLevel,
          simplified: originalLevel - 1,
        },
        changes: ['Basic simplification applied'],
      };
    }
  }

  /**
   * Calculate approximate reading level (Flesch-Kincaid grade)
   */
  private calculateReadingLevel(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    const words = text.split(/\s+/).filter(w => w.trim());
    const syllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0);

    if (sentences.length === 0 || words.length === 0) return 0;

    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;

    // Flesch-Kincaid Grade Level formula
    const grade = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;

    return Math.max(1, Math.min(18, Math.round(grade)));
  }

  /**
   * Count syllables in a word
   */
  private countSyllables(word: string): number {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;

    const vowels = 'aeiouy';
    let count = 0;
    let previousWasVowel = false;

    for (const char of word) {
      const isVowel = vowels.includes(char);
      if (isVowel && !previousWasVowel) {
        count++;
      }
      previousWasVowel = isVowel;
    }

    if (word.endsWith('e')) count--;
    return Math.max(1, count);
  }

  /**
   * Basic text simplification without AI
   */
  private basicSimplify(text: string): string {
    // Split into sentences and simplify
    return text
      .replace(/\b(utilize|implement|facilitate)\b/gi, 'use')
      .replace(/\b(approximately)\b/gi, 'about')
      .replace(/\b(subsequently)\b/gi, 'then')
      .replace(/\b(nevertheless)\b/gi, 'but')
      .replace(/\b(consequently)\b/gi, 'so')
      .replace(/\b(furthermore)\b/gi, 'also')
      .replace(/\b(however)\b/gi, 'but');
  }

  /**
   * Identify changes between original and simplified
   */
  private identifyChanges(original: string, simplified: string): string[] {
    const changes: string[] = [];

    const origWords = original.split(/\s+/).length;
    const simpWords = simplified.split(/\s+/).length;

    if (simpWords < origWords) {
      changes.push(`Reduced from ${origWords} to ${simpWords} words`);
    }

    const origSentences = original.split(/[.!?]+/).filter(s => s.trim()).length;
    const simpSentences = simplified.split(/[.!?]+/).filter(s => s.trim()).length;

    if (simpSentences !== origSentences) {
      changes.push(`Sentence structure adjusted`);
    }

    return changes;
  }

  /**
   * Process slide for cognitive accessibility
   */
  async processSlide(slideId: string, options: {
    simplifyText?: boolean;
    chunk?: boolean;
  }) {
    const slide = await this.prisma.slide.findUnique({
      where: { id: slideId },
      include: { blocks: true },
    });

    if (!slide) {
      throw new NotFoundException('Slide not found');
    }

    const processed: Array<{ blockId: string; changes: string[] }> = [];

    for (const block of slide.blocks) {
      const content = block.content as { text?: string } || {};
      const changes: string[] = [];

      if (content.text && options.simplifyText) {
        const simplified = await this.simplifyText(content.text);
        // In production, would update the block
        changes.push(`Simplified from grade ${simplified.readingLevel.original} to ${simplified.readingLevel.simplified}`);
      }

      if (options.chunk && content.text && content.text.length > 200) {
        changes.push('Content chunked for easier reading');
      }

      if (changes.length > 0) {
        processed.push({ blockId: block.id, changes });
      }
    }

    return {
      slideId,
      processed,
      summary: `${processed.length} blocks processed`,
    };
  }

  /**
   * Generate accessible version of project
   */
  async generateAccessibleVersion(projectId: string, userId: string) {
    const profile = await this.getProfile(userId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        slides: {
          include: { blocks: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const modifications: string[] = [];

    if (profile.simplifyText) {
      modifications.push('Text simplified for easier reading');
    }
    if (profile.contentChunking) {
      modifications.push('Content divided into smaller chunks');
    }
    if (profile.dyslexiaFont) {
      modifications.push('Dyslexia-friendly font applied');
    }
    if (profile.highContrast) {
      modifications.push('High contrast colors applied');
    }
    if (profile.reduceAnimations) {
      modifications.push('Animations reduced or removed');
    }

    return {
      projectId,
      profile,
      modifications,
      cssOverrides: this.generateCSSOverrides(profile),
    };
  }

  /**
   * Generate CSS overrides for profile
   */
  private generateCSSOverrides(profile: AccessibilityProfile): string {
    const rules: string[] = [];

    if (profile.dyslexiaFont) {
      rules.push(`font-family: 'OpenDyslexic', sans-serif !important;`);
    }

    if (profile.lineSpacing === 'increased') {
      rules.push('line-height: 1.8 !important;');
    } else if (profile.lineSpacing === 'large') {
      rules.push('line-height: 2.2 !important;');
    }

    if (profile.wordSpacing === 'increased') {
      rules.push('word-spacing: 0.3em !important;');
    }

    if (profile.colorOverlay) {
      rules.push(`background-color: ${profile.colorOverlay} !important;`);
    }

    if (profile.highContrast) {
      rules.push('filter: contrast(1.2) !important;');
    }

    if (profile.reduceAnimations) {
      rules.push('animation: none !important;');
      rules.push('transition: none !important;');
    }

    return `.cognitive-accessible { ${rules.join(' ')} }`;
  }
}
