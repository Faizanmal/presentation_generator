import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { Project, Slide, Block, Prisma } from '@prisma/client';

export type LanguageCode =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'pt'
  | 'nl'
  | 'pl'
  | 'ru'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'ar'
  | 'hi'
  | 'tr'
  | 'vi'
  | 'th'
  | 'id';

export interface Language {
  code: LanguageCode;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
}

export interface TranslatedContent {
  slideId: string;
  blockId: string;
  originalLanguage: LanguageCode;
  translations: Record<
    LanguageCode,
    {
      content: unknown;
      translatedAt: Date;
      isManuallyEdited: boolean;
    }
  >;
}

export interface ProjectTranslation {
  id: string;
  projectId: string;
  primaryLanguage: LanguageCode;
  availableLanguages: LanguageCode[];
  translationProgress: Record<
    LanguageCode,
    {
      totalBlocks: number;
      translatedBlocks: number;
      percentage: number;
    }
  >;
  updatedAt: Date;
}

export interface TranslationJob {
  id: string;
  projectId: string;
  targetLanguage: LanguageCode;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  progress: number;
  totalBlocks: number;
  translatedBlocks: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

@Injectable()
export class MultilingualService {
  private readonly logger = new Logger(MultilingualService.name);

  readonly supportedLanguages: Language[] = [
    { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr' },
    { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr' },
    { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano', direction: 'ltr' },
    {
      code: 'pt',
      name: 'Portuguese',
      nativeName: 'Português',
      direction: 'ltr',
    },
    { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', direction: 'ltr' },
    { code: 'pl', name: 'Polish', nativeName: 'Polski', direction: 'ltr' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr' },
    { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr' },
    { code: 'ko', name: 'Korean', nativeName: '한국어', direction: 'ltr' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr' },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', direction: 'ltr' },
    {
      code: 'vi',
      name: 'Vietnamese',
      nativeName: 'Tiếng Việt',
      direction: 'ltr',
    },
    { code: 'th', name: 'Thai', nativeName: 'ไทย', direction: 'ltr' },
    {
      code: 'id',
      name: 'Indonesian',
      nativeName: 'Bahasa Indonesia',
      direction: 'ltr',
    },
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Get supported languages
   */
  getSupportedLanguages(): Language[] {
    return this.supportedLanguages;
  }

  /**
   * Initialize multilingual support for a project
   */
  async initializeProject(
    projectId: string,
    userId: string,
    primaryLanguage: LanguageCode,
  ): Promise<ProjectTranslation> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const translation = await this.prisma.projectTranslation.upsert({
      where: { projectId },
      create: {
        projectId,
        sourceLanguage: primaryLanguage,
        primaryLanguage,
        availableLanguages: [primaryLanguage],
        translationProgress: {},
      },
      update: {
        primaryLanguage,
      },
    });

    return {
      id: translation.id,
      projectId: translation.projectId,
      primaryLanguage: translation.primaryLanguage as LanguageCode,
      availableLanguages: translation.availableLanguages as LanguageCode[],
      translationProgress: translation.translationProgress as Record<
        LanguageCode,
        {
          totalBlocks: number;
          translatedBlocks: number;
          percentage: number;
        }
      >,
      updatedAt: translation.updatedAt,
    };
  }

  /**
   * Translate entire project to a target language
   */
  async translateProject(
    projectId: string,
    userId: string,
    targetLanguage: LanguageCode,
  ): Promise<TranslationJob> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
      include: {
        slides: {
          include: { blocks: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const translation = await this.prisma.projectTranslation.findUnique({
      where: { projectId },
    });

    if (!translation) {
      throw new BadRequestException('Project not initialized for multilingual');
    }

    // Create translation job
    const job = await this.prisma.translationJob.create({
      data: {
        projectId,
        targetLanguage,
        status: 'pending',
        progress: 0,
        totalBlocks: project.slides.reduce(
          (acc, s) => acc + s.blocks.length,
          0,
        ),
        translatedBlocks: 0,
      },
    });

    // Start async translation
    void this.processTranslationJob(
      job.id,
      project,
      targetLanguage,
      translation.primaryLanguage as LanguageCode,
    );

    return {
      id: job.id,
      projectId: job.projectId,
      targetLanguage: job.targetLanguage as LanguageCode,
      status: job.status as TranslationJob['status'],
      progress: job.progress,
      totalBlocks: job.totalBlocks,
      translatedBlocks: job.translatedBlocks,
    };
  }

  /**
   * Translate a single slide
   */
  async translateSlide(
    projectId: string,
    slideId: string,
    userId: string,
    targetLanguage: LanguageCode,
  ): Promise<{ translatedBlocks: number }> {
    const slide = await this.prisma.slide.findFirst({
      where: {
        id: slideId,
        project: { id: projectId, ownerId: userId },
      },
      include: { blocks: true },
    });

    if (!slide) {
      throw new NotFoundException('Slide not found');
    }

    const translation = await this.prisma.projectTranslation.findUnique({
      where: { projectId },
    });

    const sourceLanguage = (translation?.primaryLanguage ||
      'en') as LanguageCode;
    let translatedCount = 0;

    for (const block of slide.blocks) {
      try {
        await this.translateBlock(
          block,
          sourceLanguage,
          targetLanguage,
          projectId,
        );
        translatedCount++;
      } catch (error) {
        this.logger.error(`Failed to translate block ${block.id}:`, error);
      }
    }

    return { translatedBlocks: translatedCount };
  }

  /**
   * Get project with translations for a specific language
   */
  async getProjectInLanguage(
    projectId: string,
    language: LanguageCode,
  ): Promise<{
    project: unknown;
    language: LanguageCode;
    direction: 'ltr' | 'rtl';
  }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        slides: {
          include: { blocks: true },
          orderBy: { order: 'asc' },
        },
        theme: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const translation = await this.prisma.projectTranslation.findUnique({
      where: { projectId },
    });

    // If requesting primary language or no translations, return as-is
    if (!translation || translation.primaryLanguage === language) {
      return {
        project,
        language,
        direction: this.getLanguageDirection(language),
      };
    }

    // Get translations for each block
    const slideTranslations = await this.prisma.slideTranslation.findMany({
      where: {
        slideId: { in: project.slides.map((s) => s.id) },
        language,
      },
    });

    const translationMap = new Map(
      slideTranslations.map((t) => [
        `${t.slideId}_${t.blockId}`,
        t.translatedContent,
      ]),
    );

    // Apply translations
    const translatedSlides = project.slides.map((slide) => ({
      ...slide,
      blocks: slide.blocks.map((block) => {
        const translated = translationMap.get(`${slide.id}_${block.id}`);
        return translated ? { ...block, content: translated } : block;
      }),
    }));

    return {
      project: { ...project, slides: translatedSlides },
      language,
      direction: this.getLanguageDirection(language),
    };
  }

  /**
   * Update translation for a specific block
   */
  async updateBlockTranslation(
    projectId: string,
    slideId: string,
    blockId: string,
    language: LanguageCode,
    translatedContent: Prisma.InputJsonValue,
    userId: string,
  ): Promise<{ success: boolean }> {
    const block = await this.prisma.block.findFirst({
      where: {
        id: blockId,
        slideId,
        project: { id: projectId, ownerId: userId },
      },
    });

    if (!block) {
      throw new NotFoundException('Block not found');
    }

    const projectTranslation = await this.prisma.projectTranslation.findUnique({
      where: { projectId },
    });

    if (!projectTranslation) {
      throw new NotFoundException('Project translation not found');
    }

    await this.prisma.slideTranslation.upsert({
      where: {
        slideId_blockId_language: {
          slideId,
          blockId,
          language,
        },
      },
      create: {
        projectTranslationId: projectTranslation.id,
        slideId,
        blockId,
        language,
        translations: {},

        translatedContent: translatedContent as unknown as string,
        isManuallyEdited: true,
      },
      update: {
        translatedContent: translatedContent as unknown as string,
        isManuallyEdited: true,
      },
    });

    return { success: true };
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text: string): Promise<{
    language: LanguageCode;
    confidence: number;
  }> {
    try {
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'Detect the language of the given text. Respond with JSON: {"language": "ISO 639-1 code", "confidence": 0-1}',
          },
          { role: 'user', content: text },
        ],
        temperature: 0,
        max_tokens: 50,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(
        response.choices[0]?.message?.content || '{}',
      ) as { language?: string; confidence?: number };
      return {
        language: (result.language as LanguageCode) || 'en',
        confidence: result.confidence || 0,
      };
    } catch (error) {
      this.logger.error('Language detection failed:', error);
      return { language: 'en', confidence: 0 };
    }
  }

  /**
   * Get translation job status
   */
  async getJobStatus(jobId: string): Promise<TranslationJob | null> {
    const job = await this.prisma.translationJob.findUnique({
      where: { id: jobId },
    });

    if (!job) return null;

    return {
      id: job.id,
      projectId: job.projectId,
      targetLanguage: job.targetLanguage as LanguageCode,
      status: job.status as TranslationJob['status'],
      progress: job.progress,
      totalBlocks: job.totalBlocks,
      translatedBlocks: job.translatedBlocks,
      startedAt: job.startedAt || undefined,
      completedAt: job.completedAt || undefined,
      error: job.error || undefined,
    };
  }

  /**
   * Get translation progress for a project
   */
  async getTranslationProgress(
    projectId: string,
  ): Promise<ProjectTranslation | null> {
    const translation = await this.prisma.projectTranslation.findUnique({
      where: { projectId },
    });

    if (!translation) return null;

    return {
      id: translation.id,
      projectId: translation.projectId,
      primaryLanguage: translation.primaryLanguage as LanguageCode,
      availableLanguages: translation.availableLanguages as LanguageCode[],

      translationProgress: translation.translationProgress as unknown as Record<
        LanguageCode,
        {
          totalBlocks: number;
          translatedBlocks: number;
          percentage: number;
        }
      >,
      updatedAt: translation.updatedAt,
    };
  }

  // Private methods
  private async processTranslationJob(
    jobId: string,
    project: Project & { slides: (Slide & { blocks: Block[] })[] },
    targetLanguage: LanguageCode,
    sourceLanguage: LanguageCode,
  ) {
    try {
      await this.prisma.translationJob.update({
        where: { id: jobId },
        data: { status: 'in-progress', startedAt: new Date() },
      });

      let translatedBlocks = 0;
      const totalBlocks: number = project.slides.reduce(
        //
        (acc: number, s) => acc + s.blocks.length,
        0,
      );

      const slides = project.slides;

      for (const slide of slides) {
        const blocks = slide.blocks;

        for (const block of blocks) {
          try {
            await this.translateBlock(
              block,
              sourceLanguage,
              targetLanguage,
              //
              project.id,
            );
            translatedBlocks++;

            // Update progress
            await this.prisma.translationJob.update({
              where: { id: jobId },
              data: {
                translatedBlocks,
                progress: Math.round((translatedBlocks / totalBlocks) * 100),
              },
            });
          } catch (error: unknown) {
            //
            this.logger.error(`Failed to translate block ${block.id}:`, error);
          }
        }
      }

      // Update project translation
      await this.prisma.projectTranslation.update({
        where: { projectId: project.id },
        data: {
          targetLanguages: {
            push: targetLanguage,
          },
          translationProgress: {
            [targetLanguage]: {
              totalBlocks,
              translatedBlocks,
              percentage: Math.round((translatedBlocks / totalBlocks) * 100),
            },
          },
        },
      });

      await this.prisma.translationJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          progress: 100,
        },
      });
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Translation job ${jobId} failed:`, err);
      await this.prisma.translationJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          error: err.message,
        },
      });
    }
  }

  private async translateBlock(
    block: Block,
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
    projectId: string,
  ): Promise<void> {
    const textBlockTypes = [
      'HEADING',
      'SUBHEADING',
      'PARAGRAPH',
      'BULLET_LIST',
      'NUMBERED_LIST',
      'QUOTE',
    ];

    if (!textBlockTypes.includes(block.blockType)) {
      return;
    }

    //
    const content = block.content as unknown;
    const textToTranslate = this.extractTextFromContent(content);

    if (!textToTranslate || textToTranslate.length < 2) {
      return;
    }

    const sourceLang =
      this.supportedLanguages.find((l) => l.code === sourceLanguage)?.name ||
      'English';
    const targetLang =
      this.supportedLanguages.find((l) => l.code === targetLanguage)?.name ||
      'Spanish';

    try {
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following text from ${sourceLang} to ${targetLang}. 
            Maintain the same tone and style. If it's a list, keep the list format.
            Return only the translated text, nothing else.`,
          },
          { role: 'user', content: textToTranslate },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const translatedText =
        response.choices[0]?.message?.content?.trim() || textToTranslate;

      const translatedContent = this.applyTranslatedText(
        content,

        block.blockType,
        translatedText,
      );

      const projectTranslation =
        await this.prisma.projectTranslation.findUnique({
          where: { projectId },
        });

      if (!projectTranslation) {
        throw new NotFoundException('Project translation not found');
      }

      await this.prisma.slideTranslation.upsert({
        where: {
          slideId_blockId_language: {
            slideId: block.slideId || '',
            blockId: block.id,
            language: targetLanguage,
          },
        },
        create: {
          projectTranslationId: projectTranslation.id,
          slideId: block.slideId || '',
          blockId: block.id,
          language: targetLanguage,

          translations: {},
          translatedContent: translatedContent as unknown as string,
          isManuallyEdited: false,
        },
        update: {
          translations: {},
          translatedContent: translatedContent as unknown as string,
        },
      });
    } catch (error) {
      //
      this.logger.error(`Translation failed for block ${block.id}:`, error);
      throw error;
    }
  }

  private extractTextFromContent(content: unknown): string {
    if (typeof content === 'string') return content;
    if (typeof content === 'object' && content !== null) {
      const record = content as Record<string, unknown>;
      if ('text' in record && typeof record.text === 'string')
        return record.text;
      if ('content' in record && typeof record.content === 'string')
        return record.content;
      if ('items' in record && Array.isArray(record.items))
        return record.items.join('\n');
    }
    return '';
  }

  private applyTranslatedText(
    content: unknown,
    blockType: string,
    translatedText: string,
  ): Prisma.InputJsonValue {
    if (typeof content === 'string') return translatedText;
    if (typeof content === 'object' && content !== null) {
      const record = content as Record<string, unknown>;
      if ('text' in record) return { ...record, text: translatedText };
      if ('content' in record) return { ...record, content: translatedText };
      if ('items' in record && Array.isArray(record.items)) {
        return {
          ...record,
          items: translatedText.split('\n').filter(Boolean),
        };
      }
    }
    return { ...(content as object), text: translatedText };
  }

  private getLanguageDirection(code: LanguageCode): 'ltr' | 'rtl' {
    const lang = this.supportedLanguages.find((l) => l.code === code);
    return lang?.direction || 'ltr';
  }
}
