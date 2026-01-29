import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateSlideDto {
  projectId: string;
  order: number;
  layout?: string;
}

interface UpdateSlideDto {
  layout?: string;
  order?: number;
}

interface ReorderSlidesDto {
  slides: Array<{ id: string; order: number }>;
}

@Injectable()
export class SlidesService {
  private readonly logger = new Logger(SlidesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new slide
   */
  async create(userId: string, createSlideDto: CreateSlideDto) {
    // Verify project ownership
    const project = await this.prisma.project.findUnique({
      where: { id: createSlideDto.projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException('You cannot edit this project');
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
      throw new ForbiddenException('You cannot edit this slide');
    }

    const updated = await this.prisma.slide.update({
      where: { id: slideId },
      data: {
        layout: updateSlideDto.layout,
        order: updateSlideDto.order,
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
      throw new ForbiddenException('You cannot delete this slide');
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
   * Reorder slides within a project
   */
  async reorder(
    userId: string,
    projectId: string,
    reorderDto: ReorderSlidesDto,
  ) {
    // Verify project ownership
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException('You cannot edit this project');
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
      throw new ForbiddenException('You cannot edit this slide');
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

    // Create new slide
    const newSlide = await this.prisma.slide.create({
      data: {
        projectId: slide.projectId,
        order: slide.order + 1,
        layout: slide.layout,
      },
    });

    // Duplicate blocks
    for (const block of slide.blocks) {
      await this.prisma.block.create({
        data: {
          projectId: slide.projectId,
          slideId: newSlide.id,
          blockType: block.blockType,
          content: block.content as any,
          style: block.style as any,
          order: block.order,
        },
      });
    }

    // Update project timestamp
    await this.prisma.project.update({
      where: { id: slide.projectId },
      data: { updatedAt: new Date() },
    });

    this.logger.log(`Slide duplicated: ${slideId} -> ${newSlide.id}`);

    return this.findOne(newSlide.id);
  }
}
