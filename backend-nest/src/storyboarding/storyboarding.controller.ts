import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StoryboardingService } from './storyboarding.service';

class GenerateStoryboardDto {
  topic: string;
  projectId?: string;
  audienceType: string; // executive, technical, educational, marketing, creative
  presentationType: string; // summary, deep_dive, pitch, tutorial
  duration?: number;
  keyPoints?: string[];
  tone?: string;
}

class UpdateSectionDto {
  title?: string;
  keyPoints?: string[];
  speakerNotes?: string;
  suggestedLayout?: string;
  duration?: number;
}

@ApiTags('Storyboarding')
@Controller('storyboarding')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StoryboardingController {
  constructor(private readonly storyboardingService: StoryboardingService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a dynamic storyboard' })
  async generateStoryboard(
    @Request() req: { user: { id: string } },
    @Body() dto: GenerateStoryboardDto,
  ) {
    return this.storyboardingService.generateStoryboard(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user storyboards' })
  async getUserStoryboards(
    @Request() req: { user: { id: string } },
    @Query('limit') limit?: string,
  ) {
    return this.storyboardingService.getUserStoryboards(
      req.user.id,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get storyboard by ID' })
  async getStoryboard(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.storyboardingService.getStoryboard(id, req.user.id);
  }

  @Patch('sections/:sectionId')
  @ApiOperation({ summary: 'Update a storyboard section' })
  async updateSection(
    @Request() req: { user: { id: string } },
    @Param('sectionId') sectionId: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.storyboardingService.updateSection(sectionId, req.user.id, dto);
  }

  @Post(':id/apply/:projectId')
  @ApiOperation({ summary: 'Apply storyboard to a project' })
  async applyToProject(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('projectId') projectId: string,
  ) {
    return this.storyboardingService.applyToProject(id, projectId, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete storyboard' })
  async deleteStoryboard(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.storyboardingService.deleteStoryboard(id, req.user.id);
  }
}
