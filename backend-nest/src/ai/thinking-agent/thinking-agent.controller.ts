import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Sse,
  MessageEvent,
  Query,
  Get,
  Param,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Observable, from, map, catchError, of } from 'rxjs';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UsersService } from '../../users/users.service';
import { ThinkingAgentOrchestratorService } from './thinking-agent-orchestrator.service';
import { ThinkingProjectService } from './thinking-project.service';
import {
  EnhancedGenerationParams,
  EnhancedGenerationResult,
} from './thinking-agent.types';
import { ThrottleAIGeneration } from '../../common/decorators/throttle.decorator';
import {
  ThinkingGenerationJobData,
  ThinkingQueuedResponse,
} from './thinking-jobs.types';
import {
  ThinkingApiGenerationResult,
  transformThinkingGenerationResult,
} from './thinking-response.mapper';

/**
 * DTO for thinking generation request
 */
interface ThinkingGenerationDto {
  topic: string;
  tone?: 'professional' | 'casual' | 'academic' | 'creative';
  audience?: string;
  length?: number;
  type?: 'presentation' | 'document' | 'pitch-deck' | 'report';
  style?: 'professional' | 'creative' | 'academic' | 'casual';
  generateImages?: boolean;
  smartLayout?: boolean;
  qualityLevel?: 'standard' | 'high' | 'premium';
  maxIterations?: number;
  targetQualityScore?: number;
  additionalContext?: string;
  rawData?: string; // Add support for raw data input
  brandGuidelines?: {
    colors?: string[];
    fonts?: string[];
    tone?: string;
    restrictions?: string[];
  };
}

/**
 * DTO for create project from result
 */
interface CreateProjectDto {
  title?: string;
  description?: string;
  themeId?: string;
}

/**
 * Thinking Agent Controller
 *
 * Provides endpoints for the AI Thinking Loop system:
 * - Full thinking loop generation with quality optimization
 * - Quick generation for faster results
 * - Real-time streaming of thinking progress
 * - Quality comparison between modes
 * - Create project from generated result
 */
@Controller('ai/thinking')
@UseGuards(JwtAuthGuard)
export class ThinkingAgentController {
  constructor(
    private readonly orchestrator: ThinkingAgentOrchestratorService,
    private readonly projectService: ThinkingProjectService,
    private readonly usersService: UsersService,
    @InjectQueue('thinking-generation')
    private readonly thinkingGenerationQueue: Queue,
  ) {}

  /**
   * Generate a presentation using the full thinking loop
   *
   * This endpoint uses multi-step reasoning with:
   * 1. Planning: Deep topic analysis, audience profiling, content strategy
   * 2. Generation: Context-aware section creation with chain-of-thought
   * 3. Reflection: Multi-criteria quality evaluation
   * 4. Refinement: Iterative improvement until quality target is met
   */
  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ThrottleAIGeneration()
  async generateWithThinking(
    @CurrentUser() user: { id: string },
    @Body() body: ThinkingGenerationDto,
  ): Promise<ThinkingQueuedResponse> {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const params: EnhancedGenerationParams = {
      topic: body.topic,
      tone: body.tone || 'professional',
      audience: body.audience,
      length: body.length || 8,
      type: body.type || 'presentation',
      style: body.style || 'professional',
      generateImages: body.generateImages || false,
      smartLayout: body.smartLayout ?? true,
      useThinkingMode: true,
      qualityLevel: body.qualityLevel || 'high',
      maxThinkingIterations: this.getMaxIterations(body.qualityLevel),
      targetQualityScore: this.getTargetScore(body.qualityLevel),
      additionalContext: body.additionalContext,
      rawData: body.rawData,
      brandGuidelines: body.brandGuidelines,
    };

    const aiGenerationCost = Math.max(1, Math.min(body.length || 8, 20));
    const jobData: ThinkingGenerationJobData = {
      userId: user.id,
      action: 'generate',
      params,
      aiGenerationCost,
    };

    const job = await this.thinkingGenerationQueue.add(
      'thinking-generate',
      jobData,
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { age: 3600, count: 500 },
        removeOnFail: { age: 86400, count: 1000 },
      },
    );

    return {
      status: 'queued',
      jobId: String(job.id),
      message: 'Thinking generation started in background',
    };
  }

  /**
   * Quick generation without full thinking loop
   * Faster but potentially lower quality
   */
  @Post('generate/quick')
  @HttpCode(HttpStatus.OK)
  @ThrottleAIGeneration()
  async generateQuick(
    @CurrentUser() user: { id: string },
    @Body() body: ThinkingGenerationDto,
  ): Promise<ThinkingApiGenerationResult> {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const params: EnhancedGenerationParams = {
      topic: body.topic,
      tone: body.tone || 'professional',
      audience: body.audience,
      length: body.length || 6,
      type: body.type || 'presentation',
      style: body.style || 'professional',
      generateImages: body.generateImages || false,
      smartLayout: body.smartLayout ?? true,
      useThinkingMode: false,
      qualityLevel: 'standard',
      maxThinkingIterations: 1,
      targetQualityScore: 6,
    };

    const result = await this.orchestrator.generateQuick(params);
    await this.usersService.incrementAIGenerations(
      user.id,
      Math.max(1, Math.min(body.length || 6, 6)),
    );

    return transformThinkingGenerationResult(result);
  }

  /**
   * Stream the thinking process in real-time using Server-Sent Events
   *
   * This allows the frontend to show the AI's thinking process as it happens:
   * - Planning thoughts and decisions
   * - Generation progress for each section
   * - Reflection and quality scores
   * - Refinement actions
   */
  @Sse('generate/stream')
  streamThinking(
    @Query('topic') topic: string,
    @Query('tone') tone?: string,
    @Query('audience') audience?: string,
    @Query('length') length?: string,
    @Query('type') type?: string,
    @Query('qualityLevel') qualityLevel?: string,
  ): Observable<MessageEvent> {
    const params: EnhancedGenerationParams = {
      topic: topic || 'AI in Business',
      tone: tone || 'professional',
      audience,
      length: length ? parseInt(length, 10) : 8,
      type: (type as EnhancedGenerationParams['type']) || 'presentation',
      useThinkingMode: true,
      qualityLevel:
        (qualityLevel as EnhancedGenerationParams['qualityLevel']) || 'high',
      maxThinkingIterations: this.getMaxIterations(qualityLevel),
      targetQualityScore: this.getTargetScore(qualityLevel),
    };

    const generator = this.orchestrator.streamThinking(params);

    return from(this.asyncIteratorToArray(generator)).pipe(
      map((items) => items.flat()),
      map((items) =>
        items.map((item) => ({
          data: JSON.stringify(item),
          type: item.type,
        })),
      ),
      map((events) => events[events.length - 1] || { data: '{}' }),
      catchError((error) => {
        return of({ data: JSON.stringify({ error: error.message }) });
      }),
    );
  }

  /**
   * Get the current phase description for UI display
   */
  @Get('phase/:phase')
  getPhaseDescription(@Param('phase') phase: string): { description: string } {
    return {
      description: this.orchestrator.getPhaseDescription(
        phase as
          | 'planning'
          | 'research'
          | 'generation'
          | 'reflection'
          | 'refinement'
          | 'complete',
      ),
    };
  }

  /**
   * Compare quality between thinking and quick modes
   * Useful for demonstrating the value of the thinking loop
   */
  @Post('compare')
  @HttpCode(HttpStatus.OK)
  async compareQuality(
    @CurrentUser() _user: { id: string },
    @Body() body: { topic: string; audience?: string },
  ): Promise<{
    thinking: { score: number; time: number };
    quick: { score: number; time: number };
    improvement: number;
  }> {
    const baseParams: EnhancedGenerationParams = {
      topic: body.topic,
      audience: body.audience,
      length: 6,
    };

    // Run quick generation
    const quickStart = Date.now();
    const quickResult = await this.orchestrator.generateQuick(baseParams);
    const quickTime = Date.now() - quickStart;

    // Run thinking generation
    const thinkingStart = Date.now();
    const thinkingResult = await this.orchestrator.generateWithThinking({
      ...baseParams,
      qualityLevel: 'high',
    });
    const thinkingTime = Date.now() - thinkingStart;

    const improvement =
      ((thinkingResult.qualityReport.overallScore -
        quickResult.qualityReport.overallScore) /
        quickResult.qualityReport.overallScore) *
      100;

    return {
      thinking: {
        score: thinkingResult.qualityReport.overallScore,
        time: thinkingTime,
      },
      quick: {
        score: quickResult.qualityReport.overallScore,
        time: quickTime,
      },
      improvement: Math.round(improvement * 10) / 10,
    };
  }

  /**
   * Get max iterations based on quality level
   */
  private getMaxIterations(qualityLevel?: string): number {
    switch (qualityLevel) {
      case 'premium':
        return 5;
      case 'high':
        return 3;
      case 'standard':
      default:
        return 1;
    }
  }

  /**
   * Get target quality score based on quality level
   */
  private getTargetScore(qualityLevel?: string): number {
    switch (qualityLevel) {
      case 'premium':
        return 9;
      case 'high':
        return 7.5;
      case 'standard':
      default:
        return 6;
    }
  }

  /**
   * Convert async iterator to array for rxjs
   */
  private async asyncIteratorToArray<T>(
    iterator: AsyncGenerator<T>,
  ): Promise<T[]> {
    const result: T[] = [];
    for await (const item of iterator) {
      result.push(item);
    }
    return result;
  }

  /**
   * Generate a presentation and automatically create a project from it
   * This is a convenience endpoint that combines generation + project creation
   */
  @Post('generate-and-create')
  @HttpCode(HttpStatus.ACCEPTED)
  @ThrottleAIGeneration()
  async generateAndCreateProject(
    @CurrentUser() user: { id: string },
    @Body() body: ThinkingGenerationDto & CreateProjectDto,
  ): Promise<ThinkingQueuedResponse> {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const canCreate = await this.usersService.canCreateProject(user.id);
    if (!canCreate) {
      throw new ForbiddenException(
        'Project limit reached. Upgrade to create more projects.',
      );
    }

    // Generate with thinking
    const params: EnhancedGenerationParams = {
      topic: body.topic,
      tone: body.tone || 'professional',
      audience: body.audience,
      length: body.length || 8,
      type: body.type || 'presentation',
      style: body.style || 'professional',
      generateImages: body.generateImages || false,
      smartLayout: body.smartLayout ?? true,
      useThinkingMode: true,
      qualityLevel: body.qualityLevel || 'high',
      maxThinkingIterations: this.getMaxIterations(body.qualityLevel),
      targetQualityScore: this.getTargetScore(body.qualityLevel),
      additionalContext: body.additionalContext,
      rawData: body.rawData,
      brandGuidelines: body.brandGuidelines,
    };

    const aiGenerationCost = Math.max(1, Math.min(body.length || 8, 20));
    const jobData: ThinkingGenerationJobData = {
      userId: user.id,
      action: 'generate-and-create',
      params,
      aiGenerationCost,
      createProjectOptions: {
        title: body.title,
        description: body.description,
        themeId: body.themeId,
      },
    };

    const job = await this.thinkingGenerationQueue.add(
      'thinking-generate-and-create',
      jobData,
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { age: 3600, count: 500 },
        removeOnFail: { age: 86400, count: 1000 },
      },
    );

    return {
      status: 'queued',
      jobId: String(job.id),
      message: 'Thinking generation + project creation started in background',
    };
  }

  @Get('jobs/:jobId')
  @HttpCode(HttpStatus.OK)
  async getThinkingJobStatus(
    @CurrentUser() user: { id: string },
    @Param('jobId') jobId: string,
  ) {
    const job = await this.thinkingGenerationQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const jobData = job.data as ThinkingGenerationJobData;
    if (jobData.userId !== user.id) {
      throw new ForbiddenException('You cannot access this job');
    }

    const state = await job.getState();
    return {
      id: String(job.id),
      state,
      result: state === 'completed' ? this.normalizeJobResult(job) : null,
      failedReason: job.failedReason,
    };
  }

  /**
   * Create a project from an already generated presentation result
   * Used when the user generates first, previews, then decides to save
   */
  @Post('create-project')
  @HttpCode(HttpStatus.CREATED)
  async createProjectFromResult(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      presentation: EnhancedGenerationResult['presentation'];
      title?: string;
      description?: string;
      themeId?: string;
      generateImages?: boolean;
    },
  ): Promise<{
    projectId: string;
    slideCount: number;
    blockCount: number;
  }> {
    const canCreate = await this.usersService.canCreateProject(user.id);
    if (!canCreate) {
      throw new ForbiddenException(
        'Project limit reached. Upgrade to create more projects.',
      );
    }

    return this.projectService.createProjectFromThinkingResult(
      user.id,
      body.presentation,
      {
        title: body.title,
        description: body.description,
        themeId: body.themeId,
        generateImages: body.generateImages,
      },
    );
  }

  private normalizeJobResult(job: Job) {
    const returnValue = job.returnvalue as {
      kind?: string;
      result?: unknown;
    };

    if (
      returnValue?.kind &&
      Object.prototype.hasOwnProperty.call(returnValue, 'result')
    ) {
      return returnValue.result;
    }

    return returnValue;
  }
}
