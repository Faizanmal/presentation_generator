import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockType } from '@prisma/client';

interface CreateBlockDto {
  projectId: string;
  slideId?: string;
  blockType: BlockType;
  content: any;
  order: number;
  style?: any;
}

interface UpdateBlockDto {
  content?: any;
  order?: number;
  style?: any;
  blockType?: BlockType;
}

interface ReorderBlocksDto {
  blocks: Array<{ id: string; order: number }>;
}

@Injectable()
export class BlocksService {
  private readonly logger = new Logger(BlocksService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new block
   */
  async create(userId: string, createBlockDto: CreateBlockDto) {
    // Verify project ownership
    const project = await this.prisma.project.findUnique({
      where: { id: createBlockDto.projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException('You cannot edit this project');
    }

    const block = await this.prisma.block.create({
      data: {
        projectId: createBlockDto.projectId,
        slideId: createBlockDto.slideId,
        blockType: createBlockDto.blockType,
        content: createBlockDto.content,
        order: createBlockDto.order,
        style: createBlockDto.style,
      },
    });

    // Update project timestamp
    await this.prisma.project.update({
      where: { id: createBlockDto.projectId },
      data: { updatedAt: new Date() },
    });

    this.logger.log(`Block created: ${block.id}`);

    return block;
  }

  /**
   * Get all blocks for a slide
   */
  async findBySlide(slideId: string) {
    return this.prisma.block.findMany({
      where: { slideId },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Get all blocks for a project
   */
  async findByProject(projectId: string) {
    return this.prisma.block.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Update a block
   */
  async update(
    userId: string,
    blockId: string,
    updateBlockDto: UpdateBlockDto,
  ) {
    const block = await this.prisma.block.findUnique({
      where: { id: blockId },
      include: { project: true },
    });

    if (!block) {
      throw new NotFoundException('Block not found');
    }

    if (block.project.ownerId !== userId) {
      throw new ForbiddenException('You cannot edit this block');
    }

    const updated = await this.prisma.block.update({
      where: { id: blockId },
      data: {
        content: updateBlockDto.content,
        order: updateBlockDto.order,
        style: updateBlockDto.style,
        blockType: updateBlockDto.blockType,
      },
    });

    // Update project timestamp
    await this.prisma.project.update({
      where: { id: block.projectId },
      data: { updatedAt: new Date() },
    });

    return updated;
  }

  /**
   * Delete a block
   */
  async remove(userId: string, blockId: string) {
    const block = await this.prisma.block.findUnique({
      where: { id: blockId },
      include: { project: true },
    });

    if (!block) {
      throw new NotFoundException('Block not found');
    }

    if (block.project.ownerId !== userId) {
      throw new ForbiddenException('You cannot delete this block');
    }

    await this.prisma.block.delete({
      where: { id: blockId },
    });

    // Reorder remaining blocks
    await this.prisma.block.updateMany({
      where: {
        slideId: block.slideId,
        order: { gt: block.order },
      },
      data: {
        order: { decrement: 1 },
      },
    });

    // Update project timestamp
    await this.prisma.project.update({
      where: { id: block.projectId },
      data: { updatedAt: new Date() },
    });

    this.logger.log(`Block deleted: ${blockId}`);

    return { success: true };
  }

  /**
   * Reorder blocks within a slide
   */
  async reorder(
    userId: string,
    projectId: string,
    reorderDto: ReorderBlocksDto,
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

    // Update all block orders in a transaction
    await this.prisma.$transaction(
      reorderDto.blocks.map((block) =>
        this.prisma.block.update({
          where: { id: block.id },
          data: { order: block.order },
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
   * Batch update blocks (for auto-save)
   */
  async batchUpdate(
    userId: string,
    projectId: string,
    blocks: Array<{ id: string; content?: any; style?: any }>,
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

    // Update all blocks in a transaction
    await this.prisma.$transaction(
      blocks.map((block) =>
        this.prisma.block.update({
          where: { id: block.id },
          data: {
            content: block.content,
            style: block.style,
          },
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
}
