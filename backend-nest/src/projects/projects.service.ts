import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  Inject,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AIService, GeneratedPresentation } from '../ai/ai.service';
import { materializeGeneratedBlocks } from '../ai/presentation-block-mapper';
import { recipeForSlideIndex, isGenericKicker } from '../ai/slide-recipes';
import { ThinkingAgentOrchestratorService } from '../ai/thinking-agent/thinking-agent-orchestrator.service';
import { ThinkingProjectService } from '../ai/thinking-agent/thinking-project.service';
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
    @Optional()
    @Inject(forwardRef(() => ThinkingAgentOrchestratorService))
    private readonly thinkingOrchestrator?: ThinkingAgentOrchestratorService,
    @Optional()
    @Inject(forwardRef(() => ThinkingProjectService))
    private readonly thinkingProjectService?: ThinkingProjectService,
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

    // Add to queue. Keep completed jobs so the dashboard can poll status
    // (global removeOnComplete:true used to delete them immediately).
    const job = await this.generationQueue.add(
      'generate',
      {
        userId,
        dto: generateDto,
      },
      {
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: { age: 86400, count: 50 },
      },
    );

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
      // Completed jobs are eventually evicted from Redis. The project is
      // already in the DB, so tell the client to stop polling instead of 404.
      return {
        id: jobId,
        state: 'not_found',
        result: undefined,
        failedReason: undefined,
      };
    }

    // Verify ownership
    if (job.data.userId !== userId) {
      throw new ForbiddenException('You cannot access this job');
    }

    const state = await job.getState();
    const result = job.returnvalue;

    return {
      id: job.id,
      state,
      result,
      failedReason: job.failedReason,
    };
  }

  /**
   * Process the generation (called by Worker)
   */
  async processGeneration(userId: string, generateDto: GenerateProjectDto) {
    this.logger.log(`Processing generation for user ${userId}`);

    const length = generateDto.length ?? 10;
    const generateImages = generateDto.generateImages !== false;
    const imageSource = generateDto.imageSource || 'stock';

    if (
      generateDto.qualityMode &&
      this.thinkingOrchestrator &&
      this.thinkingProjectService
    ) {
      const thinking = await this.thinkingOrchestrator.generateWithThinking({
        topic: generateDto.topic,
        tone: generateDto.tone,
        audience: generateDto.audience,
        length,
        type: 'presentation',
        generateImages,
        qualityLevel: 'high',
        maxThinkingIterations: 2,
        enableQualityRefinement: true,
      });
      const created =
        await this.thinkingProjectService.createProjectFromThinkingResult(
          userId,
          thinking.presentation,
          {
            title: thinking.presentation.title,
            audience: generateDto.audience,
            tone: generateDto.tone,
            generateImages,
            qualityScore: thinking.qualityReport?.overallScore,
          },
        );
      await this.usersService.incrementAIGenerations(userId);
      return this.findOne(created.projectId, userId);
    }

    const generatedContent = await this.aiService.generatePresentation({
      topic: generateDto.topic,
      tone: generateDto.tone,
      audience: generateDto.audience,
      length,
      type: generateDto.type,
      designStyle: generateDto.designStyle,
      generateImages,
      imageSource,
      qualityMode: generateDto.qualityMode,
    });

    if (generateImages) {
      this.logger.log(`Generating images for project ${generateDto.topic}...`);

      let images = new Map<number, { imageUrl: string }>();

      if (imageSource === 'ai') {
        images = await this.aiService.generatePresentationImages(
          generatedContent.sections,
        );
      } else {
        images = await this.aiService.generateStockImages(
          generatedContent.sections,
        );
      }

      generatedContent.sections.forEach((section, index) => {
        const imageResult = images.get(index);
        if (!imageResult?.imageUrl) return;
        const imageBlock = section.blocks.find(
          (b) => b.type.toLowerCase() === 'image',
        );
        if (imageBlock) {
          if (
            !imageBlock.embedUrl ||
            !/^https?:\/\//i.test(imageBlock.embedUrl)
          ) {
            imageBlock.embedUrl = imageResult.imageUrl;
          }
          if (!/^https?:\/\//i.test(imageBlock.content)) {
            imageBlock.content = imageResult.imageUrl;
          }
        } else {
          section.blocks.unshift({
            type: 'image',
            content: imageResult.imageUrl,
            embedUrl: imageResult.imageUrl,
          });
        }
      });
    }

    const project = await this.createFromAIContent(
      userId,
      generatedContent,
      generateDto,
    );

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
    const themeTokens = this.getDesignTokens(designStyle);
    const defaultTheme = await this.prisma.theme.findFirst({
      where: { isDefault: true },
    });

    const generatedTheme = await this.prisma.theme.create({
      data: {
        name: `${designStyle} generated`,
        description: `Auto theme for ${generateDto.topic}`.slice(0, 180),
        userId,
        isDefault: false,
        colors: {
          primary: themeTokens.accentColor,
          secondary: themeTokens.subheadingColor,
          accent: themeTokens.accentColor,
          background:
            designStyle === GenerationDesignStyle.MANIFESTO
              ? '#FAFAFA'
              : '#FFFFFF',
          surface: themeTokens.softSurface,
          text: themeTokens.bodyColor,
          textMuted: themeTokens.subheadingColor,
        } as Prisma.InputJsonValue,
        fonts: {
          heading: themeTokens.headingFont,
          body: themeTokens.bodyFont,
        } as Prisma.InputJsonValue,
        spacing:
          (defaultTheme?.spacing as Prisma.InputJsonValue) ||
          ({ base: 8, scale: 1.25 } as Prisma.InputJsonValue),
      },
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
        themeId: generatedTheme.id,
      },
    });

    for (
      let slideIndex = 0;
      slideIndex < content.sections.length;
      slideIndex++
    ) {
      const section = content.sections[slideIndex];
      const recipe = recipeForSlideIndex(
        slideIndex,
        content.sections.length,
      );

      const slideLayout = this.selectPolishedLayout(
        content.sections,
        slideIndex,
        designStyle,
        recipe.layout,
      );

      const slide = await this.prisma.slide.create({
        data: {
          projectId: project.id,
          order: slideIndex,
          layout: slideLayout,
          speakerNotes: section.speakerNotes || null,
        },
      });

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

      let blockOrder = 1;
      const headingText = String(section.heading || '').trim();
      const kickerText = String(section.kicker || '').trim();
      const skipTexts = new Set<string>(
        headingText ? [headingText.toLowerCase()] : [],
      );
      const useSectionKicker =
        Boolean(kickerText) &&
        !isGenericKicker(kickerText) &&
        kickerText.toLowerCase() !== headingText.toLowerCase();

      if (useSectionKicker) {
        skipTexts.add(kickerText.toLowerCase());
        await this.prisma.block.create({
          data: {
            projectId: project.id,
            slideId: slide.id,
            blockType: BlockType.SUBHEADING,
            content: { text: kickerText },
            style: { variant: 'kicker' } as Prisma.InputJsonValue,
            order: blockOrder++,
          },
        });
      }

      const mapped = materializeGeneratedBlocks(
        this.composeVisuallyBalancedBlocks(
          section.blocks,
          slideIndex,
          designStyle,
        ),
      );

      for (const mappedBlock of mapped) {
        const mappedText =
          typeof mappedBlock.content?.text === 'string'
            ? mappedBlock.content.text.trim()
            : '';
        const variant = String(mappedBlock.style?.variant || '');
        if (
          mappedText &&
          (skipTexts.has(mappedText.toLowerCase()) ||
            (variant === 'kicker' && isGenericKicker(mappedText)))
        ) {
          continue;
        }
        if (mappedText) skipTexts.add(mappedText.toLowerCase());

        const style = {
          ...this.getDefaultBlockStyle(
            mappedBlock.blockType,
            mappedBlock.blockType.toLowerCase(),
            designStyle,
          ),
          ...mappedBlock.style,
        };
        await this.prisma.block.create({
          data: {
            projectId: project.id,
            slideId: slide.id,
            blockType: mappedBlock.blockType,
            content: mappedBlock.content as Prisma.InputJsonValue,
            style: style as Prisma.InputJsonValue,
            order: blockOrder++,
          },
        });
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
      section.blocks = section.blocks.map((block) => {
        if (
          ['paragraph', 'subheading', 'quote', 'callout', 'statistic'].includes(
            block.type.toLowerCase(),
          )
        ) {
          return { ...block, content: block.content.replace(/\s+/g, ' ').trim() };
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
    _slideIndex: number,
    designStyle: GenerationDesignStyle,
  ): GeneratedPresentation['sections'][number]['blocks'] {
    const safeBlocks = blocks
      .filter((b) => {
        const hasText =
          typeof b.content === 'string' && b.content.trim().length > 0;
        const hasItems = Array.isArray(b.items) && b.items.length > 0;
        const hasStat = Boolean(b.value || b.label);
        const hasMedia = Boolean(b.embedUrl);
        return hasText || hasItems || hasStat || hasMedia;
      })
      .map((b) => ({
        ...b,
        content: typeof b.content === 'string' ? b.content.trim() : b.content,
      }));

    const nonBulletBlocks = safeBlocks.filter((b) => {
      const t = b.type.toLowerCase();
      return t !== 'bullet' && t !== 'bullet-list' && t !== 'numbered-list';
    });
    const bulletBlocks = safeBlocks.filter((b) => {
      const t = b.type.toLowerCase();
      return t === 'bullet' || t === 'bullet-list' || t === 'numbered-list';
    });

    const composed: GeneratedPresentation['sections'][number]['blocks'] = [
      ...nonBulletBlocks,
      ...bulletBlocks,
    ];

    const maxBlocks = designStyle === GenerationDesignStyle.MANIFESTO ? 8 : 8;
    const minBlocks = 2;
    const deduped: GeneratedPresentation['sections'][number]['blocks'] = [];
    const seen = new Set<string>();
    for (const block of composed) {
      const key = `${block.type}:${block.content.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(block);
      if (deduped.length >= maxBlocks) break;
    }

    return deduped.slice(0, Math.max(minBlocks, deduped.length));
  }

  private selectPolishedLayout(
    sections: GeneratedPresentation['sections'],
    index: number,
    designStyle: GenerationDesignStyle,
    recipeLayout?: string,
  ): string {
    if (index === 0) {
      const opening = sections[0].layout;
      if (
        opening === 'title-hero' ||
        opening === 'title-subtitle' ||
        opening === 'image-full'
      ) {
        return opening;
      }
      return recipeLayout || 'title-hero';
    }

    if (recipeLayout) {
      const prev = index > 0 ? sections[index - 1].layout : '';
      const prev2 = index > 1 ? sections[index - 2].layout : '';
      if (recipeLayout !== prev || recipeLayout !== prev2) {
        return recipeLayout;
      }
    }

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
            'three-column',
            'image-right',
            'stats-grid',
            'comparison',
            'timeline',
            'image-left',
            'bento-grid',
          ];

    const aiLayout = sections[index].layout || recipeLayout || 'title-content';
    const prev = index > 0 ? sections[index - 1].layout : '';
    const prev2 = index > 1 ? sections[index - 2].layout : '';

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
      headingFont: 'Source Serif 4',
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
