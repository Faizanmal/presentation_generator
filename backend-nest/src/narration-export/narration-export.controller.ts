import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  NarrationExportService,
  VoiceId,
  ExportFormat,
} from './narration-export.service';

// DTOs
class GenerateSpeakerNotesDto {
  tone?: 'professional' | 'casual' | 'educational' | 'persuasive';
  duration?: 'short' | 'medium' | 'detailed';
}

class GenerateNarrationDto {
  voice: VoiceId;
  speed?: number;
  slideIds?: string[];
}

class ExportVideoDto {
  format: ExportFormat;
  resolution: '720p' | '1080p' | '4k';
  includeNarration: boolean;
  slideTransition?: 'none' | 'fade' | 'slide';
  slideDuration?: number;
  narrationProjectId?: string;
}

class UpdateSpeakerNotesDto {
  speakerNotes: string;
}

@Controller('narration')
@UseGuards(JwtAuthGuard)
export class NarrationExportController {
  constructor(private readonly narrationService: NarrationExportService) {}

  @Get('voices')
  getVoiceOptions() {
    return this.narrationService.getVoiceOptions();
  }

  @Post(':projectId/speaker-notes/generate')
  async generateSpeakerNotes(
    @Param('projectId') projectId: string,
    @Body() dto: GenerateSpeakerNotesDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.narrationService.generateSpeakerNotes(
      projectId,
      req.user.id,
      dto,
    );
  }

  @Patch('slides/:slideId/speaker-notes')
  async updateSpeakerNotes(
    @Param('slideId') slideId: string,
    @Body() dto: UpdateSpeakerNotesDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.narrationService.updateSpeakerNotes(
      slideId,
      dto.speakerNotes,
      req.user.id,
    );
  }

  @Post(':projectId/generate')
  async generateNarration(
    @Param('projectId') projectId: string,
    @Body() dto: GenerateNarrationDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.narrationService.generateNarration(projectId, req.user.id, dto);
  }

  @Get('projects/:narrationProjectId')
  async getNarrationProject(
    @Param('narrationProjectId') narrationProjectId: string,
  ) {
    return this.narrationService.getNarrationProject(narrationProjectId);
  }

  @Post(':projectId/export-video')
  async exportVideo(
    @Param('projectId') projectId: string,
    @Body() dto: ExportVideoDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.narrationService.exportVideo(projectId, req.user.id, dto);
  }

  @Get('jobs/:jobId')
  async getVideoExportJob(@Param('jobId') jobId: string) {
    return this.narrationService.getVideoExportJob(jobId);
  }
}
