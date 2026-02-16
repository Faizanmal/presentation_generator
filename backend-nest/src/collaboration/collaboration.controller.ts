import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CollaborationService } from './collaboration.service';

@Controller('collaboration')
@UseGuards(JwtAuthGuard)
export class CollaborationController {
  constructor(private readonly collaborationService: CollaborationService) {}

  // ============================================
  // COLLABORATORS
  // ============================================

  @Get(':projectId/collaborators')
  async getCollaborators(@Param('projectId') projectId: string) {
    return this.collaborationService.getProjectCollaborators(projectId);
  }

  @Get(':projectId/active')
  async getActiveCollaborators(@Param('projectId') projectId: string) {
    return this.collaborationService.getActiveCollaborators(projectId);
  }

  @Post(':projectId/collaborators')
  async addCollaborator(
    @Param('projectId') projectId: string,
    @Body() body: { userId: string; role: 'VIEWER' | 'COMMENTER' | 'EDITOR' },
    @Request() req: { user: { id: string } },
  ) {
    return this.collaborationService.addCollaborator(
      projectId,
      body.userId,
      body.role,
      req.user.id,
    );
  }

  @Delete(':projectId/collaborators/:userId')
  async removeCollaborator(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Request() req: { user: { id: string } },
  ) {
    // Only project owner may remove collaborators
    const isOwner = await this.collaborationService.isProjectOwner(
      projectId,
      req.user.id,
    );
    if (!isOwner) {
      throw new ForbiddenException('Only project owner can remove collaborators');
    }

    return this.collaborationService.removeCollaborator(
      projectId,
      userId,
      req.user.id,
    );
  }

  @Patch(':projectId/collaborators/:collaboratorId')
  async updateCollaboratorRole(
    @Param('projectId') projectId: string,
    @Param('collaboratorId') collaboratorId: string,
    @Body() body: { role: 'VIEWER' | 'COMMENTER' | 'EDITOR' },
    @Request() req: { user: { id: string } },
  ) {
    const isOwner = await this.collaborationService.isProjectOwner(
      projectId,
      req.user.id,
    );
    if (!isOwner) {
      throw new ForbiddenException('Only project owner can update collaborator roles');
    }

    return this.collaborationService.updateCollaboratorRole(
      collaboratorId,
      body.role,
      req.user.id,
    );
  }

  // ============================================
  // COMMENTS
  // ============================================

  @Get(':projectId/comments')
  async getComments(
    @Param('projectId') projectId: string,
    @Query('slideId') slideId?: string,
  ) {
    return this.collaborationService.getComments(projectId, slideId);
  }

  @Post(':projectId/comments')
  async createComment(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      slideId?: string;
      blockId?: string;
      content: string;
      parentId?: string;
    },
    @Request() req: { user: { id: string } },
  ) {
    return this.collaborationService.createComment({
      projectId,
      slideId: body.slideId,
      blockId: body.blockId,
      userId: req.user.id,
      content: body.content,
      parentId: body.parentId,
    });
  }

  @Post(':projectId/comments/:commentId/resolve')
  async resolveComment(@Param('commentId') commentId: string) {
    return this.collaborationService.resolveComment(commentId);
  }

  @Post(':projectId/comments/:commentId/unresolve')
  async unresolveComment(@Param('commentId') commentId: string) {
    return this.collaborationService.unresolveComment(commentId);
  }

  @Post(':projectId/comments/:commentId/pin')
  async pinComment(@Param('commentId') commentId: string) {
    return this.collaborationService.pinComment(commentId, true);
  }

  @Post(':projectId/comments/:commentId/unpin')
  async unpinComment(@Param('commentId') commentId: string) {
    return this.collaborationService.pinComment(commentId, false);
  }

  @Post(':projectId/comments/:commentId')
  async updateComment(
    @Param('commentId') commentId: string,
    @Body() body: { content: string },
  ) {
    return this.collaborationService.updateComment(commentId, body.content);
  }

  @Delete(':projectId/comments/:commentId')
  async deleteComment(@Param('commentId') commentId: string) {
    return this.collaborationService.deleteComment(commentId);
  }

  // ============================================
  // VERSION HISTORY
  // ============================================

  @Get(':projectId/versions')
  async getVersions(@Param('projectId') projectId: string) {
    return this.collaborationService.getVersions(projectId);
  }

  @Post(':projectId/versions')
  async createVersion(
    @Param('projectId') projectId: string,
    @Body() body: { snapshot: unknown; message?: string },
    @Request() req: { user: { id: string } },
  ) {
    return this.collaborationService.createVersion({
      projectId,
      snapshot: body.snapshot,
      message: body.message,
      createdBy: req.user.id,
    });
  }

  @Get(':projectId/versions/:version')
  async getVersion(
    @Param('projectId') projectId: string,
    @Param('version') version: string,
  ) {
    return this.collaborationService.getVersion(
      projectId,
      parseInt(version, 10),
    );
  }

  @Post(':projectId/versions/:version/restore')
  async restoreVersion(
    @Param('projectId') projectId: string,
    @Param('version') version: string,
  ) {
    return this.collaborationService.restoreVersion(
      projectId,
      parseInt(version, 10),
    );
  }
}
