import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AIService, GeneratedPresentation } from '../ai/ai.service';
import { SlidesService } from '../slides/slides.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import {
  GenerateProjectDto,
  GenerationDesignStyle,
  GenerationType,
} from './dto/generate-project.dto';
import { ProjectType, BlockType, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly aiService: AIService,
    private readonly slidesService: SlidesService,
    @InjectQueue('generation') private readonly generationQueue: Queue,
  ) {}

  /**
   * Create a new empty project
   */
  async create(userId: string, createProjectDto: CreateProjectDto) {
    // Check if user can create more projects
    const canCreate = await this.usersService.canCreateProject(userId);
    if (!canCreate) {
      throw new ForbiddenException(
        'Project limit reached. Upgrade to create more projects.',
      );
    }

    const project = await this.prisma.project.create({
      data: {
        title: createProjectDto.title,
        description: createProjectDto.description,
        type: createProjectDto.type || ProjectType.PRESENTATION,
        ownerId: userId,
        shareToken: uuidv4(),
      },
      include: {
        slides: {
          include: {
            blocks: true,
          },
        },
        theme: true,
      },
    });

    // Create first slide with default content for presentations
    if (project.type === ProjectType.PRESENTATION) {
      const slide = await this.prisma.slide.create({
        data: {
          projectId: project.id,
          order: 0,
          layout: 'title',
        },
      });

      // Add default blocks for title slide
      await this.prisma.block.create({
        data: {
          projectId: project.id,
          slideId: slide.id,
          blockType: 'HEADING',
          order: 0,
          content: {
            text: project.title || 'Your Presentation Title',
          },
        },
      });

      await this.prisma.block.create({
        data: {
          projectId: project.id,
          slideId: slide.id,
          blockType: 'SUBHEADING',
          order: 1,
          content: {
            text: 'Add your subtitle here',
          },
        },
      });
    }

    this.logger.log(`Project created: ${project.id} by user ${userId}`);

    return this.findOne(project.id, userId);
  }

  /**
   * Generate a new project using AI
   */
  async generate(userId: string, generateDto: GenerateProjectDto) {
    // Check if user can generate AI content
    const canGenerate = await this.usersService.canGenerateAI(userId);
    if (!canGenerate) {
      throw new ForbiddenException(
        'AI generation limit reached. Upgrade for unlimited generations.',
      );
    }

    // Check if user can create more projects
    const canCreate = await this.usersService.canCreateProject(userId);
    if (!canCreate) {
      throw new ForbiddenException(
        'Project limit reached. Upgrade to create more projects.',
      );
    }

    // Add to queue
    const job = await this.generationQueue.add('generate', {
      userId,
      dto: generateDto,
    });

    this.logger.log(`Project generation queued: ${job.id} for user ${userId}`);

    // Return job ID so frontend can poll
    return {
      status: 'queued',
      jobId: job.id,
      message: 'Project generation started in background',
    };
  }

  /**
   * Get generation job status
   */
  async getGenerationStatus(jobId: string, userId: string) {
    const job = await this.generationQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Verify ownership
    if (job.data.userId !== userId) {
      throw new ForbiddenException('You cannot access this job');
    }

    const state = await job.getState();
    const result = job.returnvalue;
    // const progress = job.progress;

    return {
      id: job.id,
      state,
      // progress,
      result, // This will be the project object if completed
      failedReason: job.failedReason,
    };
  }

  /**
   * Process the generation (called by Worker)
   */
  async processGeneration(userId: string, generateDto: GenerateProjectDto) {
    this.logger.log(`Processing generation for user ${userId}`);

    // Generate content using AI
    const generatedContent = await this.aiService.generatePresentation({
      topic: generateDto.topic,
      tone: generateDto.tone,
      audience: generateDto.audience,
      length: generateDto.length,
      type: generateDto.type,
      designStyle: generateDto.designStyle,
      generateImages: generateDto.generateImages,
      imageSource: generateDto.imageSource,
    });

    // If requested, generate images for the presentation
    if (generateDto.generateImages) {
      this.logger.log(`Generating images for project ${generateDto.topic}...`);

      const source = generateDto.imageSource || 'ai';
      let images = new Map<number, { imageUrl: string }>();

      if (source === 'ai') {
        images = await this.aiService.generatePresentationImages(
          generatedContent.sections,
        );
      } else if (source === 'stock') {
        images = await this.aiService.generateStockImages(
          generatedContent.sections,
        );
      }

      // Add image blocks to sections where images were generated
      generatedContent.sections.forEach((section, index) => {
        if (images.has(index)) {
          const imageResult = images.get(index);
          if (imageResult) {
            // Add image block at the beginning of content blocks (after heading)
            section.blocks.unshift({
              type: 'image',
              content: imageResult.imageUrl,
              embedUrl: imageResult.imageUrl,
            });
          }
        }
      });
    }

    // Create project with generated content
    const project = await this.createFromAIContent(
      userId,
      generatedContent,
      generateDto,
    );

    // Increment AI generations used
    await this.usersService.incrementAIGenerations(userId);

    this.logger.log(
      `Project generated via AI: ${project.id} by user ${userId}`,
    );

    return project;
  }

  /**
   * Create project from AI-generated content
   */
  private async createFromAIContent(
    userId: string,
    content: GeneratedPresentation,
    generateDto: GenerateProjectDto,
  ) {
    this.applyDesignPolish(content, generateDto.tone);
    const designStyle =
      generateDto.designStyle || GenerationDesignStyle.EDITORIAL;

    // Get the default theme
    const defaultTheme = await this.prisma.theme.findFirst({
      where: { isDefault: true },
    });

    const project = await this.prisma.project.create({
      data: {
        title: content.title,
        type:
          generateDto.type === GenerationType.DOCUMENT
            ? ProjectType.DOCUMENT
            : ProjectType.PRESENTATION,
        ownerId: userId,
        shareToken: uuidv4(),
        generatedFromPrompt: generateDto.topic,
        tone: generateDto.tone,
        audience: generateDto.audience,
        aiModel: content.aiModel,
        aiProvider: content.aiProvider,
        themeId: defaultTheme?.id, // Auto-assign default theme
      },
    });

    // Create slides and blocks from generated content
    for (
      let slideIndex = 0;
      slideIndex < content.sections.length;
      slideIndex++
    ) {
      const section = content.sections[slideIndex];

      // Use the AI-recommended layout, falling back to sensible defaults
      const slideLayout = this.selectPolishedLayout(
        content.sections,
        slideIndex,
        designStyle,
      );

      const slide = await this.prisma.slide.create({
        data: {
          projectId: project.id,
          order: slideIndex,
          layout: slideLayout,
          speakerNotes: section.speakerNotes || null,
        },
      });

      // Create heading block
      await this.prisma.block.create({
        data: {
          projectId: project.id,
          slideId: slide.id,
          blockType:
            slideIndex === 0 ? BlockType.HEADING : BlockType.SUBHEADING,
          content: { text: section.heading },
          style: this.getHeadingStyle(
            slideIndex === 0 ? 'heading' : 'subheading',
            designStyle,
          ) as Prisma.InputJsonValue,
          order: 0,
        },
      });

      // Create content blocks - group consecutive bullets into lists
      const sectionBlocks = this.composeVisuallyBalancedBlocks(
        section.blocks,
        slideIndex,
        designStyle,
      );
      let blockOrder = 1;
      let i = 0;

      while (i < sectionBlocks.length) {
        const block = sectionBlocks[i];
        const aiType = block.type?.toLowerCase() || 'paragraph';
        const blockType = this.mapBlockType(aiType);

        // Check if this is a bullet or numbered list item
        if (
          blockType === BlockType.BULLET_LIST ||
          blockType === BlockType.NUMBERED_LIST
        ) {
          // Collect all consecutive list items of the same type
          const items: string[] = [];
          const currentType = blockType;

          while (
            i < sectionBlocks.length &&
            this.mapBlockType(sectionBlocks[i].type) === currentType
          ) {
            items.push(sectionBlocks[i].content);
            i++;
          }

          // Create a single list block with all items
          await this.prisma.block.create({
            data: {
              projectId: project.id,
              slideId: slide.id,
              blockType: currentType,
              content: { items },
              style: this.getListStyle(
                currentType,
                designStyle,
              ) as Prisma.InputJsonValue,
              order: blockOrder++,
            },
          });
        } else {
          // Determine content and formatting based on original AI type
          let blockContent: Record<string, unknown>;
          let blockStyle: Record<string, unknown> | undefined;

          if (blockType === BlockType.IMAGE) {
            blockContent = { url: block.content, alt: 'AI Generated Image' };
          } else if (aiType === 'chart' && block.chartData) {
            // Chart block with embedded data
            blockContent = {
              text: block.content,
              chartData: block.chartData,
            };
          } else if (aiType === 'card') {
            // Card-style paragraph with special formatting
            blockContent = { text: block.content };
            blockStyle = { variant: 'card' };
          } else if (aiType === 'icon-text') {
            // Icon-text style paragraph
            blockContent = { text: block.content };
            blockStyle = { variant: 'icon-text' };
          } else if (
            aiType === 'timeline' ||
            aiType === 'comparison' ||
            aiType === 'stats-grid'
          ) {
            // These types use pipe-separated content as list items
            const items = block.content
              .split('|')
              .map((s: string) => s.trim())
              .filter((s: string) => s.length > 0);
            blockContent = { items };
          } else if (aiType === 'call-to-action') {
            // CTA block - just text
            blockContent = { text: block.content };
          } else {
            blockContent = { text: block.content };
          }

          if (!blockStyle) {
            blockStyle = this.getDefaultBlockStyle(
              blockType,
              aiType,
              designStyle,
            );
          }

          await this.prisma.block.create({
            data: {
              projectId: project.id,
              slideId: slide.id,
              blockType,
              content: blockContent as Prisma.InputJsonValue,
              ...(blockStyle
                ? { style: blockStyle as Prisma.InputJsonValue }
                : {}),
              order: blockOrder++,
            },
          });
          i++;
        }
      }
    }

    return this.findOne(project.id, userId);
  }

  /**
   * Map AI block type to Prisma BlockType
   * Rich AI types (card, icon-text) are mapped to PARAGRAPH with formatting set upstream
   */
  private mapBlockType(type: string): BlockType {
    const typeMap: Record<string, BlockType> = {
      heading: BlockType.HEADING,
      subheading: BlockType.SUBHEADING,
      paragraph: BlockType.PARAGRAPH,
      bullet: BlockType.BULLET_LIST,
      'bullet-list': BlockType.BULLET_LIST,
      numbered: BlockType.NUMBERED_LIST,
      'numbered-list': BlockType.NUMBERED_LIST,
      image: BlockType.IMAGE,
      'image-placeholder': BlockType.IMAGE,
      code: BlockType.CODE,
      quote: BlockType.QUOTE,
      divider: BlockType.DIVIDER,
      table: BlockType.TABLE,
      chart: BlockType.CHART,
      // Advanced visual block types
      timeline: BlockType.TIMELINE,
      comparison: BlockType.COMPARISON,
      'stats-grid': BlockType.STATS_GRID,
      'call-to-action': BlockType.CALL_TO_ACTION,
      // Rich visual types mapped to PARAGRAPH - formatting variant is set in createFromAIContent
      card: BlockType.PARAGRAPH,
      'icon-text': BlockType.PARAGRAPH,
    };

    return typeMap[type.toLowerCase()] || BlockType.PARAGRAPH;
  }

  private applyDesignPolish(
    content: GeneratedPresentation,
    tone?: string,
  ): void {
    const needsFormalTone =
      !!tone &&
      ['professional', 'formal', 'corporate', 'executive'].includes(
        tone.toLowerCase(),
      );

    for (const section of content.sections) {
      // Reduce wall-of-text effect for readability.
      section.blocks = section.blocks.map((block) => {
        if (
          ['paragraph', 'subheading', 'quote', 'callout', 'statistic'].includes(
            block.type.toLowerCase(),
          )
        ) {
          const cleaned = block.content.replace(/\s+/g, ' ').trim();
          const short =
            cleaned.length > 260
              ? `${cleaned.slice(0, 257).trim()}...`
              : cleaned;
          return { ...block, content: short };
        }
        return block;
      });

      if (needsFormalTone) {
        // Remove decorative emojis for formal decks.
        section.heading = section.heading
          .replace(/([\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}])/gu, '')
          .trim();
      }
    }
  }

  private composeVisuallyBalancedBlocks(
    blocks: GeneratedPresentation['sections'][number]['blocks'],
    slideIndex: number,
    designStyle: GenerationDesignStyle,
  ): GeneratedPresentation['sections'][number]['blocks'] {
    const safeBlocks = blocks
      .filter(
        (b) => typeof b.content === 'string' && b.content.trim().length > 0,
      )
      .map((b) => ({ ...b, content: b.content.trim() }));

    const nonBulletBlocks = safeBlocks.filter((b) => {
      const t = b.type.toLowerCase();
      return t !== 'bullet' && t !== 'bullet-list' && t !== 'numbered-list';
    });
    const bulletBlocks = safeBlocks.filter((b) => {
      const t = b.type.toLowerCase();
      return t === 'bullet' || t === 'bullet-list' || t === 'numbered-list';
    });

    const composed: GeneratedPresentation['sections'][number]['blocks'] = [];

    // 1) Keep one framing paragraph/subheading early if available.
    const framing = nonBulletBlocks.find((b) =>
      ['subheading', 'paragraph'].includes(b.type.toLowerCase()),
    );
    if (framing) composed.push(framing);

    // 2) Keep one high-emphasis block for visual anchor.
    const emphasis = nonBulletBlocks.find((b) =>
      [
        'quote',
        'callout',
        'statistic',
        'chart',
        'comparison',
        'timeline',
      ].includes(b.type.toLowerCase()),
    );
    if (emphasis && !composed.includes(emphasis)) composed.push(emphasis);

    // 3) Add a compact bullet block if we have lists.
    if (bulletBlocks.length > 0) {
      const chosenList = bulletBlocks[0];
      composed.push(chosenList);
    }

    // 4) Fill remaining with diverse non-duplicate types.
    for (const block of nonBulletBlocks) {
      if (composed.length >= 5) break;
      if (composed.includes(block)) continue;
      const hasTypeAlready = composed.some(
        (b) => b.type.toLowerCase() === block.type.toLowerCase(),
      );
      if (
        hasTypeAlready &&
        ['paragraph', 'subheading'].includes(block.type.toLowerCase())
      ) {
        continue;
      }
      composed.push(block);
    }

    // 5) If still too plain, inject a designed callout block.
    const hasVisualAnchor = composed.some((b) =>
      [
        'quote',
        'callout',
        'statistic',
        'chart',
        'comparison',
        'timeline',
      ].includes(b.type.toLowerCase()),
    );
    if (!hasVisualAnchor && composed.length > 0) {
      composed.splice(1, 0, {
        type: 'callout',
        content:
          slideIndex === 0
            ? 'Why this matters now: clear outcome and audience value.'
            : 'Key takeaway: focus on one decisive insight before moving on.',
      });
    }

    // 6) Enforce clean range with style-specific density.
    const maxBlocks = designStyle === GenerationDesignStyle.MANIFESTO ? 4 : 6;
    const minBlocks = designStyle === GenerationDesignStyle.MANIFESTO ? 2 : 3;
    const deduped: GeneratedPresentation['sections'][number]['blocks'] = [];
    const seen = new Set<string>();
    for (const block of composed) {
      const key = `${block.type}:${block.content.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(block);
      if (deduped.length >= maxBlocks) break;
    }

    return deduped.slice(
      0,
      Math.max(minBlocks, Math.min(maxBlocks, deduped.length)),
    );
  }

  private selectPolishedLayout(
    sections: GeneratedPresentation['sections'],
    index: number,
    designStyle: GenerationDesignStyle,
  ): string {
    if (index === 0) return 'title';

    const fallbackSequence =
      designStyle === GenerationDesignStyle.MANIFESTO
        ? [
            'title-content',
            'quote-highlight',
            'image-full',
            'comparison',
            'image-right',
            'title-content',
            'quote-highlight',
          ]
        : [
            'title-content',
            'two-column',
            'image-right',
            'comparison',
            'three-column',
            'chart-focus',
            'quote-highlight',
          ];

    const aiLayout = sections[index].layout || 'title-content';
    const prev = index > 0 ? sections[index - 1].layout : '';
    const prev2 = index > 1 ? sections[index - 2].layout : '';

    // If AI repeats same layout 3rd time in a row, rotate to a varied fallback.
    if (aiLayout === prev && aiLayout === prev2) {
      return fallbackSequence[index % fallbackSequence.length];
    }

    return aiLayout;
  }

  private getHeadingStyle(
    kind: 'heading' | 'subheading',
    designStyle: GenerationDesignStyle,
  ): Record<string, unknown> {
    const styleTokens = this.getDesignTokens(designStyle);
    if (kind === 'heading') {
      return {
        fontFamily: styleTokens.headingFont,
        fontSize:
          designStyle === GenerationDesignStyle.BOLD
            ? 50
            : designStyle === GenerationDesignStyle.MANIFESTO
              ? 54
              : 46,
        fontWeight: 700,
        lineHeight: 1.12,
        color: styleTokens.headingColor,
        letterSpacing: -0.3,
      };
    }

    return {
      fontFamily: styleTokens.headingFont,
      fontSize: 28,
      fontWeight: 600,
      lineHeight: 1.2,
      color: styleTokens.subheadingColor,
      letterSpacing: -0.1,
    };
  }

  private getListStyle(
    blockType: BlockType,
    designStyle: GenerationDesignStyle,
  ): Record<string, unknown> {
    const styleTokens = this.getDesignTokens(designStyle);
    return {
      fontFamily: styleTokens.bodyFont,
      fontSize: 22,
      lineHeight: 1.4,
      color: styleTokens.bodyColor,
      marker:
        blockType === BlockType.NUMBERED_LIST ? 'numeric-accent' : 'dot-accent',
      spacing: 10,
      markerColor: styleTokens.accentColor,
    };
  }

  private getDefaultBlockStyle(
    blockType: BlockType,
    aiType: string,
    designStyle: GenerationDesignStyle,
  ): Record<string, unknown> {
    const styleTokens = this.getDesignTokens(designStyle);
    if (blockType === BlockType.QUOTE) {
      return {
        variant: 'quote-accent',
        fontFamily: styleTokens.quoteFont,
        fontSize: 24,
        lineHeight: 1.35,
        color: styleTokens.headingColor,
        borderLeftColor: styleTokens.accentColor,
        backgroundColor: styleTokens.softSurface,
        padding: 16,
      };
    }

    if (blockType === BlockType.CHART || aiType === 'statistic') {
      return {
        variant: 'data-emphasis',
        titleColor: styleTokens.headingColor,
        accentColor: styleTokens.accentColor,
        gridColor: styleTokens.gridColor,
        numberWeight: 700,
      };
    }

    if (aiType === 'callout' || aiType === 'call-to-action') {
      return {
        variant: 'callout',
        fontFamily: styleTokens.bodyFont,
        fontSize: designStyle === GenerationDesignStyle.MANIFESTO ? 24 : 22,
        color: styleTokens.headingColor,
        backgroundColor: styleTokens.softSurface,
        borderColor: styleTokens.accentColor,
        borderRadius: 12,
        padding: 16,
      };
    }

    return {
      fontFamily: styleTokens.bodyFont,
      fontSize: 21,
      lineHeight: 1.42,
      color: styleTokens.bodyColor,
      maxWidth: '88%',
    };
  }

  private getDesignTokens(designStyle: GenerationDesignStyle): {
    headingFont: string;
    bodyFont: string;
    quoteFont: string;
    headingColor: string;
    subheadingColor: string;
    bodyColor: string;
    accentColor: string;
    softSurface: string;
    gridColor: string;
  } {
    if (designStyle === GenerationDesignStyle.EXECUTIVE) {
      return {
        headingFont: 'IBM Plex Sans',
        bodyFont: 'IBM Plex Sans',
        quoteFont: 'IBM Plex Serif',
        headingColor: '#0B1F3A',
        subheadingColor: '#1D3557',
        bodyColor: '#1F2937',
        accentColor: '#0A84FF',
        softSurface: '#EEF6FF',
        gridColor: '#DCEAFB',
      };
    }

    if (designStyle === GenerationDesignStyle.BOLD) {
      return {
        headingFont: 'Space Grotesk',
        bodyFont: 'Manrope',
        quoteFont: 'Fraunces',
        headingColor: '#111827',
        subheadingColor: '#1F2937',
        bodyColor: '#111827',
        accentColor: '#F97316',
        softSurface: '#FFF7ED',
        gridColor: '#FFEDD5',
      };
    }

    if (designStyle === GenerationDesignStyle.MANIFESTO) {
      return {
        headingFont: 'Archivo Black',
        bodyFont: 'Sora',
        quoteFont: 'Merriweather',
        headingColor: '#0A0A0A',
        subheadingColor: '#171717',
        bodyColor: '#262626',
        accentColor: '#DC2626',
        softSurface: '#FAFAFA',
        gridColor: '#E5E5E5',
      };
    }

    return {
      headingFont: 'Poppins',
      bodyFont: 'Source Sans 3',
      quoteFont: 'Lora',
      headingColor: '#0F172A',
      subheadingColor: '#1E293B',
      bodyColor: '#1F2937',
      accentColor: '#0284C7',
      softSurface: '#F0F9FF',
      gridColor: '#E2E8F0',
    };
  }

  /**
   * Get all projects for a user with optional search and filtering
   */
  async findAll(
    userId: string,
    page = 1,
    limit = 20,
    options?: { search?: string; archived?: boolean },
  ) {
    const skip = (page - 1) * limit;
    const { search, archived = false } = options || {};

    const where: Prisma.ProjectWhereInput = {
      ownerId: userId,
      deletedAt: archived ? { not: null } : null,
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: {
          theme: true,
          _count: {
            select: {
              slides: true,
              blocks: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: projects,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get a single project by ID
   */
  async findOne(id: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        slides: {
          include: {
            blocks: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
        theme: true,
        owner: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check access
    if (!project.isPublic && project.ownerId !== userId) {
      // Check if user is a collaborator
      const collaborator = await this.prisma.projectCollaborator.findUnique({
        where: {
          projectId_userId: {
            projectId: id,
            userId: userId,
          },
        },
      });

      if (!collaborator) {
        throw new ForbiddenException('You do not have access to this project');
      }
    }

    return project;
  }

  /**
   * Get project by share token (public access)
   */
  async findByShareToken(shareToken: string) {
    const project = await this.prisma.project.findUnique({
      where: { shareToken },
      include: {
        slides: {
          include: {
            blocks: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
        theme: true,
        owner: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!project.isPublic) {
      throw new ForbiddenException('This project is not public');
    }

    return project;
  }

  /**
   * Update a project
   */
  async update(id: string, userId: string, updateProjectDto: UpdateProjectDto) {
    const project = await this.findOne(id, userId);

    if (project.ownerId !== userId) {
      throw new ForbiddenException('You cannot edit this project');
    }

    return this.prisma.project.update({
      where: { id },
      data: {
        title: updateProjectDto.title,
        description: updateProjectDto.description,
        status: updateProjectDto.status,
        isPublic: updateProjectDto.isPublic,
        themeId: updateProjectDto.themeId,
        ...(updateProjectDto.dslDocument
          ? {
              dslDocument:
                updateProjectDto.dslDocument as unknown as import('@prisma/client').Prisma.InputJsonValue,
            }
          : {}),
      },
      include: {
        slides: {
          include: {
            blocks: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
        theme: true,
      },
    });
  }

  /**
   * Get the persisted DSL PresentationDocument for a project.
   */
  async getDslDocument(id: string, userId: string) {
    const project = await this.findOne(id, userId);
    return {
      projectId: project.id,
      dslDocument: (project as { dslDocument?: unknown }).dslDocument ?? null,
    };
  }

  /**
   * Replace the persisted DSL PresentationDocument (editMemory / pins).
   */
  async saveDslDocument(
    id: string,
    userId: string,
    dslDocument: Record<string, unknown>,
  ) {
    const project = await this.findOne(id, userId);

    if (project.ownerId !== userId) {
      throw new ForbiddenException('You cannot edit this project');
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        dslDocument:
          dslDocument as unknown as import('@prisma/client').Prisma.InputJsonValue,
        title:
          typeof dslDocument.title === 'string' ? dslDocument.title : undefined,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        dslDocument: true,
      },
    });

    return updated;
  }

  /**
   * Archive a project (soft-delete with archived flag)
   */
  async archive(id: string, userId: string) {
    const project = await this.findOne(id, userId);

    if (project.ownerId !== userId) {
      throw new ForbiddenException('You cannot archive this project');
    }

    await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Project archived: ${id} by user ${userId}`);
    return { success: true, message: 'Project archived successfully' };
  }

  /**
   * Restore an archived project
   */
  async restore(id: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId)
      throw new ForbiddenException('You cannot restore this project');

    // Check project limits before restoring
    const canCreate = await this.usersService.canCreateProject(userId);
    if (!canCreate) {
      throw new ForbiddenException(
        'Project limit reached. Upgrade to restore projects.',
      );
    }

    await this.prisma.project.update({
      where: { id },
      data: { deletedAt: null },
    });

    this.logger.log(`Project restored: ${id} by user ${userId}`);
    return { success: true, message: 'Project restored successfully' };
  }

  /**
   * Get project statistics (slide count, block types breakdown, last edited)
   */
  async getStats(id: string, userId: string) {
    await this.findOne(id, userId); // ensure access

    const [slideCount, blockCounts] = await Promise.all([
      this.prisma.slide.count({ where: { projectId: id } }),
      this.prisma.block.groupBy({
        by: ['blockType'],
        where: { projectId: id },
        _count: { blockType: true },
      }),
    ]);

    const blockBreakdown = blockCounts.reduce(
      (acc, row) => ({ ...acc, [row.blockType]: row._count.blockType }),
      {} as Record<string, number>,
    );

    const totalBlocks = Object.values(blockBreakdown).reduce(
      (s: number, n: number) => s + n,
      0,
    );

    return {
      slideCount,
      totalBlocks,
      blockBreakdown,
    };
  }

  /**
   * Delete a project
   */
  async remove(id: string, userId: string) {
    const project = await this.findOne(id, userId);

    if (project.ownerId !== userId) {
      throw new ForbiddenException('You cannot delete this project');
    }

    await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Project deleted: ${id} by user ${userId}`);

    return { success: true };
  }

  /**
   * Duplicate a project
   */
  async duplicate(id: string, userId: string) {
    const project = await this.findOne(id, userId);

    // Check if user can create more projects
    const canCreate = await this.usersService.canCreateProject(userId);
    if (!canCreate) {
      throw new ForbiddenException(
        'Project limit reached. Upgrade to create more projects.',
      );
    }

    // Create new project
    const newProject = await this.prisma.project.create({
      data: {
        title: `${project.title} (Copy)`,
        description: project.description,
        type: project.type,
        ownerId: userId,
        themeId: project.themeId,
        shareToken: uuidv4(),
      },
    });

    // Duplicate slides and blocks
    for (const slide of project.slides) {
      const newSlide = await this.prisma.slide.create({
        data: {
          projectId: newProject.id,
          order: slide.order,
          layout: slide.layout,
        },
      });

      for (const block of slide.blocks) {
        await this.prisma.block.create({
          data: {
            projectId: newProject.id,
            slideId: newSlide.id,
            blockType: block.blockType,
            content: block.content as Prisma.InputJsonValue,
            style: block.style as Prisma.InputJsonValue,
            order: block.order,
          },
        });
      }
    }

    this.logger.log(`Project duplicated: ${id} -> ${newProject.id}`);

    return this.findOne(newProject.id, userId);
  }

  /**
   * Create project from AI-generated presentation (public API for data imports)
   */
  async createProjectFromAI(
    userId: string,
    presentation: GeneratedPresentation,
    metadata?: Record<string, unknown>,
  ) {
    // Create a minimal GenerateProjectDto
    const generateDto = {
      topic: presentation.title,
      tone: 'professional',
      audience: 'general',
      length: presentation.sections.length,
      type: 'presentation' as const,
    };

    const project = await this.createFromAIContent(
      userId,
      presentation,
      generateDto as unknown as GenerateProjectDto,
    );

    // Update project with additional metadata if provided
    if (metadata && project) {
      await this.prisma.project.update({
        where: { id: project.id },
        data: {
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    }

    return project;
  }
}
