import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagsService {
  private readonly logger = new Logger(TagsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all tags for a user
   */
  async findAll(userId: string) {
    return this.prisma.tag.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { projects: true },
        },
      },
    });
  }

  /**
   * Get a single tag by ID
   */
  async findOne(id: string, userId: string) {
    const tag = await this.prisma.tag.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: { projects: true },
        },
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return tag;
  }

  /**
   * Create a new tag
   */
  async create(userId: string, createTagDto: CreateTagDto) {
    // Check if tag with same name already exists for this user
    const existing = await this.prisma.tag.findUnique({
      where: {
        userId_name: {
          userId,
          name: createTagDto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Tag with this name already exists');
    }

    return this.prisma.tag.create({
      data: {
        name: createTagDto.name,
        color: createTagDto.color,
        userId,
      },
    });
  }

  /**
   * Update a tag
   */
  async update(id: string, userId: string, updateTagDto: UpdateTagDto) {
    // Check if tag exists and belongs to user
    const tag = await this.prisma.tag.findFirst({
      where: { id, userId },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    // Check for name conflict if name is being changed
    if (updateTagDto.name && updateTagDto.name !== tag.name) {
      const existing = await this.prisma.tag.findUnique({
        where: {
          userId_name: {
            userId,
            name: updateTagDto.name,
          },
        },
      });

      if (existing) {
        throw new ConflictException('Tag with this name already exists');
      }
    }

    return this.prisma.tag.update({
      where: { id },
      data: updateTagDto,
    });
  }

  /**
   * Delete a tag
   */
  async remove(id: string, userId: string) {
    // Check if tag exists and belongs to user
    const tag = await this.prisma.tag.findFirst({
      where: { id, userId },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    await this.prisma.tag.delete({
      where: { id },
    });

    return { message: 'Tag deleted successfully' };
  }

  /**
   * Add tag to project
   */
  async addToProject(tagId: string, projectId: string, userId: string) {
    // Verify tag belongs to user
    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, userId },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    // Verify project belongs to user
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Add tag to project
    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        tags: {
          connect: { id: tagId },
        },
      },
    });

    return { message: 'Tag added to project' };
  }

  /**
   * Remove tag from project
   */
  async removeFromProject(tagId: string, projectId: string, userId: string) {
    // Verify tag belongs to user
    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, userId },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    // Verify project belongs to user
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Remove tag from project
    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        tags: {
          disconnect: { id: tagId },
        },
      },
    });

    return { message: 'Tag removed from project' };
  }
}
