/**
 * Generation Pipeline Orchestrator
 *
 * Coordinates the full multi-agent pipeline:
 * Research ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Outline ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Narrative ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Layout ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Design ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Images ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ QA
 *
 * Supports:
 * - Full generation
 * - Partial regeneration (specific slides)
 * - Edit memory (respecting user changes)
 * - Streaming progress via SSE
 * - Token budget management
 * - Quality gating
 */
import { Injectable, Logger, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { ResearchAgentService } from '../thinking-agent/research-agent.service';
import { OutlineAgentService } from './outline-agent.service';
import { NarrativeAgentService } from './narrative-agent.service';
import { LayoutAgentService } from './layout-agent.service';
import { DesignAgentService } from './design-agent.service';
import { ImageAgentService } from './image-agent.service';
import { QAAgentService } from './qa-agent.service';
import type {
  GenerationRequest,
  GenerationState,
  GenerationStatus,
  PresentationDocument,
  PresentationSection,
  PresentationSlide,
  SlideBlock,
  ResearchOutput,
  OutlineOutput,
  NarrativeOutput,
  LayoutOutput,
  DesignOutput,
  ImageOutput,
  QAOutput,
  PresentationMeta,
} from '@shared/presentation-dsl';

/** Event emitted during generation for real-time progress tracking */
export interface GenerationProgressEvent {
  sessionId: string;
  status: GenerationStatus;
  progress: number;
  agent: string;
  message: string;
  slideIndex?: number;
  timestamp: string;
}

/** Full result of the generation pipeline */
export interface PipelineResult {
  document: PresentationDocument;
  qa: QAOutput;
  progress: GenerationProgressEvent[];
  tokenUsage: Record<string, number>;
  totalDurationMs: number;
}

/** Token budget per quality tier */
const TOKEN_BUDGETS: Record<string, number> = {
  fast: 10000,
  balanced: 30000,
  premium: 60000,
};

@Injectable()
export class GenerationPipelineService {
  private readonly logger = new Logger(GenerationPipelineService.name);

  /** Active generation sessions for progress tracking */
  private readonly activeSessions = new Map<string, GenerationState>();

  constructor(
    private readonly researchAgent: ResearchAgentService,
    private readonly outlineAgent: OutlineAgentService,
    private readonly narrativeAgent: NarrativeAgentService,
    private readonly layoutAgent: LayoutAgentService,
    private readonly designAgent: DesignAgentService,
    private readonly imageAgent: ImageAgentService,
    private readonly qaAgent: QAAgentService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  /**
   * Execute the full generation pipeline.
   */
  async generate(request: GenerationRequest): Promise<PipelineResult> {
    const sessionId = uuidv4();
    const startTime = Date.now();
    const events: GenerationProgressEvent[] = [];
    const tokenUsage: Record<string, number> = {};
    const tokenBudget = TOKEN_BUDGETS[request.qualityTier || 'balanced'];
    let totalTokens = 0;

    const state: GenerationState = {
      status: 'idle',
      progress: 0,
      currentAgent: null,
      currentSlideIndex: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
      tokenUsage: {},
      regeneratedSlides: [],
    };

    this.activeSessions.set(sessionId, state);

    const emit = (
      status: GenerationStatus,
      agent: string,
      message: string,
      progress: number,
    ) => {
      state.status = status;
      state.currentAgent = agent;
      state.progress = progress;
      const event: GenerationProgressEvent = {
        sessionId,
        status,
        progress,
        agent,
        message,
        timestamp: new Date().toISOString(),
      };
      events.push(event);

      // Publish to Redis for SSE subscribers
      this.redis
        .publish(
          `generation:${request.userId}:${sessionId}`,
          JSON.stringify(event),
        )
        .catch(() => {
          /* Redis may be unavailable */
        });

      this.logger.log(`[${sessionId}] ${progress}% ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${agent}: ${message}`);
    };

    try {
      // ============================
      // STAGE 1: RESEARCH (10%)
      // ============================
      emit('researching', 'ResearchAgent', 'Gathering information...', 5);

      let research: ResearchOutput | undefined;
      try {
        const researchResult = await this.researchAgent.conductResearch(
          request.topic,
          [
            request.topic,
            `${request.topic} statistics`,
            `${request.topic} trends`,
          ],
        );
        research = {
          summary: researchResult.summary,
          keyFacts: researchResult.dataPoints,
          statistics: researchResult.dataPoints.map((dp) => ({
            label: dp,
            value: dp,
            source: researchResult.sources[0] || 'research',
            confidence: 0.8,
          })),
          sources: researchResult.sources.map((s) => ({
            title: s,
            url: s,
            snippet: '',
            credibilityScore: 0.8,
          })),
        };
        tokenUsage['ResearchAgent'] = 500; // estimate
        totalTokens += 500;
      } catch {
        this.logger.warn('Research phase skipped (non-critical)');
      }

      emit('researching', 'ResearchAgent', 'Research complete', 10);

      // ============================
      // STAGE 2: OUTLINE (25%)
      // ============================
      emit(
        'outlining',
        'OutlineAgent',
        'Creating presentation structure...',
        15,
      );

      const outlineResult = await this.outlineAgent.execute({
        request,
        research,
      });
      const outline: OutlineOutput = outlineResult.data;
      tokenUsage['OutlineAgent'] = outlineResult.tokensUsed;
      totalTokens += outlineResult.tokensUsed;

      emit(
        'outlining',
        'OutlineAgent',
        `Outline: ${outline.sections.length} sections, ${outline.estimatedSlides} slides`,
        25,
      );

      // ============================
      // STAGE 3: NARRATIVE (50%)
      // ============================
      emit('narrating', 'NarrativeAgent', 'Writing slide content...', 30);

      const narrativeResult = await this.narrativeAgent.execute({
        request,
        outline,
        research,
      });
      const narrative: NarrativeOutput = narrativeResult.data;
      tokenUsage['NarrativeAgent'] = narrativeResult.tokensUsed;
      totalTokens += narrativeResult.tokensUsed;

      const totalSlides = narrative.sections.reduce(
        (sum, s) => sum + s.slides.length,
        0,
      );
      emit(
        'narrating',
        'NarrativeAgent',
        `Content written for ${totalSlides} slides`,
        50,
      );

      // ============================
      // STAGE 4: LAYOUT (65%)
      // ============================
      emit('layouting', 'LayoutAgent', 'Designing slide layouts...', 55);

      const layoutResult = await this.layoutAgent.execute({
        outline,
        narrative,
      });
      const layout: LayoutOutput = layoutResult.data;
      tokenUsage['LayoutAgent'] = layoutResult.tokensUsed;
      totalTokens += layoutResult.tokensUsed;

      emit('layouting', 'LayoutAgent', 'Layouts assigned', 65);

      // ============================
      // STAGE 5: DESIGN (75%)
      // ============================
      emit('designing', 'DesignAgent', 'Creating visual theme...', 70);

      const designResult = await this.designAgent.execute({
        request,
        outline,
        slideCount: totalSlides,
      });
      const design: DesignOutput = designResult.data;
      tokenUsage['DesignAgent'] = designResult.tokensUsed;
      totalTokens += designResult.tokensUsed;

      emit(
        'designing',
        'DesignAgent',
        `Theme "${design.theme.name}" created`,
        75,
      );

      // ============================
      // STAGE 6: IMAGES (85%)
      // ============================
      let images: ImageOutput = { images: [] };
      if (request.generateImages && totalTokens < tokenBudget) {
        emit('imaging', 'ImageAgent', 'Generating images...', 78);

        images = await this.imageAgent.generateImages({
          request,
          narrative,
          design,
        });

        emit(
          'imaging',
          'ImageAgent',
          `${images.images.length} images generated`,
          85,
        );
      } else {
        emit('imaging', 'ImageAgent', 'Image generation skipped', 85);
      }

      // ============================
      // ASSEMBLE DOCUMENT
      // ============================
      emit('validating', 'Assembler', 'Assembling presentation...', 88);

      const document = this.assembleDocument(
        sessionId,
        request,
        outline,
        narrative,
        layout,
        design,
        images,
      );

      // ============================
      // STAGE 7: QA (100%)
      // ============================
      emit('validating', 'QAAgent', 'Running quality checks...', 92);

      const qaResult = await this.qaAgent.execute({
        request,
        presentation: document,
      });
      const qa: QAOutput = qaResult.data;
      tokenUsage['QAAgent'] = qaResult.tokensUsed;
      totalTokens += qaResult.tokensUsed;

      document.metadata.qualityScore = qa.overallScore;

      emit(
        'complete',
        'Pipeline',
        `Complete! Quality: ${qa.overallScore}/100`,
        100,
      );

      state.status = 'complete';
      state.completedAt = new Date().toISOString();
      state.tokenUsage = tokenUsage;

      // Cache the result in Redis for 1 hour
      await this.redis
        .setex(
          `gen:result:${sessionId}`,
          3600,
          JSON.stringify({ document, qa }),
        )
        .catch(() => {
          /* Redis may be unavailable */
        });

      return {
        document,
        qa,
        progress: events,
        tokenUsage,
        totalDurationMs: Date.now() - startTime,
      };
    } catch (error) {
      state.status = 'failed';
      state.error = (error as Error).message;
      emit(
        'failed',
        'Pipeline',
        `Error: ${(error as Error).message}`,
        state.progress,
      );
      throw error;
    } finally {
      // Clean up session after 5 minutes
      setTimeout(() => this.activeSessions.delete(sessionId), 5 * 60 * 1000);
    }
  }

  /**
   * Get the current progress of a generation session.
   */
  getProgress(sessionId: string): GenerationState | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Assemble all agent outputs into a unified PresentationDocument.
   */
  private assembleDocument(
    sessionId: string,
    request: GenerationRequest,
    outline: OutlineOutput,
    narrative: NarrativeOutput,
    layout: LayoutOutput,
    design: DesignOutput,
    images: ImageOutput,
  ): PresentationDocument {
    let slideGlobalIndex = 0;

    const sections: PresentationSection[] = narrative.sections.map(
      (narrativeSection, sIdx) => {
        const outlineSection = outline.sections[sIdx];

        const slides: PresentationSlide[] = narrativeSection.slides.map(
          (narrativeSlide) => {
            const currentGlobalIdx = slideGlobalIndex++;
            const layoutDecision = layout.slides[currentGlobalIdx];

            // Build blocks from narrative content
            const blocks: SlideBlock[] = [];
            let blockOrder = 0;

            // Heading block
            blocks.push({
              id: `block-${currentGlobalIdx}-${blockOrder}`,
              slideId: `slide-${currentGlobalIdx}`,
              kind: 'heading',
              content: { text: narrativeSlide.heading },
              style: {
                fontSize: '2rem',
                fontWeight: 'bold',
                color: design.theme.colors.text,
              },
              order: blockOrder++,
              source: 'ai',
              pinned: false,
            });

            // Body content
            if (narrativeSlide.bodyContent) {
              blocks.push({
                id: `block-${currentGlobalIdx}-${blockOrder}`,
                slideId: `slide-${currentGlobalIdx}`,
                kind: 'paragraph',
                content: { text: narrativeSlide.bodyContent },
                style: {
                  fontSize: '1.125rem',
                  color: design.theme.colors.text,
                },
                order: blockOrder++,
                source: 'ai',
                pinned: false,
              });
            }

            // Bullet points
            if (narrativeSlide.bulletPoints?.length) {
              blocks.push({
                id: `block-${currentGlobalIdx}-${blockOrder}`,
                slideId: `slide-${currentGlobalIdx}`,
                kind: 'bullet-list',
                content: { items: narrativeSlide.bulletPoints },
                style: { color: design.theme.colors.text },
                order: blockOrder++,
                source: 'ai',
                pinned: false,
              });
            }

            // Statistic highlight
            if (narrativeSlide.statisticHighlight) {
              blocks.push({
                id: `block-${currentGlobalIdx}-${blockOrder}`,
                slideId: `slide-${currentGlobalIdx}`,
                kind: 'statistic',
                content: {
                  label: narrativeSlide.statisticHighlight.label,
                  value: narrativeSlide.statisticHighlight.value,
                },
                style: {
                  color: design.theme.colors.primary,
                  fontSize: '3rem',
                  fontWeight: 'bold',
                },
                order: blockOrder++,
                source: 'ai',
                pinned: false,
              });
            }

            // Callout
            if (narrativeSlide.calloutText) {
              blocks.push({
                id: `block-${currentGlobalIdx}-${blockOrder}`,
                slideId: `slide-${currentGlobalIdx}`,
                kind: 'callout',
                content: { text: narrativeSlide.calloutText },
                style: {
                  backgroundColor: design.theme.colors.surface,
                  borderRadius: design.theme.effects.borderRadius,
                  padding: '1rem',
                },
                order: blockOrder++,
                source: 'ai',
                pinned: false,
              });
            }

            // Image block
            const matchingImage = images.images.find(
              (img) => img.slideIndex === currentGlobalIdx,
            );
            if (matchingImage) {
              blocks.push({
                id: `block-${currentGlobalIdx}-${blockOrder}`,
                slideId: `slide-${currentGlobalIdx}`,
                kind: 'image',
                content: {
                  url: matchingImage.imageUrl,
                  alt: narrativeSlide.suggestedVisual || narrativeSlide.heading,
                  generationPrompt: matchingImage.prompt,
                },
                style: {},
                order: blockOrder,
                source: 'ai',
                pinned: false,
              });
            }

            return {
              id: `slide-${currentGlobalIdx}`,
              sectionId: `section-${sIdx}`,
              order: currentGlobalIdx,
              layout: layoutDecision?.layout || {
                preset: 'single-column' as const,
                zones: 1,
                density: 'balanced' as const,
              },
              blocks,
              speakerNotes: narrativeSlide.speakerNotes,
              transition: { type: 'fade' as const, duration: 300 },
              aiConfidence: layoutDecision?.fitScore || 0.7,
              userEdited: false,
            };
          },
        );

        return {
          id: `section-${sIdx}`,
          order: sIdx,
          title: narrativeSection.title,
          narrativeRole: outlineSection?.narrativeRole || 'context',
          slides,
          storybeat: narrativeSection.storybeat,
        };
      },
    );

    const totalSlides = sections.reduce((sum, s) => sum + s.slides.length, 0);

    const metadata: PresentationMeta = {
      estimatedDuration: Math.ceil(totalSlides * 1.5),
      totalSlides,
      keywords: outline.sections.flatMap((s) => s.keyPoints.slice(0, 2)),
      summary: outline.narrativeArc,
      audience: request.audience || 'general',
      tone: request.tone || 'professional',
      difficulty: 'intermediate',
      category: request.templateType || 'general',
    };

    return {
      id: sessionId,
      version: 1,
      title: outline.title,
      subtitle: outline.subtitle,
      sections,
      theme: design.theme,
      metadata,
      generationState: {
        status: 'complete',
        progress: 100,
        currentAgent: null,
        currentSlideIndex: null,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        error: null,
        tokenUsage: {},
        regeneratedSlides: [],
      },
      editMemory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}
