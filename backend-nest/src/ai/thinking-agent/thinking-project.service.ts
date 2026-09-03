import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, PrismaClient } from '@prisma/client';
import { EnhancedPresentation, EnhancedSection } from './thinking-agent.types';
import { AIService } from '../ai.service';
import { enhancedToPresentationDocument } from '../agents/enhanced-to-dsl.mapper';
import { mapGeneratedBlock } from '../presentation-block-mapper';
import { recipeForSlideIndex } from '../slide-recipes';
import type {
  PresentationDocument,
  SlideBlock,
} from '@shared/presentation-dsl';

interface CreateProjectFromThinkingResult {
  projectId: string;
  slideCount: number;
  blockCount: number;
  dslDocument: PresentationDocument;
}

type DraftBlock = {
  type: string;
  content: Record<string, unknown>;
  style: Record<string, unknown>;
  isGeneratedImage?: boolean;
  generationPrompt?: string;
  generationStyle?: 'vivid' | 'natural';
};

@Injectable()
export class ThinkingProjectService {
  private readonly logger = new Logger(ThinkingProjectService.name);
  private readonly db: PrismaClient;

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => AIService))
    private aiService: AIService,
    @InjectQueue('image-generation') private imageQueue: Queue,
  ) {
    this.db = this.prisma;
  }

  /**
   * Create a project from the thinking agent's generated presentation
   */
  async createProjectFromThinkingResult(
    userId: string,
    presentation: EnhancedPresentation,
    options?: {
      title?: string;
      description?: string;
      themeId?: string;
      generateImages?: boolean;
      audience?: string;
      tone?: string;
      qualityScore?: number;
    },
  ): Promise<CreateProjectFromThinkingResult> {
    this.logger.log(`Creating project from thinking result for user ${userId}`);

    const imageGenerationJobs: Array<{
      blockId: string;
      prompt: string;
      style: 'vivid' | 'natural';
    }> = [];

    // Create the project with slides and blocks in a transaction
    const result = await this.db.$transaction(async (tx) => {
      let themeId = options?.themeId || null;
      if (!themeId) {
        const generatedTheme = await tx.theme.create({
          data: {
            name: 'Editorial generated',
            description: `Thinking theme for ${presentation.title}`.slice(
              0,
              180,
            ),
            userId,
            isDefault: false,
            colors: {
              primary: '#0F172A',
              secondary: '#1E293B',
              accent: '#0284C7',
              background: '#FFFFFF',
              surface: '#F0F9FF',
              text: '#1F2937',
              textMuted: '#64748B',
            },
            fonts: {
              heading: 'Source Serif 4',
              body: 'Source Sans 3',
            },
            spacing: { base: 8, scale: 1.25 },
          },
        });
        themeId = generatedTheme.id;
      }

      // 1. Create the project
      const project = await tx.project.create({
        data: {
          title: options?.title || presentation.title,
          description: options?.description || presentation.metadata.summary,
          type: 'PRESENTATION',
          status: 'DRAFT',
          ownerId: userId,
          themeId,
          tone: options?.tone,
          audience: options?.audience,
        },
      });

      // Map thinking output → DSL document (pin/partial regen path)
      const dslDocument = enhancedToPresentationDocument(presentation, {
        documentId: project.id,
        audience: options?.audience,
        tone: options?.tone,
        qualityScore: options?.qualityScore,
      });

      await tx.project.update({
        where: { id: project.id },
        data: {
          dslDocument: dslDocument as unknown as Prisma.InputJsonValue,
        },
      });

      let totalBlockCount = 0;
      const dslSlides = dslDocument.sections.flatMap((s) => s.slides);

      // Materialize relational slides/blocks FROM DSL so zones + presets survive
      for (let slideIndex = 0; slideIndex < dslSlides.length; slideIndex++) {
        const dslSlide = dslSlides[slideIndex];
        const section = presentation.sections[slideIndex];

        const recipe = recipeForSlideIndex(slideIndex, dslSlides.length);
        const slide = await tx.slide.create({
          data: {
            projectId: project.id,
            order: slideIndex,
            layout:
              dslSlide.layout?.preset ||
              (section?.layout
                ? this.mapLayoutType(section.layout)
                : recipe.layout),
            speakerNotes:
              dslSlide.speakerNotes || section?.speakerNotes || null,
          },
        });

        for (
          let blockIndex = 0;
          blockIndex < dslSlide.blocks.length;
          blockIndex++
        ) {
          const dslBlock = dslSlide.blocks[blockIndex];
          const style = this.styleFromDslBlock(dslBlock);
          const mapped = mapGeneratedBlock(
            {
              type:
                dslBlock.kind === 'comparison-row'
                  ? 'comparison'
                  : dslBlock.kind === 'timeline-item'
                    ? 'timeline'
                    : dslBlock.kind === 'statistic'
                      ? 'statistic'
                      : dslBlock.kind,
              content: String(
                dslBlock.content?.text ||
                  dslBlock.content?.url ||
                  dslBlock.content?.value ||
                  '',
              ),
              items: Array.isArray(dslBlock.content?.items)
                ? dslBlock.content.items.map((item) => String(item))
                : undefined,
              value:
                typeof dslBlock.content?.value === 'string'
                  ? dslBlock.content.value
                  : undefined,
              label:
                typeof dslBlock.content?.label === 'string'
                  ? dslBlock.content.label
                  : undefined,
              embedUrl:
                typeof dslBlock.content?.url === 'string'
                  ? dslBlock.content.url
                  : undefined,
            },
            String(
              (dslBlock.style as Record<string, unknown> | undefined)?.variant,
            ) === 'kicker'
              ? { variant: 'kicker' }
              : undefined,
          );

          // Mark empty AI image placeholders for generation queue
          const isGeneratedImage =
            Boolean(options?.generateImages) &&
            dslBlock.kind === 'image' &&
            !dslBlock.content?.url &&
            Boolean(dslBlock.content?.generationPrompt);

          if (isGeneratedImage) {
            style.status = 'generating';
          }

          if (!mapped && !isGeneratedImage) {
            continue;
          }

          const createdBlock = await tx.block.create({
            data: {
              projectId: project.id,
              slideId: slide.id,
              blockType:
                mapped?.blockType || this.mapToBlockType(dslBlock.kind),
              content: {
                ...(mapped?.content || dslBlock.content || {}),
                ...(isGeneratedImage ? { status: 'generating' } : {}),
              } as Prisma.InputJsonValue,
              style: {
                ...style,
                ...(mapped?.style || {}),
              } as Prisma.InputJsonValue,
              order: dslBlock.order ?? blockIndex,
            },
          });
          totalBlockCount++;

          if (isGeneratedImage) {
            const prompt = String(dslBlock.content?.generationPrompt || '');
            const genStyle =
              section?.suggestedImage?.style === 'natural'
                ? 'natural'
                : 'vivid';
            imageGenerationJobs.push({
              blockId: createdBlock.id,
              prompt,
              style: genStyle,
            });
          }
        }
      }

      return {
        projectId: project.id,
        slideCount: dslSlides.length,
        blockCount: totalBlockCount,
        dslDocument,
      };
    });

    // Queue image generation jobs
    if (imageGenerationJobs.length > 0) {
      this.logger.log(
        `Queueing ${imageGenerationJobs.length} image generation jobs`,
      );
      await Promise.all(
        imageGenerationJobs.map((job) =>
          this.imageQueue.add('generate-image', job, {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
          }),
        ),
      );
    }

    this.logger.log(
      `Created project ${result.projectId} with ${result.slideCount} slides and ${result.blockCount} blocks`,
    );

    return result;
  }

  /**
   * Convert a section to an array of blocks
   */
  private convertSectionToBlocks(
    section: EnhancedSection,
    slideIndex: number,
  ): DraftBlock[] {
    const blocks: DraftBlock[] = [];

    // Add heading block
    blocks.push({
      type: 'heading',
      content: {
        text: section.heading,
      },
      style: {
        textAlign: 'center',
        fontSize: slideIndex === 0 ? '48px' : '36px',
      },
    });

    // Add subheading if present
    if (section.subheading) {
      blocks.push({
        type: 'subheading',
        content: {
          text: section.subheading,
        },
        style: {
          textAlign: 'center',
          fontSize: '24px',
          color: '#666',
        },
      });
    }

    // Convert section blocks
    for (const sectionBlock of section.blocks) {
      const blockType = this.mapBlockType(String(sectionBlock.type));
      const blockContent = this.buildBlockContent(sectionBlock);
      const blockStyle = this.buildBlockStyle(sectionBlock);

      blocks.push({
        type: blockType,
        content: blockContent,
        style: blockStyle,
      });
    }

    // Add speaker notes as a special block if present
    if (section.speakerNotes) {
      blocks.push({
        type: 'paragraph',
        content: {
          text: section.speakerNotes,
          isSpeakerNote: true,
        },
        style: {
          display: 'none', // Speaker notes hidden by default
          backgroundColor: '#fff9c4',
          padding: '8px',
        },
      });
    }

    return blocks;
  }

  /**
   * Map thinking agent block type to database block type
   */
  private mapBlockType(type: string): string {
    const typeMap: Record<string, string> = {
      heading: 'heading',
      subheading: 'subheading',
      text: 'paragraph',
      paragraph: 'paragraph',
      bullets: 'bullet',
      'bullet-list': 'bullet',
      bullet: 'bullet',
      numbered: 'bullet',
      'numbered-list': 'bullet',
      quote: 'quote',
      code: 'paragraph',
      image: 'image',
      table: 'paragraph',
      divider: 'paragraph',
      embed: 'embed',
      statistic: 'statistic',
      chart: 'chart',
      callout: 'callout',
      'timeline-item': 'timeline-item',
      'comparison-item': 'comparison-item',
    };

    return typeMap[type.toLowerCase()] || 'paragraph';
  }

  /**
   * Map string type to Prisma BlockType enum
   */
  private mapToBlockType(
    type: string,
  ):
    | 'HEADING'
    | 'SUBHEADING'
    | 'PARAGRAPH'
    | 'BULLET_LIST'
    | 'NUMBERED_LIST'
    | 'IMAGE'
    | 'CODE'
    | 'QUOTE'
    | 'DIVIDER'
    | 'TABLE'
    | 'EMBED'
    | 'CHART'
    | 'VIDEO'
    | 'AUDIO'
    | 'TIMELINE'
    | 'COMPARISON'
    | 'STATS_GRID'
    | 'CALL_TO_ACTION' {
    const typeMap: Record<
      string,
      | 'HEADING'
      | 'SUBHEADING'
      | 'PARAGRAPH'
      | 'BULLET_LIST'
      | 'NUMBERED_LIST'
      | 'IMAGE'
      | 'CODE'
      | 'QUOTE'
      | 'DIVIDER'
      | 'TABLE'
      | 'EMBED'
      | 'CHART'
      | 'VIDEO'
      | 'AUDIO'
      | 'TIMELINE'
      | 'COMPARISON'
      | 'STATS_GRID'
      | 'CALL_TO_ACTION'
    > = {
      heading: 'HEADING',
      subheading: 'SUBHEADING',
      text: 'PARAGRAPH',
      paragraph: 'PARAGRAPH',
      bullets: 'BULLET_LIST',
      'bullet-list': 'BULLET_LIST',
      bullet: 'BULLET_LIST',
      numbered: 'NUMBERED_LIST',
      'numbered-list': 'NUMBERED_LIST',
      quote: 'QUOTE',
      code: 'CODE',
      image: 'IMAGE',
      table: 'TABLE',
      divider: 'DIVIDER',
      embed: 'EMBED',
      statistic: 'STATS_GRID',
      'stats-grid': 'STATS_GRID',
      chart: 'CHART',
      video: 'VIDEO',
      audio: 'AUDIO',
      callout: 'QUOTE',
      timeline: 'TIMELINE',
      'timeline-item': 'TIMELINE',
      comparison: 'COMPARISON',
      'comparison-item': 'COMPARISON',
      kicker: 'SUBHEADING',
      cta: 'CALL_TO_ACTION',
      'call-to-action': 'CALL_TO_ACTION',
    };

    return typeMap[type.toLowerCase()] || 'PARAGRAPH';
  }

  /**
   * Map layout type to a standardized layout name (DSL presets preferred)
   */
  private mapLayoutType(layout: string): string {
    const layoutMap: Record<string, string> = {
      'title-slide': 'title-hero',
      title: 'title-hero',
      'content-slide': 'single-column',
      content: 'single-column',
      'two-column': 'two-column',
      twocolumn: 'two-column',
      'three-column': 'three-column',
      'image-left': 'image-left',
      imageleft: 'image-left',
      'image-right': 'image-right',
      imageright: 'image-right',
      'full-image': 'image-full',
      fullimage: 'image-full',
      full: 'image-full',
      comparison: 'comparison',
      timeline: 'timeline',
      quote: 'quote-centered',
      chart: 'chart-focus',
      stats: 'stats-grid',
      grid: 'bento-grid',
      list: 'single-column',
    };

    return layoutMap[layout?.toLowerCase()] || layout || 'single-column';
  }

  /** Persist DSL style + zone onto relational Block.style JSON */
  private styleFromDslBlock(block: SlideBlock): Record<string, unknown> {
    return {
      ...(block.style || {}),
      ...(typeof block.zone === 'number' ? { zone: block.zone } : {}),
    };
  }

  /**
   * Build block content from section block
   */
  private buildBlockContent(
    sectionBlock: EnhancedSection['blocks'][0],
  ): Record<string, unknown> {
    const content: Record<string, unknown> = {};
    const blockType = String(sectionBlock.type).toLowerCase();

    // Handle text content
    if (typeof sectionBlock.content === 'string') {
      content.text = sectionBlock.content;
    }

    // Handle array content (for lists)
    if (Array.isArray(sectionBlock.content)) {
      content.items = sectionBlock.content;
    }

    // Handle bullet-list type
    if (
      blockType === 'bullets' ||
      blockType === 'bullet-list' ||
      blockType === 'bullet'
    ) {
      if (typeof sectionBlock.content === 'string') {
        // Split by newlines or bullet points
        content.items = sectionBlock.content
          .split(/\n|•|‣/)
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
      }
    }

    // Handle numbered list
    if (blockType === 'numbered' || blockType === 'numbered-list') {
      if (typeof sectionBlock.content === 'string') {
        content.items = sectionBlock.content
          .split(/\n|\d+\./)
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
      }
    }

    // Handle code blocks
    if (blockType === 'code') {
      content.code = sectionBlock.content;
      content.language =
        (sectionBlock.formatting as Record<string, unknown>)?.language ||
        'plaintext';
    }

    // Handle quotes
    if (blockType === 'quote') {
      content.text = sectionBlock.content;
      content.author = (
        sectionBlock.formatting as Record<string, unknown>
      )?.author;
    }

    // Handle charts
    if (blockType === 'chart' && sectionBlock.chartData) {
      content.chartData = sectionBlock.chartData;
    }

    return content;
  }

  /**
   * Build block style from section block formatting
   */
  private buildBlockStyle(
    sectionBlock: EnhancedSection['blocks'][0],
  ): Record<string, unknown> {
    const style: Record<string, unknown> = {};
    const formatting = sectionBlock.formatting;

    if (formatting) {
      if (formatting.alignment) {
        style.textAlign = formatting.alignment;
      }
      if (formatting.bold) {
        style.fontWeight = 'bold';
      }
      if (formatting.size) {
        style.fontSize = formatting.size;
      }
      if (formatting.color) {
        style.color = formatting.color;
      }
      if (formatting.variant) {
        style.variant = formatting.variant;
      }
    }

    return style;
  }

  /**
   * Get project with full details including slides and blocks
   */
  getProjectWithDetails(projectId: string) {
    return this.db.project.findUnique({
      where: { id: projectId },
      include: {
        slides: {
          orderBy: { order: 'asc' },
          include: {
            blocks: {
              orderBy: { order: 'asc' },
            },
          },
        },
        theme: true,
      },
    });
  }
}
