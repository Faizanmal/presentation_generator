import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateSessionDto {
  projectId: string;
  userId: string;
  socketId: string;
  color: string;
}

interface CreateCommentDto {
  projectId: string;
  slideId?: string;
  blockId?: string;
  userId: string;
  content: string;
  parentId?: string;
}

interface CreateVersionDto {
  projectId: string;
  snapshot: any;
  message?: string;
  createdBy: string;
}

interface BlockChangeDto {
  projectId: string;
  slideId: string;
  blockId: string;
  data: any;
  userId: string;
}

@Injectable()
export class CollaborationService {
  private readonly logger = new Logger(CollaborationService.name);

  constructor(private readonly prisma: PrismaService) { }

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  async createSession(dto: CreateSessionDto) {
    // Deactivate any existing sessions for this user in this project
    await this.prisma.collaborationSession.updateMany({
      where: {
        projectId: dto.projectId,
        userId: dto.userId,
        isActive: true,
      },
      data: { isActive: false },
    });

    return this.prisma.collaborationSession.create({
      data: {
        projectId: dto.projectId,
        userId: dto.userId,
        socketId: dto.socketId,
        color: dto.color,
        isActive: true,
      },
    });
  }

  async removeSession(projectId: string, userId: string, socketId: string) {
    return this.prisma.collaborationSession.updateMany({
      where: {
        projectId,
        userId,
        socketId,
      },
      data: { isActive: false },
    });
  }

  async getActiveCollaborators(projectId: string) {
    const sessions = await this.prisma.collaborationSession.findMany({
      where: {
        projectId,
        isActive: true,
      },
    });

    // Get user details
    const userIds = [...new Set(sessions.map((s) => s.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, image: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return sessions.map((session) => ({
      ...session,
      user: userMap.get(session.userId),
    }));
  }

  async updateCursorPosition(
    socketId: string,
    x: number,
    y: number,
    slideIndex: number,
  ) {
    return this.prisma.collaborationSession.updateMany({
      where: { socketId, isActive: true },
      data: {
        cursorX: x,
        cursorY: y,
        cursorSlide: slideIndex,
      },
    });
  }

  // ============================================
  // PROJECT COLLABORATORS
  // ============================================

  async addCollaborator(
    projectId: string,
    userId: string,
    role: 'VIEWER' | 'COMMENTER' | 'EDITOR',
    invitedBy: string,
  ) {
    return this.prisma.projectCollaborator.upsert({
      where: {
        projectId_userId: { projectId, userId },
      },
      update: { role },
      create: {
        projectId,
        userId,
        role,
        invitedBy,
      },
    });
  }

  async removeCollaborator(projectId: string, userId: string) {
    return this.prisma.projectCollaborator.delete({
      where: {
        projectId_userId: { projectId, userId },
      },
    });
  }

  async getProjectCollaborators(projectId: string) {
    const collaborators = await this.prisma.projectCollaborator.findMany({
      where: { projectId },
    });

    const userIds = collaborators.map((c) => c.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, image: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return collaborators.map((c) => ({
      ...c,
      user: userMap.get(c.userId),
    }));
  }

  async getCollaborators(projectId: string) {
    return this.getProjectCollaborators(projectId);
  }

  async getUserRole(projectId: string, userId: string) {
    const collaborator = await this.prisma.projectCollaborator.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });

    return collaborator?.role || null;
  }

  // ============================================
  // COMMENTS
  // ============================================

  async createComment(dto: CreateCommentDto) {
    return this.prisma.comment.create({
      data: {
        projectId: dto.projectId,
        slideId: dto.slideId,
        blockId: dto.blockId,
        userId: dto.userId,
        content: dto.content,
        parentId: dto.parentId,
      },
    });
  }

  async getComments(projectId: string, slideId?: string) {
    const comments = await this.prisma.comment.findMany({
      where: {
        projectId,
        ...(slideId && { slideId }),
        parentId: null, // Top-level comments only
      },
      orderBy: { createdAt: 'desc' },
    });

    const userIds = [...new Set(comments.map((c) => c.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, image: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    // Get replies for each comment
    const commentIds = comments.map((c) => c.id);
    const replies = await this.prisma.comment.findMany({
      where: { parentId: { in: commentIds } },
      orderBy: { createdAt: 'asc' },
    });

    const repliesByParent = new Map<string, any[]>();
    replies.forEach((r) => {
      const list = repliesByParent.get(r.parentId!) || [];
      list.push({ ...r, user: userMap.get(r.userId) });
      repliesByParent.set(r.parentId!, list);
    });

    return comments.map((c) => ({
      ...c,
      user: userMap.get(c.userId),
      replies: repliesByParent.get(c.id) || [],
    }));
  }

  async resolveComment(commentId: string) {
    return this.prisma.comment.update({
      where: { id: commentId },
      data: { resolved: true },
    });
  }

  async unresolveComment(commentId: string) {
    return this.prisma.comment.update({
      where: { id: commentId },
      data: { resolved: false },
    });
  }

  async pinComment(commentId: string, pinned: boolean) {
    return this.prisma.comment.update({
      where: { id: commentId },
      data: { pinned },
    });
  }

  async updateComment(commentId: string, content: string) {
    return this.prisma.comment.update({
      where: { id: commentId },
      data: { content },
    });
  }

  async deleteComment(commentId: string) {
    // Delete replies first
    await this.prisma.comment.deleteMany({
      where: { parentId: commentId },
    });

    return this.prisma.comment.delete({
      where: { id: commentId },
    });
  }

  // ============================================
  // VERSION HISTORY
  // ============================================

  async createVersion(dto: CreateVersionDto) {
    // Get the next version number
    const lastVersion = await this.prisma.projectVersion.findFirst({
      where: { projectId: dto.projectId },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (lastVersion?.version || 0) + 1;

    return this.prisma.projectVersion.create({
      data: {
        projectId: dto.projectId,
        version: nextVersion,
        snapshot: dto.snapshot,
        message: dto.message,
        createdBy: dto.createdBy,
      },
    });
  }

  async getVersions(projectId: string) {
    const versions = await this.prisma.projectVersion.findMany({
      where: { projectId },
      orderBy: { version: 'desc' },
      take: 50,
    });

    const userIds = [...new Set(versions.map((v) => v.createdBy))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, image: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return versions.map((v) => ({
      ...v,
      createdByUser: userMap.get(v.createdBy),
    }));
  }

  async getVersion(projectId: string, version: number) {
    return this.prisma.projectVersion.findUnique({
      where: {
        projectId_version: { projectId, version },
      },
    });
  }

  async restoreVersion(projectId: string, version: number) {
    const versionData = await this.getVersion(projectId, version);

    if (!versionData) {
      throw new NotFoundException('Version not found');
    }

    // The snapshot contains the full project state
    return versionData.snapshot;
  }

  // ============================================
  // CHANGE LOGGING
  // ============================================

  async logBlockChange(dto: BlockChangeDto) {
    // This can be used for conflict resolution and audit trail
    // For now, we just log it
    this.logger.debug(
      `Block change: ${dto.blockId} in project ${dto.projectId} by user ${dto.userId}`,
    );
  }
}
