import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TeamAnalyticsService } from './team-analytics.service';

class DateRangeDto {
  startDate?: string;
  endDate?: string;
}

class ActivityQueryDto {
  limit?: number;
  offset?: number;
  userId?: string;
  projectId?: string;
}

class TrackActivityDto {
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, any>;
}

@Controller('team-analytics')
@UseGuards(JwtAuthGuard)
export class TeamAnalyticsController {
  constructor(private readonly teamAnalyticsService: TeamAnalyticsService) {}

  /**
   * Get team performance metrics
   */
  @Get('organizations/:orgId/performance')
  async getTeamPerformance(
    @Param('orgId') orgId: string,
    @Query() query: DateRangeDto,
  ) {
    const period = this.buildPeriod(query);
    return this.teamAnalyticsService.getTeamPerformance(orgId, period);
  }

  /**
   * Get member contributions
   */
  @Get('organizations/:orgId/contributions')
  async getMemberContributions(
    @Param('orgId') orgId: string,
    @Query() query: DateRangeDto,
  ) {
    const period = this.buildPeriod(query);
    return this.teamAnalyticsService.getMemberContributions(orgId, period);
  }

  /**
   * Get full team dashboard
   */
  @Get('organizations/:orgId/dashboard')
  async getTeamDashboard(
    @Param('orgId') orgId: string,
    @Query() query: DateRangeDto,
  ) {
    const period = this.buildPeriod(query);
    return this.teamAnalyticsService.getTeamDashboard(orgId, period);
  }

  /**
   * Get activity timeline
   */
  @Get('organizations/:orgId/activity')
  async getActivityTimeline(
    @Param('orgId') orgId: string,
    @Query() query: ActivityQueryDto,
  ) {
    return this.teamAnalyticsService.getActivityTimeline(orgId, {
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
      userId: query.userId,
      projectId: query.projectId,
    });
  }

  /**
   * Get productivity trends
   */
  @Get('organizations/:orgId/trends')
  async getProductivityTrends(
    @Param('orgId') orgId: string,
    @Query() query: DateRangeDto,
  ) {
    const period = this.buildPeriod(query) || {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date(),
    };
    return this.teamAnalyticsService.getProductivityTrends(orgId, period);
  }

  /**
   * Get revision heatmap for a project
   */
  @Get('projects/:projectId/heatmap')
  async getRevisionHeatmap(@Param('projectId') projectId: string) {
    return this.teamAnalyticsService.getRevisionHeatmap(projectId);
  }

  /**
   * Get project attribution report
   */
  @Get('projects/:projectId/attribution')
  async getProjectAttribution(@Param('projectId') projectId: string) {
    return this.teamAnalyticsService.getProjectAttribution(projectId);
  }

  /**
   * Track activity (internal use)
   */
  @Post('track')
  async trackActivity(
    @Body() dto: TrackActivityDto,
    @Request() req: any,
  ) {
    await this.teamAnalyticsService.trackActivity(
      req.user.id,
      dto.action,
      dto.targetType,
      dto.targetId,
      dto.metadata,
    );
    return { success: true };
  }

  private buildPeriod(query: DateRangeDto): { start: Date; end: Date } | undefined {
    if (query.startDate && query.endDate) {
      return {
        start: new Date(query.startDate),
        end: new Date(query.endDate),
      };
    }
    return undefined;
  }
}
