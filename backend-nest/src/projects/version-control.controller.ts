import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  VersionControlService,
  PresentationVersion,
  VersionComparison,
} from './version-control.service';

@Controller('projects/:projectId/versions')
@UseGuards(JwtAuthGuard)
export class VersionControlController {
  constructor(private readonly versionControlService: VersionControlService) {}

  @Post()
  async createVersion(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Body()
    body: { name?: string; description?: string; isMilestone?: boolean },
  ): Promise<PresentationVersion> {
    return this.versionControlService.createVersion(projectId, req.user.id, {
      name: body.name,
      description: body.description,
      isMilestone: body.isMilestone,
    });
  }

  @Get()
  async getVersions(
    @Param('projectId') projectId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('includeAutoSaves') includeAutoSaves?: string,
    @Query('milestonesOnly') milestonesOnly?: string,
  ): Promise<{ versions: PresentationVersion[]; total: number }> {
    return this.versionControlService.getVersions(projectId, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      includeAutoSaves: includeAutoSaves === 'true',
      milestonesOnly: milestonesOnly === 'true',
    });
  }

  @Get(':versionId')
  async getVersion(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
  ): Promise<PresentationVersion> {
    return this.versionControlService.getVersion(projectId, versionId);
  }

  @Post(':versionId/restore')
  async restoreVersion(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Request() req: any,
  ): Promise<{ success: boolean; message: string }> {
    await this.versionControlService.restoreVersion(
      projectId,
      versionId,
      req.user.id,
    );
    return { success: true, message: 'Version restored successfully' };
  }

  @Get('compare/:versionAId/:versionBId')
  async compareVersions(
    @Param('projectId') projectId: string,
    @Param('versionAId') versionAId: string,
    @Param('versionBId') versionBId: string,
  ): Promise<VersionComparison> {
    return this.versionControlService.compareVersions(
      projectId,
      versionAId,
      versionBId,
    );
  }

  @Put(':versionId/milestone')
  async markAsMilestone(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Body() body: { name: string; description?: string },
  ): Promise<PresentationVersion> {
    return this.versionControlService.markAsMilestone(
      projectId,
      versionId,
      body.name,
      body.description,
    );
  }

  @Post(':versionId/branch')
  async createBranch(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Request() req: any,
    @Body() body: { name: string },
  ): Promise<{ branchId: string; projectId: string }> {
    return this.versionControlService.createBranch(
      projectId,
      versionId,
      req.user.id,
      body.name,
    );
  }

  @Post('merge')
  async mergeChanges(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      sourceProjectId: string;
      strategy: 'source-wins' | 'target-wins' | 'manual';
      selectedSlides?: string[];
    },
  ): Promise<{ mergedSlides: number; conflicts: number }> {
    return this.versionControlService.mergeChanges(
      body.sourceProjectId,
      projectId,
      {
        strategy: body.strategy,
        selectedSlides: body.selectedSlides,
      },
    );
  }
}
