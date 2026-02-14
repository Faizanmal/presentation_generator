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
} from '@nestjs/common';
import { Observable, from, map, catchError, of } from 'rxjs';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ThinkingAgentOrchestratorService } from './thinking-agent-orchestrator.service';
import { ThinkingProjectService } from './thinking-project.service';
import {
  EnhancedGenerationParams,
  EnhancedGenerationResult,
} from './thinking-agent.types';

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
  @HttpCode(HttpStatus.OK)
  async generateWithThinking(
    @CurrentUser() user: { id: string },
    @Body() body: ThinkingGenerationDto,
  ): Promise<any> { // Using any for now, will type properly
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

    const result = await this.orchestrator.generateWithThinking(params);

    // Transform to frontend expected format
    const transformedResult = {
      presentation: this.transformPresentation(result.presentation),
      qualityReport: this.transformQualityReport(result.qualityReport),
      thinkingSteps: result.thinkingProcess.steps,
      thinkingProcess: {
        steps: result.thinkingProcess.steps,
      },
      metadata: {
        totalIterations: result.thinkingProcess.iterations,
        totalTokensUsed: result.metadata.totalTokensUsed,
        generationTimeMs: result.metadata.totalTimeMs,
        qualityImprovement: result.qualityReport.overallScore / 10 - 7, // Rough estimate
      },
    };

    return transformedResult;
  }

  /**
   * Quick generation without full thinking loop
   * Faster but potentially lower quality
   */
  @Post('generate/quick')
  @HttpCode(HttpStatus.OK)
  async generateQuick(
    @CurrentUser() user: { id: string },
    @Body() body: ThinkingGenerationDto,
  ): Promise<any> {
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

    // Transform to frontend expected format
    const transformedResult = {
      presentation: this.transformPresentation(result.presentation),
      qualityReport: this.transformQualityReport(result.qualityReport),
      thinkingSteps: result.thinkingProcess.steps,
      thinkingProcess: {
        steps: result.thinkingProcess.steps,
      },
      metadata: {
        totalIterations: result.thinkingProcess.iterations,
        totalTokensUsed: result.metadata.totalTokensUsed,
        generationTimeMs: result.metadata.totalTimeMs,
        qualityImprovement: 0, // Quick mode doesn't improve
      },
    };

    return transformedResult;
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
    @CurrentUser() user: { id: string },
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
  @HttpCode(HttpStatus.CREATED)
  async generateAndCreateProject(
    @CurrentUser() user: { id: string },
    @Body() body: ThinkingGenerationDto & CreateProjectDto,
  ): Promise<{
    projectId: string;
    slideCount: number;
    blockCount: number;
    qualityScore: number;
    generationTimeMs: number;
    tokensUsed: number;
  }> {
    const startTime = Date.now();

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

    const result = await this.orchestrator.generateWithThinking(params);
    const generationTimeMs = Date.now() - startTime;

    // Create project from result
    const projectResult =
      await this.projectService.createProjectFromThinkingResult(
        user.id,
        result.presentation,
        {
          title: body.title || result.presentation.title,
          description: body.description || result.presentation.metadata.summary,
          themeId: body.themeId,
        },
      );

    return {
      projectId: projectResult.projectId,
      slideCount: projectResult.slideCount,
      blockCount: projectResult.blockCount,
      qualityScore: result.qualityReport.overallScore,
      generationTimeMs,
      tokensUsed: result.metadata.totalTokensUsed,
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
    },
  ): Promise<{
    projectId: string;
    slideCount: number;
    blockCount: number;
  }> {
    return this.projectService.createProjectFromThinkingResult(
      user.id,
      body.presentation,
      {
        title: body.title,
        description: body.description,
        themeId: body.themeId,
      },
    );
  }

  private transformPresentation(presentation: any): any {
    return {
      title: presentation.title,
      subtitle: presentation.subtitle,
      sections: presentation.sections.map((section: any) => ({
        id: section.id,
        heading: section.heading,
        subheading: section.subheading,
        blocks: section.blocks.map((block: any) => ({
          id: block.id,
          type: block.type,
          content: block.content,
          formatting: block.formatting,
          chartData: block.chartData,
        })),
        layout: section.layout,
        suggestedImage: section.suggestedImage,
        speakerNotes: section.speakerNotes,
        transition: section.transition,
        duration: section.duration,
      })),
      metadata: {
        estimatedDuration: presentation.metadata?.estimatedDuration || 10,
        keywords: presentation.metadata?.keywords || [],
        summary: presentation.metadata?.summary || '',
        difficulty: presentation.metadata?.difficulty || 'intermediate',
        category: presentation.metadata?.category || 'presentation',
      },
    };
  }

  private transformQualityReport(qualityReport: any): any {
    const breakdown = qualityReport.breakdown;
    const categoryScores = [
      {
        criterion: 'Content Quality',
        score: breakdown.contentQuality / 10,
        maxScore: 10,
        feedback: `Content quality score: ${breakdown.contentQuality}/100`,
      },
      {
        criterion: 'Structure Quality',
        score: breakdown.structureQuality / 10,
        maxScore: 10,
        feedback: `Structure quality score: ${breakdown.structureQuality}/100`,
      },
      {
        criterion: 'Engagement Potential',
        score: breakdown.engagementPotential / 10,
        maxScore: 10,
        feedback: `Engagement potential score: ${breakdown.engagementPotential}/100`,
      },
      {
        criterion: 'Visual Richness',
        score: breakdown.visualRichness / 10,
        maxScore: 10,
        feedback: `Visual richness score: ${breakdown.visualRichness}/100`,
      },
      {
        criterion: 'Audience Alignment',
        score: breakdown.audienceAlignment / 10,
        maxScore: 10,
        feedback: `Audience alignment score: ${breakdown.audienceAlignment}/100`,
      },
      {
        criterion: 'Originality',
        score: breakdown.originality / 10,
        maxScore: 10,
        feedback: `Originality score: ${breakdown.originality}/100`,
      },
    ];

    const improvements = qualityReport.suggestions.map((suggestion: string, index: number) => ({
      area: `Area ${index + 1}`,
      currentState: 'Current implementation',
      suggestedChange: suggestion,
      priority: 'medium' as const,
      affectedSections: [],
    }));

    return {
      overallScore: qualityReport.overallScore / 10, // Convert from 1-100 to 1-10 scale
      categoryScores,
      improvements,
      passedQualityThreshold: qualityReport.passedThreshold,
      summary: `Overall quality score: ${qualityReport.overallScore}/100`,
    };
  }
}
