import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ABTestingService } from './ab-testing.service';

class CreateTestDto {
  name: string;
  description?: string;
  projectId: string;
  goalMetric?: string;
  variants: Array<{
    name: string;
    description?: string;
    themeConfig: Record<string, unknown>;
    isControl?: boolean;
    traffic?: number;
  }>;
  sampleSize?: number;
  confidenceLevel?: number;
}

class RecordResultDto {
  sessionId: string;
  variantId: string;
  engaged: boolean;
  completed: boolean;
  viewTime: number;
  interactions: number;
  dropOffSlide?: number;
}

class GenerateVariationsDto {
  baseTheme: Record<string, unknown>;
  count?: number;
}

@ApiTags('A/B Testing')
@Controller('ab-testing')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ABTestingController {
  constructor(private readonly abTestingService: ABTestingService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new A/B test' })
  async createTest(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateTestDto,
  ) {
    return this.abTestingService.createTest(req.user.id, dto.projectId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user tests' })
  async getUserTests(
    @Request() req: { user: { id: string } },
    @Query('projectId') projectId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.abTestingService.getUserTests(
      req.user.id,
      projectId,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get test by ID' })
  async getTest(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.abTestingService.getTest(id, req.user.id);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start an A/B test' })
  async startTest(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.abTestingService.startTest(id, req.user.id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause an A/B test' })
  async pauseTest(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.abTestingService.pauseTest(id, req.user.id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a paused test' })
  async resumeTest(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.abTestingService.resumeTest(id, req.user.id);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete an A/B test' })
  async completeTest(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.abTestingService.completeTest(id, req.user.id);
  }

  @Get(':id/variant')
  @ApiOperation({ summary: 'Get variant for a visitor' })
  async getVariantForVisitor(
    @Param('id') id: string,
    @Query('sessionId') sessionId: string,
  ) {
    return this.abTestingService.getVariantForVisitor(id, sessionId);
  }

  @Post(':id/result')
  @ApiOperation({ summary: 'Record a test result' })
  async recordResult(@Param('id') id: string, @Body() dto: RecordResultDto) {
    return this.abTestingService.recordResult(id, dto);
  }

  @Get(':id/analysis')
  @ApiOperation({ summary: 'Analyze test results' })
  async analyzeResults(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    // Verify ownership
    await this.abTestingService.getTest(id, req.user.id);
    return this.abTestingService.analyzeResults(id);
  }

  @Post('generate-variations')
  @ApiOperation({ summary: 'Generate theme variations for testing' })
  generateVariations(@Body() dto: GenerateVariationsDto) {
    return this.abTestingService.generateThemeVariations(
      dto.baseTheme,
      dto.count || 3,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a test' })
  async deleteTest(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.abTestingService.deleteTest(id, req.user.id);
  }
}
