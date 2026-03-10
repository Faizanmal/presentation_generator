import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  VideoRecordingService,
  RecordingSettings,
  VideoExportOptions,
} from './video-recording.service';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string };
}

@ApiTags('video-recording')
@Controller('api/video')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VideoRecordingController {
  constructor(private readonly videoRecordingService: VideoRecordingService) {}

  // ============================================
  // RECORDING SESSION MANAGEMENT
  // ============================================

  @Post('recording/initialize')
  @ApiOperation({ summary: 'Initialize a new recording session' })
  @ApiBody({
    schema: {
      properties: {
        projectId: { type: 'string' },
        settings: {
          type: 'object',
          properties: {
            resolution: { type: 'string', enum: ['720p', '1080p', '4k'] },
            frameRate: { type: 'number', enum: [30, 60] },
            includeWebcam: { type: 'boolean' },
            webcamPosition: {
              type: 'string',
              enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
            },
            includeAudio: { type: 'boolean' },
            audioSource: {
              type: 'string',
              enum: ['microphone', 'system', 'both'],
            },
          },
        },
      },
      required: ['projectId'],
    },
  })
  async initializeRecording(
    @Body() body: { projectId: string; settings?: Partial<RecordingSettings> },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.videoRecordingService.initializeRecording(
      req.user.id,
      body.projectId,
      body.settings,
    );
  }

  @Post('recording/:sessionId/start')
  @ApiOperation({ summary: 'Start recording' })
  async startRecording(
    @Param('sessionId') sessionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.videoRecordingService.startRecording(sessionId, req.user.id);
    return { success: true, message: 'Recording started' };
  }

  @Post('recording/:sessionId/pause')
  @ApiOperation({ summary: 'Pause recording' })
  async pauseRecording(
    @Param('sessionId') sessionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.videoRecordingService.pauseRecording(sessionId, req.user.id);
    return { success: true, message: 'Recording paused' };
  }

  @Post('recording/:sessionId/stop')
  @ApiOperation({ summary: 'Stop recording and start processing' })
  @ApiBody({
    schema: {
      properties: {
        exportOptions: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['mp4', 'webm', 'mov', 'gif'] },
            quality: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'ultra'],
            },
            addWatermark: { type: 'boolean' },
            addIntro: { type: 'boolean' },
            addOutro: { type: 'boolean' },
          },
        },
      },
    },
  })
  async stopRecording(
    @Param('sessionId') sessionId: string,
    @Body() body: { exportOptions?: Partial<VideoExportOptions> },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.videoRecordingService.stopRecording(
      sessionId,
      req.user.id,
      body.exportOptions,
    );
  }

  @Post('recording/:sessionId/chunk')
  @ApiOperation({ summary: 'Upload a video chunk' })
  async uploadChunk(
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      index: number;
      data: string; // Base64 encoded
      timestamp: number;
      type: 'screen' | 'webcam' | 'audio';
    },
    @Req() req: AuthenticatedRequest,
  ) {
    const chunkData = Buffer.from(body.data, 'base64');
    return this.videoRecordingService.uploadChunk(sessionId, req.user.id, {
      index: body.index,
      data: chunkData,
      timestamp: body.timestamp,
      type: body.type,
    });
  }

  // ============================================
  // PRESENTATION EXPORT
  // ============================================

  @Post('export/:projectId')
  @ApiOperation({ summary: 'Export presentation as video (no live recording)' })
  @ApiBody({
    schema: {
      properties: {
        format: { type: 'string', enum: ['mp4', 'webm', 'mov', 'gif'] },
        quality: { type: 'string', enum: ['low', 'medium', 'high', 'ultra'] },
        slideTimings: {
          type: 'array',
          items: { type: 'number' },
          description: 'Duration in seconds for each slide',
        },
        narrationAudioUrl: {
          type: 'string',
          description: 'URL to pre-recorded narration audio',
        },
        addBackgroundMusic: { type: 'boolean' },
        musicTrackId: { type: 'string' },
      },
    },
  })
  async exportPresentation(
    @Param('projectId') projectId: string,
    @Body()
    body: Partial<VideoExportOptions> & {
      slideTimings?: number[];
      narrationAudioUrl?: string;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.videoRecordingService.exportPresentationAsVideo(
      req.user.id,
      projectId,
      body,
    );
  }

  // ============================================
  // TEMPLATES & ASSETS
  // ============================================

  @Get('templates/:type')
  @ApiOperation({ summary: 'Get available video templates (intro/outro)' })
  async getTemplates(@Param('type') type: 'intro' | 'outro') {
    return this.videoRecordingService.getVideoTemplates(type);
  }

  @Get('music')
  @ApiOperation({ summary: 'Get available background music tracks' })
  async getMusicTracks() {
    return this.videoRecordingService.getMusicTracks();
  }

  // ============================================
  // RECORDING HISTORY
  // ============================================

  @Get('recordings')
  @ApiOperation({ summary: 'Get recording history' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async getRecordingHistory(
    @Query('projectId') projectId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.videoRecordingService.getRecordingHistory(req!.user.id, {
      projectId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('recordings/:recordingId')
  @ApiOperation({ summary: 'Get recording details' })
  async getRecording(
    @Param('recordingId') recordingId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.videoRecordingService.getRecording(recordingId, req.user.id);
  }

  @Delete('recordings/:recordingId')
  @ApiOperation({ summary: 'Delete a recording' })
  async deleteRecording(
    @Param('recordingId') recordingId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.videoRecordingService.deleteRecording(recordingId, req.user.id);
    return { success: true, message: 'Recording deleted' };
  }
}
