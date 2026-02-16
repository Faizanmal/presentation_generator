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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AIResearchService } from './ai-research.service';

class ResearchTopicDto {
  topic: string;
  projectId?: string;
  sources?: string[];
  maxResults?: number;
  language?: string;
}

@ApiTags('AI Research')
@Controller('ai-research')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AIResearchController {
  constructor(private readonly aiResearchService: AIResearchService) {}

  @Post('topic')
  @ApiOperation({ summary: 'Research a topic and get curated content' })
  async researchTopic(
    @Request() req: { user: { id: string } },
    @Body() dto: ResearchTopicDto,
  ) {
    return this.aiResearchService.researchTopic(req.user.id, dto.topic, {
      projectId: dto.projectId,
      sources: dto.sources,
      maxResults: dto.maxResults,
      language: dto.language,
    });
  }

  @Get('history')
  @ApiOperation({ summary: 'Get research history' })
  async getHistory(
    @Request() req: { user: { id: string } },
    @Query('limit') limit?: string,
  ) {
    return this.aiResearchService.getResearchHistory(
      req.user.id,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get research by ID' })
  async getResearch(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.aiResearchService.getResearch(id, req.user.id);
  }

  @Post(':id/content-blocks')
  @ApiOperation({ summary: 'Generate content blocks from research' })
  async generateContentBlocks(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    // Verify ownership
    await this.aiResearchService.getResearch(id, req.user.id);
    return this.aiResearchService.generateContentBlocks(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete research' })
  async deleteResearch(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.aiResearchService.deleteResearch(id, req.user.id);
  }
}
