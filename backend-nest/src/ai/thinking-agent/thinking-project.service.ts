import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, PrismaClient } from '@prisma/client';
import { EnhancedPresentation, EnhancedSection } from './thinking-agent.types';
import { AIService } from '../ai.service';

interface CreateProjectFromThinkingResult {
  projectId: string;
  slideCount: number;
  blockCount: number;
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
    this.db = this.prisma as unknown as PrismaClient;
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
      // 1. Create the project
      const project = await tx.project.create({
        data: {
          title: options?.title || presentation.title,
          description: options?.description || presentation.metadata.summary,
          type: 'PRESENTATION',
          status: 'DRAFT',
          ownerId: userId,
          themeId: options?.themeId || null,
        },
      });

      let totalBlockCount = 0;

      // 2. Create slides from sections
      for (
        let slideIndex = 0;
        slideIndex < presentation.sections.length;
        slideIndex++
      ) {
        const section = presentation.sections[slideIndex];

        const slide = await tx.slide.create({
          data: {
            projectId: project.id,
            order: slideIndex,
            layout: this.mapLayoutType(section.layout),
          },
        });

        // 3. Create blocks for this slide
        const blocks = this.convertSectionToBlocks(section, slideIndex);

        // Prepare generated image placeholder if requested
        if (options?.generateImages && section.suggestedImage) {
          // Insert after heading/subheading (index 1 or 2)
          let insertIndex = 0;
          if (blocks.length > 0 && blocks[0].type === 'heading') insertIndex++;
          if (blocks.length > 1 && blocks[1].type === 'subheading')
            insertIndex++;

          const generatedImageBlock: DraftBlock = {
            type: 'image',
            content: {
              url: '', // Placeholder
              alt: section.suggestedImage.prompt,
              status: 'generating',
            },
            style: { width: '100%', borderRadius: '8px' },
            isGeneratedImage: true,
            generationPrompt: section.suggestedImage.prompt,
            generationStyle:
              section.suggestedImage.style === 'natural' ? 'natural' : 'vivid',
          };
          blocks.splice(insertIndex, 0, generatedImageBlock);
        }

        for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
          const block = blocks[blockIndex];
          const createdBlock = await tx.block.create({
            data: {
              projectId: project.id,
              slideId: slide.id,
              blockType: this.mapToBlockType(block.type),
              content: block.content as Prisma.InputJsonValue,
              style: block.style as Prisma.InputJsonValue,
              order: blockIndex,
            },
          });
          totalBlockCount++;

          // Collect job info if this was our placeholder
          if (block.isGeneratedImage) {
            imageGenerationJobs.push({
              blockId: createdBlock.id,
              prompt: block.generationPrompt || '',
              style: block.generationStyle || 'vivid',
            });
          }
        }
      }

      return {
        projectId: project.id,
        slideCount: presentation.sections.length,
        blockCount: totalBlockCount,
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
      chart: 'CHART',
      video: 'VIDEO',
      audio: 'AUDIO',
      callout: 'QUOTE',
      'timeline-item': 'TIMELINE',
      'comparison-item': 'COMPARISON',
      cta: 'CALL_TO_ACTION',
    };

    return typeMap[type.toLowerCase()] || 'PARAGRAPH';
  }

  /**
   * Map layout type to a standardized layout name
   */
  private mapLayoutType(layout: string): string {
    const layoutMap: Record<string, string> = {
      'title-slide': 'title',
      'content-slide': 'content',
      'two-column': 'twoColumn',
      'image-left': 'imageLeft',
      'image-right': 'imageRight',
      'full-image': 'fullImage',
      comparison: 'comparison',
      timeline: 'timeline',
      quote: 'quote',
    };

    return layoutMap[layout?.toLowerCase()] || layout || 'content';
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
