/**
 * Generation Pipeline Controller
 *
 * REST + SSE endpoints for the AI presentation generation engine.
 * Protected by JWT auth, prompt injection guard, and AI rate limiter.
 */
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Sse,
  UseGuards,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, Subject, filter, map, takeUntil, timer } from 'rxjs';
import { GenerationPipelineService } from './generation-pipeline.service';
import { PromptInjectionGuard } from '../../security/prompt-injection.guard';
import { AIGenerationRateLimiter } from '../../security/ai-rate-limiter.guard';
import type { GenerationRequest } from '@shared/presentation-dsl';

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string; subscriptionTier?: string };
}

interface GenerateDto {
  topic: string;
  audience?: string;
  tone?: string;
  length?: number;
  style?: 'professional' | 'creative' | 'academic' | 'casual' | 'bold';
  templateType?:
    | 'pitch-deck'
    | 'training'
    | 'report'
    | 'sales'
    | 'product-launch'
    | 'case-study'
    | 'keynote';
  generateImages?: boolean;
  imageSource?: 'ai' | 'stock';
  themeId?: string;
  additionalContext?: string;
  qualityTier?: 'fast' | 'balanced' | 'premium';
  regenerateSlideIds?: string[];
  brandGuidelines?: {
    colors?: string[];
    fonts?: string[];
    tone?: string;
    logos?: string[];
    restrictions?: string[];
  };
}

@Controller('api/v2/generate')
export class GenerationPipelineController {
  private readonly logger = new Logger(GenerationPipelineController.name);

  /** Subject for broadcasting generation events */
  private readonly eventBus = new Subject<{
    sessionId: string;
    userId: string;
    event: unknown;
  }>();

  constructor(private readonly pipeline: GenerationPipelineService) {}

  /**
   * POST /api/v2/generate
   * Start a new presentation generation.
   * Protected by prompt injection guard and AI rate limiter.
   */
  @Post()
  @UseGuards(PromptInjectionGuard, AIGenerationRateLimiter)
  async generate(@Body() dto: GenerateDto, @Req() req: AuthenticatedRequest) {
    if (!dto.topic || dto.topic.trim().length < 3) {
      throw new BadRequestException('Topic must be at least 3 characters');
    }

    if (dto.topic.length > 500) {
      throw new BadRequestException('Topic must be 500 characters or less');
    }

    const userId = req.user?.id || 'anonymous';

    const request: GenerationRequest = {
      ...dto,
      topic: dto.topic.trim(),
      length: Math.min(dto.length || 10, 30), // cap at 30 slides
      userId,
    };

    this.logger.log(
      `🚀 Generation started for user ${userId}: "${request.topic}"`,
    );

    const result = await this.pipeline.generate(request);

    return {
      success: true,
      sessionId: result.document.id,
      document: result.document,
      quality: result.qa,
      metrics: {
        totalDurationMs: result.totalDurationMs,
        tokenUsage: result.tokenUsage,
        totalSlides: result.document.metadata.totalSlides,
        qualityScore: result.qa.overallScore,
      },
    };
  }

  /**
   * POST /api/v2/generate/partial
   * Regenerate specific slides while preserving the rest.
   */
  @Post('partial')
  @UseGuards(PromptInjectionGuard, AIGenerationRateLimiter)
  async regeneratePartial(
    @Body()
    dto: GenerateDto & { slideIds: string[]; existingDocumentId: string },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!dto.slideIds?.length) {
      throw new BadRequestException(
        'slideIds required for partial regeneration',
      );
    }

    const userId = req.user?.id || 'anonymous';

    const request: GenerationRequest = {
      ...dto,
      topic: dto.topic.trim(),
      length: dto.length || 10,
      regenerateSlideIds: dto.slideIds,
      userId,
    };

    this.logger.log(
      `🔄 Partial regeneration for user ${userId}: ${dto.slideIds.length} slides`,
    );

    const result = await this.pipeline.generate(request);

    return {
      success: true,
      document: result.document,
      quality: result.qa,
      regeneratedSlides: dto.slideIds,
    };
  }

  /**
   * GET /api/v2/generate/:sessionId/progress
   * Get the current progress of a generation session.
   */
  @Get(':sessionId/progress')
  getProgress(@Param('sessionId') sessionId: string) {
    const progress = this.pipeline.getProgress(sessionId);
    if (!progress) {
      return { status: 'not_found' };
    }
    return progress;
  }

  /**
   * GET /api/v2/generate/:sessionId/stream
   * Server-Sent Events stream for real-time generation progress.
   */
  @Sse(':sessionId/stream')
  streamProgress(
    @Param('sessionId') sessionId: string,
  ): Observable<MessageEvent> {
    const timeout$ = timer(5 * 60 * 1000); // 5 minute timeout

    return this.eventBus.pipe(
      filter((e) => e.sessionId === sessionId),
      map(
        (e) =>
          ({
            data: JSON.stringify(e.event),
          }) as MessageEvent,
      ),
      takeUntil(timeout$),
    );
  }
}
