import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AIService, GeneratedPresentation } from '../ai/ai.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { GenerateProjectDto, GenerationType } from './dto/generate-project.dto';
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
    @InjectQueue('generation') private readonly generationQueue: Queue,
  ) { }

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

    // Create first empty slide for presentations
    if (project.type === ProjectType.PRESENTATION) {
      await this.prisma.slide.create({
        data: {
          projectId: project.id,
          order: 0,
          layout: 'title',
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
      generateImages: generateDto.generateImages,
      imageSource: generateDto.imageSource,
    });

    // If requested, generate images for the presentation
    if (generateDto.generateImages && generateDto.imageSource === 'ai') {
      this.logger.log(`Generating images for project ${generateDto.topic}...`);
      const images = await this.aiService.generatePresentationImages(
        generatedContent.sections,
      );

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

      const slide = await this.prisma.slide.create({
        data: {
          projectId: project.id,
          order: slideIndex,
          layout: slideIndex === 0 ? 'title' : 'content',
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
          order: 0,
        },
      });

      // Create content blocks - group consecutive bullets into lists
      let blockOrder = 1;
      let i = 0;

      while (i < section.blocks.length) {
        const block = section.blocks[i];
        const blockType = this.mapBlockType(block.type);

        // Check if this is a bullet or numbered list item
        if (
          blockType === BlockType.BULLET_LIST ||
          blockType === BlockType.NUMBERED_LIST
        ) {
          // Collect all consecutive list items of the same type
          const items: string[] = [];
          const currentType = blockType;

          while (
            i < section.blocks.length &&
            this.mapBlockType(section.blocks[i].type) === currentType
          ) {
            items.push(section.blocks[i].content);
            i++;
          }

          // Create a single list block with all items
          await this.prisma.block.create({
            data: {
              projectId: project.id,
              slideId: slide.id,
              blockType: currentType,
              content: { items },
              order: blockOrder++,
            },
          });
        } else {
          // Create regular block
          const content =
            blockType === BlockType.IMAGE
              ? { url: block.content, alt: 'AI Generated Image' }
              : { text: block.content };

          await this.prisma.block.create({
            data: {
              projectId: project.id,
              slideId: slide.id,
              blockType,
              content,
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
      code: BlockType.CODE,
      quote: BlockType.QUOTE,
    };

    return typeMap[type.toLowerCase()] || BlockType.PARAGRAPH;
  }

  /**
   * Get all projects for a user
   */
  async findAll(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          ownerId: userId,
          deletedAt: null, // Soft delete filter
        },
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
      this.prisma.project.count({
        where: { ownerId: userId },
      }),
    ]);

    return {
      data: projects,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
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
      generateDto as any,
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
