import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SentimentAnalysisService } from './sentiment-analysis.service';

class StartSessionDto {
  projectId: string;
  slideId?: string;
}

@ApiTags('Sentiment Analysis')
@Controller('sentiment')
export class SentimentAnalysisController {
  constructor(private readonly sentimentService: SentimentAnalysisService) {}

  @Post('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start sentiment session' })
  async startSession(
    @Request() req: { user: { id: string } },
    @Body() dto: StartSessionDto,
  ) {
    return this.sentimentService.startSession(req.user.id, dto.projectId, dto.slideId);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get current sentiment' })
  async getCurrentSentiment(@Param('id') id: string) {
    return this.sentimentService.getCurrentSentiment(id);
  }

  @Get('sessions/:id/timeline')
  @ApiOperation({ summary: 'Get sentiment timeline' })
  async getSentimentTimeline(@Param('id') id: string) {
    return this.sentimentService.getSentimentTimeline(id);
  }

  @Get('sessions/:id/summary')
  @ApiOperation({ summary: 'Get sentiment summary' })
  async getSentimentSummary(@Param('id') id: string) {
    return this.sentimentService.getSentimentSummary(id);
  }

  @Get('sessions/:id/insights')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate AI insights' })
  async generateInsights(@Param('id') id: string) {
    return this.sentimentService.generateInsights(id);
  }

  @Post('sessions/:id/snapshot')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create sentiment snapshot' })
  async createSnapshot(@Param('id') id: string) {
    return this.sentimentService.createSnapshot(id);
  }

  @Post('sessions/:id/end')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'End sentiment session' })
  async endSession(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.sentimentService.endSession(id, req.user.id);
  }
}
