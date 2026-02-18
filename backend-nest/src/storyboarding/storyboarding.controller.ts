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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StoryboardingService } from './storyboarding.service';
import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  IsArray,
  ArrayNotEmpty,
  IsNotEmpty,
  IsInt,
} from 'class-validator';

class GenerateStoryboardDto {
  @IsString()
  @IsNotEmpty()
  topic: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  audienceType?: string; // executive, technical, educational, marketing, creative

  @IsOptional()
  @IsString()
  presentationType?: string; // summary, deep_dive, pitch, tutorial

  @IsOptional()
  @IsInt()
  duration?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keyPoints?: string[];

  @IsOptional()
  @IsString()
  tone?: string;
}

class UpdateSectionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keyPoints?: string[];

  @IsOptional()
  @IsString()
  speakerNotes?: string;

  @IsOptional()
  @IsString()
  suggestedLayout?: string;

  @IsOptional()
  @IsInt()
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
    return this.storyboardingService.generateStoryboard(req.user.id, {
      ...dto,
      audienceType: dto.audienceType || 'general',
      presentationType: dto.presentationType || 'presentation',
    });
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
