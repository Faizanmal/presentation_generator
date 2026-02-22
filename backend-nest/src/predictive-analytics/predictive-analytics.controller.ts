import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PredictiveAnalyticsService } from './predictive-analytics.service';

@ApiTags('Predictive Analytics')
@Controller('predictive-analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PredictiveAnalyticsController {
  constructor(private readonly analyticsService: PredictiveAnalyticsService) {}

  @Post('projects/:projectId/predict')
  @ApiOperation({ summary: 'Generate predictions for project' })
  async generatePredictions(
    @Request() req: { user: { id: string } },
    @Param('projectId') projectId: string,
  ) {
    return this.analyticsService.generatePredictions(projectId, req.user.id);
  }

  @Get('projects/:projectId/history')
  @ApiOperation({ summary: 'Get prediction history' })
  async getPredictionHistory(@Param('projectId') projectId: string) {
    return this.analyticsService.getPredictionHistory(projectId);
  }

  @Get('projects/:projectId/compare')
  @ApiOperation({ summary: 'Compare actual vs predicted' })
  async compareActualVsPredicted(@Param('projectId') projectId: string) {
    return this.analyticsService.compareActualVsPredicted(projectId);
  }

  @Get('benchmarks')
  @ApiOperation({ summary: 'Get industry benchmarks' })
  async getBenchmarks(@Query('category') category?: string) {
    // backward-compatible: accepts `category` query (legacy) — forwarded as-is
    return this.analyticsService.getBenchmarks(category);
  }

  @Get('benchmarks/:projectId')
  @ApiOperation({ summary: 'Get benchmarks for a specific project' })
  async getBenchmarksForProject(@Param('projectId') projectId: string) {
    return this.analyticsService.getBenchmarks(projectId);
  }

  @Post('projects/:projectId/schedule')
  @ApiOperation({ summary: 'Schedule prediction updates' })
  scheduleUpdate(
    @Request() req: { user: { id: string } },
    @Param('projectId') projectId: string,
  ) {
    return this.analyticsService.scheduleUpdate(projectId, req.user.id);
  }
}
