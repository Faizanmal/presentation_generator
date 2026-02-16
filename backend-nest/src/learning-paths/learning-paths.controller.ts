import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LearningPathsService } from './learning-paths.service';

class CreatePathDto {
  title: string;
  description?: string;
  category?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  projectIds: string[];
  isPublic?: boolean;
}

class GeneratePathDto {
  topic: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  duration?: 'short' | 'medium' | 'long';
}

class UpdateProgressDto {
  moduleId: string;
  completed: boolean;
  score?: number;
  timeSpent?: number;
}

class AddQuizDto {
  question: string;
  options: string[];
  correctIndex: number;
}

@ApiTags('Learning Paths')
@Controller('learning-paths')
export class LearningPathsController {
  constructor(private readonly learningService: LearningPathsService) {}

  @Get()
  @ApiOperation({ summary: 'Get public learning paths' })
  async getPublicPaths(
    @Query('category') category?: string,
    @Query('difficulty') difficulty?: string,
    @Query('limit') limit?: string,
  ) {
    return this.learningService.getPublicPaths({
      category,
      difficulty,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create learning path' })
  async createPath(
    @Request() req: { user: { id: string } },
    @Body() dto: CreatePathDto,
  ) {
    return this.learningService.createLearningPath(req.user.id, dto);
  }

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate AI learning path' })
  async generatePath(
    @Request() req: { user: { id: string } },
    @Body() dto: GeneratePathDto,
  ) {
    return this.learningService.generateLearningPath(req.user.id, dto.topic, dto);
  }

  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get learner dashboard' })
  async getDashboard(@Request() req: { user: { id: string } }) {
    return this.learningService.getLearnerDashboard(req.user.id);
  }

  @Get('recommendations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recommendations' })
  async getRecommendations(@Request() req: { user: { id: string } }) {
    return this.learningService.getRecommendations(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get learning path' })
  async getPath(@Param('id') id: string) {
    return this.learningService.getLearningPath(id);
  }

  @Post(':id/enroll')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enroll in learning path' })
  async enroll(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.learningService.enrollLearner(id, req.user.id);
  }

  @Get(':id/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get progress' })
  async getProgress(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.learningService.getLearnerProgress(id, req.user.id);
  }

  @Patch(':id/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update progress' })
  async updateProgress(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.learningService.updateProgress(id, req.user.id, dto);
  }

  @Get(':id/certificate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate certificate' })
  async getCertificate(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.learningService.generateCertificate(id, req.user.id);
  }

  @Post('modules/:moduleId/quiz')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add quiz to module' })
  async addQuiz(
    @Request() req: { user: { id: string } },
    @Param('moduleId') moduleId: string,
    @Body() dto: AddQuizDto,
  ) {
    return this.learningService.addQuizToModule(moduleId, req.user.id, dto);
  }
}
