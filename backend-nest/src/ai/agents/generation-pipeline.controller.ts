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
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, Subject, filter, map, takeUntil, timer } from 'rxjs';
import { GenerationPipelineService } from './generation-pipeline.service';
import { PromptInjectionGuard } from '../../security/prompt-injection.guard';
import { AIGenerationRateLimiter } from '../../security/ai-rate-limiter.guard';
import type {
  EditMemoryEntry,
  GenerationRequest,
  PresentationDocument,
} from '@shared/presentation-dsl';

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
  brandKitId?: string;
  projectId?: string;
  persist?: boolean;
  additionalContext?: string;
  qualityTier?: 'fast' | 'balanced' | 'premium';
  regenerateSlideIds?: string[];
  editMemory?: EditMemoryEntry[];
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
      length: Math.min(dto.length || 10, 30),
      editMemory: dto.editMemory || [],
      projectId: dto.projectId,
      userId,
    };

    this.logger.log(
      `Generation started for user ${userId}: "${request.topic}"`,
    );

    const result = await this.pipeline.generate(request);

    this.eventBus.next({
      sessionId: result.document.id,
      userId,
      event: {
        status: 'complete',
        progress: 100,
        agent: 'Pipeline',
        message: `Complete! Quality: ${result.qa.overallScore}/100`,
      },
    });

    return {
      success: true,
      sessionId: result.document.id,
      projectId: result.document.id,
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
   * Regenerate specific slides while preserving pinned blocks and edit memory.
   */
  @Post('partial')
  @UseGuards(PromptInjectionGuard, AIGenerationRateLimiter)
  async regeneratePartial(
    @Body()
    dto: GenerateDto & {
      slideIds: string[];
      existingDocumentId?: string;
      existingDocument?: PresentationDocument;
      projectId?: string;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!dto.slideIds?.length) {
      throw new BadRequestException(
        'slideIds required for partial regeneration',
      );
    }

    const projectId = dto.projectId || dto.existingDocumentId;
    let existingDocument = dto.existingDocument;
    if (!existingDocument && projectId) {
      existingDocument =
        (await this.pipeline.getCachedDocument(projectId)) || undefined;
    }

    if (!existingDocument) {
      throw new NotFoundException(
        'existingDocument, projectId, or cached existingDocumentId required',
      );
    }

    const userId = req.user?.id || 'anonymous';
    const topic =
      dto.topic?.trim() ||
      existingDocument.title ||
      existingDocument.metadata.summary;

    if (!topic || topic.length < 3) {
      throw new BadRequestException(
        'Topic must be at least 3 characters for regeneration',
      );
    }

    const request: GenerationRequest = {
      ...dto,
      topic,
      length: dto.length || existingDocument.metadata.totalSlides,
      regenerateSlideIds: dto.slideIds,
      editMemory: dto.editMemory || existingDocument.editMemory || [],
      projectId: projectId || existingDocument.id,
      userId,
    };

    this.logger.log(
      `Partial regeneration for user ${userId}: ${dto.slideIds.length} slides`,
    );

    const result = await this.pipeline.regeneratePartial(
      request,
      existingDocument,
    );

    return {
      success: true,
      projectId: result.document.id,
      document: result.document,
      quality: result.qa,
      regeneratedSlides: dto.slideIds,
      metrics: {
        totalDurationMs: result.totalDurationMs,
        tokenUsage: result.tokenUsage,
        qualityScore: result.qa.overallScore,
      },
    };
  }

  /**
   * GET /api/v2/generate/:sessionId/progress
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
    const timeout$ = timer(5 * 60 * 1000);

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
