import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CollaborationService } from '../collaboration/collaboration.service';

interface CreateSlideDto {
  projectId: string;
  order: number;
  layout?: string;
  title?: string;
}

interface UpdateSlideDto {
  layout?: string;
  order?: number;
  title?: string;
  speakerNotes?: string;
  thumbnailUrl?: string;
}

interface ReorderSlidesDto {
  slides: Array<{ id: string; order: number }>;
}

interface BulkCreateSlidesDto {
  projectId: string;
  slides: Array<{ order: number; layout?: string; title?: string }>;
}

@Injectable()
export class SlidesService {
  private readonly logger = new Logger(SlidesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly collaborationService: CollaborationService,
  ) {}

  /**
   * Create a new slide
   */
  async create(userId: string, createSlideDto: CreateSlideDto) {
    // Verify project ownership / collaborator role
    const project = await this.prisma.project.findUnique({
      where: { id: createSlideDto.projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId) {
      const role = await this.collaborationService.getUserRole(
        createSlideDto.projectId,
        userId,
      );
      if (role !== 'EDITOR') {
        throw new ForbiddenException('You cannot edit this project');
      }
    }

    // Shift existing slides if inserting in middle
    await this.prisma.slide.updateMany({
      where: {
        projectId: createSlideDto.projectId,
        order: { gte: createSlideDto.order },
      },
      data: {
        order: { increment: 1 },
      },
    });

    const slide = await this.prisma.slide.create({
      data: {
        projectId: createSlideDto.projectId,
        order: createSlideDto.order,
        layout: createSlideDto.layout || 'default',
      },
      include: {
        blocks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    // Update project timestamp
    await this.prisma.project.update({
      where: { id: createSlideDto.projectId },
      data: { updatedAt: new Date() },
    });

    this.logger.log(`Slide created: ${slide.id}`);

    return slide;
  }

  /**
   * Get a single slide with blocks
   */
  async findOne(slideId: string) {
    const slide = await this.prisma.slide.findUnique({
      where: { id: slideId },
      include: {
        blocks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!slide) {
      throw new NotFoundException('Slide not found');
    }

    return slide;
  }

  /**
   * Get all slides for a project
   */
  async findByProject(projectId: string) {
    return this.prisma.slide.findMany({
      where: { projectId },
      include: {
        blocks: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Update a slide
   */
  async update(
    userId: string,
    slideId: string,
    updateSlideDto: UpdateSlideDto,
  ) {
    const slide = await this.prisma.slide.findUnique({
      where: { id: slideId },
      include: { project: true },
    });

    if (!slide) {
      throw new NotFoundException('Slide not found');
    }

    if (slide.project.ownerId !== userId) {
      const role = await this.collaborationService.getUserRole(
        slide.projectId,
        userId,
      );
      if (role !== 'EDITOR') {
        throw new ForbiddenException('You cannot edit this slide');
      }
    }

    const updated = await this.prisma.slide.update({
      where: { id: slideId },
      data: {
        layout: updateSlideDto.layout,
        order: updateSlideDto.order,
        title: updateSlideDto.title,
        thumbnailUrl: updateSlideDto.thumbnailUrl,
      },
      include: {
        blocks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    // Update project timestamp
    await this.prisma.project.update({
      where: { id: slide.projectId },
      data: { updatedAt: new Date() },
    });

    return updated;
  }

  /**
   * Delete a slide and its blocks
   */
  async remove(userId: string, slideId: string) {
    const slide = await this.prisma.slide.findUnique({
      where: { id: slideId },
      include: { project: true },
    });

    if (!slide) {
      throw new NotFoundException('Slide not found');
    }

    if (slide.project.ownerId !== userId) {
      const role = await this.collaborationService.getUserRole(
        slide.projectId,
        userId,
      );
      if (role !== 'EDITOR') {
        throw new ForbiddenException('You cannot delete this slide');
      }
    }

    // Delete the slide (blocks are cascade deleted)
    await this.prisma.slide.delete({
      where: { id: slideId },
    });

    // Reorder remaining slides
    await this.prisma.slide.updateMany({
      where: {
        projectId: slide.projectId,
        order: { gt: slide.order },
      },
      data: {
        order: { decrement: 1 },
      },
    });

    // Update project timestamp
    await this.prisma.project.update({
      where: { id: slide.projectId },
      data: { updatedAt: new Date() },
    });

    this.logger.log(`Slide deleted: ${slideId}`);

    return { success: true };
  }

  /**
   * Bulk create multiple slides at once (optimized for AI-generated presentations)
   */
  async bulkCreate(userId: string, dto: BulkCreateSlidesDto) {
    if (dto.slides.length === 0) {
      throw new BadRequestException('At least one slide is required');
    }
    if (dto.slides.length > 100) {
      throw new BadRequestException(
        'Cannot create more than 100 slides at once',
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) throw new NotFoundException('Project not found');

    if (project.ownerId !== userId) {
      const role = await this.collaborationService.getUserRole(
        dto.projectId,
        userId,
      );
      if (role !== 'EDITOR')
        throw new ForbiddenException('You cannot edit this project');
    }

    const created = await this.prisma.$transaction(
      dto.slides.map((s) =>
        this.prisma.slide.create({
          data: {
            projectId: dto.projectId,
            order: s.order,
            layout: s.layout || 'default',
            title: s.title,
          },
        }),
      ),
    );

    await this.prisma.project.update({
      where: { id: dto.projectId },
      data: { updatedAt: new Date() },
    });

    this.logger.log(
      `Bulk created ${created.length} slides for project ${dto.projectId}`,
    );
    return created;
  }

  /**
   * Get slide statistics for a project (layout breakdown, avg blocks per slide)
   */
  async getProjectSlideStats(projectId: string) {
    const slides = await this.prisma.slide.findMany({
      where: { projectId },
      include: { _count: { select: { blocks: true } } },
    });

    if (slides.length === 0)
      return { totalSlides: 0, avgBlocksPerSlide: 0, layoutBreakdown: {} };

    const layoutBreakdown = slides.reduce(
      (acc, s) => {
        const l = s.layout || 'default';
        acc[l] = (acc[l] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalBlocks = slides.reduce((sum, s) => sum + s._count.blocks, 0);
    const avgBlocksPerSlide =
      Math.round((totalBlocks / slides.length) * 10) / 10;

    return { totalSlides: slides.length, avgBlocksPerSlide, layoutBreakdown };
  }

  /**
   * Reorder slides within a project
   */
  async reorder(
    userId: string,
    projectId: string,
    reorderDto: ReorderSlidesDto,
  ) {
    // Verify project ownership or editor role
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId) {
      const role = await this.collaborationService.getUserRole(
        projectId,
        userId,
      );
      if (role !== 'EDITOR') {
        throw new ForbiddenException('You cannot edit this project');
      }
    }

    // Validate that all slide IDs belong to this project
    const slideIds = reorderDto.slides.map((s) => s.id);
    const existingSlides = await this.prisma.slide.findMany({
      where: { id: { in: slideIds }, projectId },
      select: { id: true },
    });

    if (existingSlides.length !== slideIds.length) {
      throw new ForbiddenException('Invalid slide IDs provided');
    }

    // Update all slide orders in a transaction
    await this.prisma.$transaction(
      reorderDto.slides.map((slide) =>
        this.prisma.slide.update({
          where: { id: slide.id },
          data: { order: slide.order },
        }),
      ),
    );

    // Update project timestamp
    await this.prisma.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    return { success: true };
  }

  /**
   * Duplicate a slide with all its blocks
   */
  async duplicate(userId: string, slideId: string) {
    const slide = await this.prisma.slide.findUnique({
      where: { id: slideId },
      include: {
        project: true,
        blocks: true,
      },
    });

    if (!slide) {
      throw new NotFoundException('Slide not found');
    }

    if (slide.project.ownerId !== userId) {
      const role = await this.collaborationService.getUserRole(
        slide.projectId,
        userId,
      );
      if (role !== 'EDITOR') {
        throw new ForbiddenException('You cannot edit this slide');
      }
    }

    // Shift slides after the duplicated one
    await this.prisma.slide.updateMany({
      where: {
        projectId: slide.projectId,
        order: { gt: slide.order },
      },
      data: {
        order: { increment: 1 },
      },
    });

    // Use transaction for atomic slide duplication
    const newSlide = await this.prisma.$transaction(async (tx) => {
      // Create new slide
      const createdSlide = await tx.slide.create({
        data: {
          projectId: slide.projectId,
          order: slide.order + 1,
          layout: slide.layout,
        },
      });

      // Duplicate blocks atomically using createMany
      if (slide.blocks.length > 0) {
        await tx.block.createMany({
          data: slide.blocks.map((block) => ({
            projectId: slide.projectId,
            slideId: createdSlide.id,
            blockType: block.blockType,
            content: block.content as Prisma.InputJsonValue,
            style: block.style as Prisma.InputJsonValue,
            order: block.order,
          })),
        });
      }

      return createdSlide;
    });

    // Update project timestamp
    await this.prisma.project.update({
      where: { id: slide.projectId },
      data: { updatedAt: new Date() },
    });

    this.logger.log(`Slide duplicated: ${slideId} -> ${newSlide.id}`);

    return this.findOne(newSlide.id);
  }
}
