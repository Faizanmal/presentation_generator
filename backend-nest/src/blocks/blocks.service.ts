import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockType } from '@prisma/client';
import { AdvancedCacheService } from '../common/cache/advanced-cache.service';
import { CollaborationService } from '../collaboration/collaboration.service';

interface CreateBlockDto {
  projectId: string;
  slideId?: string;
  blockType: BlockType;
  content: Record<string, unknown>;
  order: number;
  style?: Record<string, unknown>;
}

interface UpdateBlockDto {
  content?: Record<string, unknown>;
  order?: number;
  style?: Record<string, unknown>;
  blockType?: BlockType;
  version?: number; // For optimistic locking
}

interface ReorderBlocksDto {
  blocks: Array<{ id: string; order: number }>;
}

@Injectable()
export class BlocksService {
  private readonly logger = new Logger(BlocksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: AdvancedCacheService,
    private readonly collaborationService: CollaborationService,
  ) { }

  /**
   * Create a new block
   */
  async create(userId: string, createBlockDto: CreateBlockDto) {
    // Verify project ownership / collaborator role
    const project = await this.prisma.project.findUnique({
      where: { id: createBlockDto.projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId) {
      const role = await this.collaborationService.getUserRole(
        createBlockDto.projectId,
        userId,
      );
      if (role !== 'EDITOR') {
        throw new ForbiddenException('You cannot edit this project');
      }
    }

    const block = await this.prisma.block.create({
      data: {
        projectId: createBlockDto.projectId,
        slideId: createBlockDto.slideId,
        blockType: createBlockDto.blockType,
        content: createBlockDto.content as import('@prisma/client').Prisma.InputJsonValue,
        order: createBlockDto.order,
        style: (createBlockDto.style || {}) as import('@prisma/client').Prisma.InputJsonValue,
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
  async findBySlide(slideId: string, filterType?: BlockType) {
    return this.prisma.block.findMany({
      where: { slideId, ...(filterType && { blockType: filterType }) },
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
      const role = await this.collaborationService.getUserRole(
        block.projectId,
        userId,
      );
      if (role !== 'EDITOR') {
        throw new ForbiddenException('You cannot edit this block');
      }
    }

    // Optimistic locking: Check version if provided
    if (
      updateBlockDto.version !== undefined &&
      block.version !== updateBlockDto.version
    ) {
      // Version conflict detected - fetch latest and merge if possible
      this.logger.warn(
        `Version conflict for block ${blockId}: expected ${updateBlockDto.version}, got ${block.version}`,
      );

      // Simple conflict resolution: last write wins with version increment
      // In production, you might want more sophisticated merging
      const updated = await this.prisma.block.update({
        where: { id: blockId },
        data: {
          content: updateBlockDto.content as import('@prisma/client').Prisma.InputJsonValue,
          order: updateBlockDto.order,
          style: updateBlockDto.style as import('@prisma/client').Prisma.InputJsonValue,
          blockType: updateBlockDto.blockType,
          version: { increment: 1 },
        },
      });

      // Update project timestamp
      await this.prisma.project.update({
        where: { id: block.projectId },
        data: { updatedAt: new Date() },
      });

      return { ...updated, conflictResolved: true };
    }

    // Normal update with version increment
    const updated = await this.prisma.block.update({
      where: { id: blockId },
      data: {
        content: updateBlockDto.content as import('@prisma/client').Prisma.InputJsonValue,
        order: updateBlockDto.order,
        style: updateBlockDto.style as import('@prisma/client').Prisma.InputJsonValue,
        blockType: updateBlockDto.blockType,
        version: { increment: 1 },
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
      const role = await this.collaborationService.getUserRole(
        block.projectId,
        userId,
      );
      if (role !== 'EDITOR') {
        throw new ForbiddenException('You cannot delete this block');
      }
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
   * Duplicate a block (copy within same slide)
   */
  async duplicate(userId: string, blockId: string): Promise<object> {
    const block = await this.prisma.block.findUnique({
      where: { id: blockId },
      include: { project: true },
    });

    if (!block) throw new NotFoundException('Block not found');

    if (block.project.ownerId !== userId) {
      const role = await this.collaborationService.getUserRole(
        block.projectId,
        userId,
      );
      if (role !== 'EDITOR')
        throw new ForbiddenException('You cannot edit this project');
    }

    // Shift blocks after target order
    await this.prisma.block.updateMany({
      where: { slideId: block.slideId, order: { gt: block.order } },
      data: { order: { increment: 1 } },
    });

    const newBlock = await this.prisma.block.create({
      data: {
        projectId: block.projectId,
        slideId: block.slideId,
        blockType: block.blockType,
        content:
          block.content as import('@prisma/client').Prisma.InputJsonValue,
        style: block.style as import('@prisma/client').Prisma.InputJsonValue,
        order: block.order + 1,
      },
    });

    await this.prisma.project.update({
      where: { id: block.projectId },
      data: { updatedAt: new Date() },
    });

    this.logger.log(`Block duplicated: ${blockId} -> ${newBlock.id}`);
    return newBlock;
  }

  /**
   * Bulk create multiple blocks (for paste/import operations)
   */
  async bulkCreate(
    userId: string,
    projectId: string,
    blocks: Array<CreateBlockDto>,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    if (project.ownerId !== userId) {
      const role = await this.collaborationService.getUserRole(
        projectId,
        userId,
      );
      if (role !== 'EDITOR')
        throw new ForbiddenException('You cannot edit this project');
    }

    const created = await this.prisma.$transaction(
      blocks.map((b) =>
        this.prisma.block.create({
          data: {
            projectId,
            slideId: b.slideId,
            blockType: b.blockType,
            content: b.content as import('@prisma/client').Prisma.InputJsonValue,
            order: b.order,
            style: (b.style || {}) as import('@prisma/client').Prisma.InputJsonValue,
          },
        }),
      ),
    );

    await this.prisma.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    this.logger.log(
      `Bulk created ${created.length} blocks for project ${projectId}`,
    );
    return created;
  }

  /**
   * Reorder blocks within a slide
   */
  async reorder(
    userId: string,
    projectId: string,
    reorderDto: ReorderBlocksDto,
  ) {
    // Verify project ownership / collaborator role
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
    blocks: Array<{
      id: string;
      content?: Record<string, unknown>;
      style?: Record<string, unknown>;
    }>,
  ) {
    // Verify project ownership / collaborator role
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

    // Update all blocks in a transaction
    await this.prisma.$transaction(
      blocks.map((block) =>
        this.prisma.block.update({
          where: { id: block.id },
          data: {
            content: block.content as import('@prisma/client').Prisma.InputJsonValue,
            style: block.style as import('@prisma/client').Prisma.InputJsonValue,
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
