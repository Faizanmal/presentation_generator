import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PresenterWellnessService } from './presenter-wellness.service';

class UpdateMetricsDto {
  speakingPaceWPM?: number;
  pauseFrequency?: number;
  avgPauseDuration?: number;
  volumeVariation?: number;
  fillerWordCount?: number;
  stressIndicators?: number;
}

class AnalyzePaceDto {
  wordCount: number;
  durationSeconds: number;
  pauses: { start: number; end: number }[];
}

class DetectStressDto {
  pitchVariation: number;
  tempo: number;
  volumeSpikes: number;
  breathingPattern: 'normal' | 'shallow' | 'irregular';
}

@ApiTags('Presenter Wellness')
@Controller('wellness')
export class PresenterWellnessController {
  constructor(private readonly wellnessService: PresenterWellnessService) {}

  @Get('break-reminders')
  @ApiOperation({ summary: 'Get break reminder configurations' })
  getBreakReminders() {
    return this.wellnessService.getBreakReminders();
  }

  @Post('sessions/:presentationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start wellness session' })
  async startSession(
    @Request() req: { user: { id: string } },
    @Param('presentationId') presentationId: string,
  ) {
    return this.wellnessService.startSession(req.user.id, presentationId);
  }

  @Put('sessions/:sessionId/metrics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update session metrics' })
  async updateMetrics(
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateMetricsDto,
  ) {
    return this.wellnessService.updateMetrics(sessionId, dto);
  }

  @Post('sessions/:sessionId/break')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record break taken' })
  async recordBreak(
    @Param('sessionId') sessionId: string,
    @Body() body: { breakType: string },
  ) {
    return this.wellnessService.recordBreak(sessionId, body.breakType);
  }

  @Post('sessions/:sessionId/end')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'End wellness session and get summary' })
  async endSession(@Param('sessionId') sessionId: string) {
    return this.wellnessService.endSession(sessionId);
  }

  @Post('analyze/pace')
  @ApiOperation({ summary: 'Analyze speaking pace' })
  analyzePace(@Body() dto: AnalyzePaceDto) {
    return this.wellnessService.analyzeSpeakingPace(dto);
  }

  @Post('analyze/stress')
  @ApiOperation({ summary: 'Detect stress indicators' })
  detectStress(@Body() dto: DetectStressDto) {
    return this.wellnessService.detectStressIndicators(dto);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get wellness history' })
  async getHistory(
    @Request() req: { user: { id: string } },
    @Query('limit') limit?: string,
  ) {
    return this.wellnessService.getWellnessHistory(
      req.user.id,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get('trends')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get wellness trends' })
  async getTrends(@Request() req: { user: { id: string } }) {
    return this.wellnessService.getWellnessTrends(req.user.id);
  }
}
