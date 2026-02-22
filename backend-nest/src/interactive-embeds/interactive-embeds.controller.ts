import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';

interface AuthenticatedRequest {
  user: { id: string };
}
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  InteractiveEmbedsService,
  FormField,
  QuizQuestion,
} from './interactive-embeds.service';

// DTOs
class CreatePollDto {
  question: string;
  options: string[];
  allowMultiple?: boolean;
  showResults?: boolean;
}

class VotePollDto {
  optionIds: string[];
  voterId?: string;
}

class CreateQASessionDto {
  title: string;
  allowAnonymous?: boolean;
  moderationEnabled?: boolean;
}

class SubmitQuestionDto {
  question: string;
  authorName?: string;
}

class AnswerQuestionDto {
  answer: string;
}

class CreateFormDto {
  title: string;
  description?: string;
  fields: FormField[];
}

class SubmitFormDto {
  responses: Record<string, unknown>;
}

class CreateQuizDto {
  title: string;
  questions: Omit<QuizQuestion, 'id'>[];
  showCorrectAfterSubmit?: boolean;
  timeLimit?: number;
}

class SubmitQuizDto {
  answers: Record<string, number>;
}

class CreateWordCloudDto {
  prompt: string;
  maxResponses?: number;
}

class SubmitWordsDto {
  words: string[];
}

@Controller('interactive')
export class InteractiveEmbedsController {
  constructor(private readonly embedsService: InteractiveEmbedsService) {}

  // Polls
  @Post('poll/:projectId/:slideId')
  @UseGuards(JwtAuthGuard)
  async createPoll(
    @Param('projectId') projectId: string,
    @Param('slideId') slideId: string,
    @Body() dto: CreatePollDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.embedsService.createPoll(projectId, slideId, req.user.id, dto);
  }

  @Post('poll/:embedId/vote')
  async votePoll(@Param('embedId') embedId: string, @Body() dto: VotePollDto) {
    return this.embedsService.votePoll(embedId, dto.optionIds, dto.voterId);
  }

  // Q&A Sessions
  @Post('qa/:projectId/:slideId')
  @UseGuards(JwtAuthGuard)
  async createQASession(
    @Param('projectId') projectId: string,
    @Param('slideId') slideId: string,
    @Body() dto: CreateQASessionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.embedsService.createQASession(
      projectId,
      slideId,
      req.user.id,
      dto,
    );
  }

  @Post('qa/:embedId/question')
  async submitQuestion(
    @Param('embedId') embedId: string,
    @Body() dto: SubmitQuestionDto,
    @Request() req: Partial<AuthenticatedRequest>,
  ) {
    return this.embedsService.submitQuestion(
      embedId,
      dto.question,
      dto.authorName,
      req.user?.id,
    );
  }

  @Post('qa/:embedId/question/:questionId/upvote')
  async upvoteQuestion(
    @Param('embedId') embedId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.embedsService.upvoteQuestion(embedId, questionId);
  }

  @Post('qa/:embedId/question/:questionId/answer')
  @UseGuards(JwtAuthGuard)
  async answerQuestion(
    @Param('embedId') embedId: string,
    @Param('questionId') questionId: string,
    @Body() dto: AnswerQuestionDto,
  ) {
    return this.embedsService.answerQuestion(embedId, questionId, dto.answer);
  }

  // Forms
  @Post('form/:projectId/:slideId')
  @UseGuards(JwtAuthGuard)
  async createForm(
    @Param('projectId') projectId: string,
    @Param('slideId') slideId: string,
    @Body() dto: CreateFormDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.embedsService.createForm(projectId, slideId, req.user.id, dto);
  }

  @Post('form/:embedId/submit')
  async submitFormResponse(
    @Param('embedId') embedId: string,
    @Body() dto: SubmitFormDto,
    @Request() req: Partial<AuthenticatedRequest>,
  ) {
    return this.embedsService.submitFormResponse(
      embedId,
      dto.responses,
      req.user?.id,
    );
  }

  // Quizzes
  @Post('quiz/:projectId/:slideId')
  @UseGuards(JwtAuthGuard)
  async createQuiz(
    @Param('projectId') projectId: string,
    @Param('slideId') slideId: string,
    @Body() dto: CreateQuizDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.embedsService.createQuiz(projectId, slideId, req.user.id, dto);
  }

  @Post('quiz/:embedId/submit')
  async submitQuizAnswers(
    @Param('embedId') embedId: string,
    @Body() dto: SubmitQuizDto,
    @Request() req: Partial<AuthenticatedRequest>,
  ) {
    return this.embedsService.submitQuizAnswers(
      embedId,
      dto.answers,
      req.user?.id,
    );
  }

  // Word Clouds
  @Post('wordcloud/:projectId/:slideId')
  @UseGuards(JwtAuthGuard)
  async createWordCloud(
    @Param('projectId') projectId: string,
    @Param('slideId') slideId: string,
    @Body() dto: CreateWordCloudDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.embedsService.createWordCloud(
      projectId,
      slideId,
      req.user.id,
      dto,
    );
  }

  @Post('wordcloud/:embedId/submit')
  async submitWords(
    @Param('embedId') embedId: string,
    @Body() dto: SubmitWordsDto,
    @Request() req: Partial<AuthenticatedRequest>,
  ) {
    return this.embedsService.submitWords(embedId, dto.words, req.user?.id);
  }

  // Common endpoints
  @Get('slide/:slideId')
  async getSlideEmbeds(@Param('slideId') slideId: string) {
    return this.embedsService.getSlideEmbeds(slideId);
  }

  @Get(':embedId/analytics')
  @UseGuards(JwtAuthGuard)
  async getEmbedAnalytics(@Param('embedId') embedId: string) {
    return this.embedsService.getEmbedAnalytics(embedId);
  }
}
