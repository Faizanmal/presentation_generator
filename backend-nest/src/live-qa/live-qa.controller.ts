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
import { LiveQAService } from './live-qa.service';

class CreateSessionDto {
  projectId: string;
  title?: string;
  allowAnonymous?: boolean;
  moderationLevel?: 'off' | 'basic' | 'strict';
  maxQuestions?: number;
}

class SubmitQuestionDto {
  content: string;
  isAnonymous?: boolean;
}

class AnswerQuestionDto {
  answer?: string;
}

@ApiTags('Live Q&A')
@Controller('live-qa')
export class LiveQAController {
  constructor(private readonly qaService: LiveQAService) {}

  @Post('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Q&A session' })
  async createSession(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateSessionDto,
  ) {
    return this.qaService.createSession(req.user.id, dto.projectId, dto);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get session details' })
  async getSession(@Param('id') id: string) {
    return this.qaService.getSession(id);
  }

  @Get('sessions/:id/stats')
  @ApiOperation({ summary: 'Get session statistics' })
  async getSessionStats(@Param('id') id: string) {
    return this.qaService.getSessionStats(id);
  }

  @Post('sessions/:id/end')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'End Q&A session' })
  async endSession(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.qaService.endSession(id, req.user.id);
  }

  @Get('sessions/:id/questions')
  @ApiOperation({ summary: 'Get questions for session' })
  async getQuestions(
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: 'recent' | 'popular',
    @Query('limit') limit?: string,
  ) {
    return this.qaService.getQuestions(id, {
      status,
      sortBy,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('sessions/:id/questions')
  @ApiOperation({ summary: 'Submit a question (auth optional)' })
  async submitQuestion(
    @Param('id') id: string,
    @Body() dto: SubmitQuestionDto,
    @Request() req: { user?: { id: string } },
  ) {
    return this.qaService.submitQuestion(
      id,
      dto.content,
      req.user?.id,
      dto.isAnonymous ?? !req.user,
    );
  }

  @Post('sessions/:sessionId/questions/:questionId/upvote')
  @ApiOperation({ summary: 'Upvote a question' })
  async upvoteQuestion(
    @Param('questionId') questionId: string,
    @Request() req: { user?: { id: string } },
  ) {
    return this.qaService.upvoteQuestion(questionId, req.user?.id);
  }

  @Patch('sessions/:sessionId/questions/:questionId/answer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark question as answered' })
  async markAnswered(
    @Request() req: { user: { id: string } },
    @Param('questionId') questionId: string,
    @Body() dto: AnswerQuestionDto,
  ) {
    return this.qaService.markAnswered(questionId, req.user.id, dto.answer);
  }

  @Post('sessions/:sessionId/questions/:questionId/dismiss')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dismiss a question' })
  async dismissQuestion(
    @Request() req: { user: { id: string } },
    @Param('questionId') questionId: string,
  ) {
    return this.qaService.dismissQuestion(questionId, req.user.id);
  }

  @Post('sessions/:sessionId/questions/:questionId/pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pin a question' })
  async pinQuestion(
    @Request() req: { user: { id: string } },
    @Param('questionId') questionId: string,
  ) {
    return this.qaService.pinQuestion(questionId, req.user.id);
  }

  @Get('sessions/:id/summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get AI summary of questions' })
  async getSummary(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.qaService.summarizeQuestions(id, req.user.id);
  }
}
