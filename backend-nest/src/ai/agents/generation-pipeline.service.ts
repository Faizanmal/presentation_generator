/**
 * Generation Pipeline Orchestrator
 *
 * Coordinates the full multi-agent pipeline:
 * Research -> Outline -> Narrative -> Layout -> Design -> Images -> QA
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
import { Prisma } from '@prisma/client';
import { ResearchAgentService } from '../thinking-agent/research-agent.service';
import { OutlineAgentService } from './outline-agent.service';
import { NarrativeAgentService } from './narrative-agent.service';
import { LayoutAgentService } from './layout-agent.service';
import { DesignAgentService } from './design-agent.service';
import { ImageAgentService } from './image-agent.service';
import { QAAgentService } from './qa-agent.service';
import { BrandKitService } from '../../brand-kit/brand-kit.service';
import { PrismaService } from '../../prisma/prisma.service';
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
  EditMemoryEntry,
  BrandGuidelines,
} from '@shared/presentation-dsl';
import { getBlockFontSize, getSlidePadding } from '@shared/layout-engine';
import { assignZonesToBlocks } from './enhanced-to-dsl.mapper';

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
    private readonly brandKitService: BrandKitService,
    private readonly prisma: PrismaService,
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
    request = await this.resolveBrandGuidelines(request);
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

      this.logger.log(
        `[${sessionId}] ${progress}% ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${agent}: ${message}`,
      );
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
      const design: DesignOutput = this.forceBrandTheme(
        designResult.data,
        request.brandGuidelines,
      );
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

      let document = this.assembleDocument(
        sessionId,
        request,
        outline,
        narrative,
        layout,
        design,
        images,
      );
      document = this.applyEditMemory(document, request.editMemory || []);

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
      state.regeneratedSlides = request.regenerateSlideIds || [];

      // Prefer stable project id when persisting
      if (request.projectId) {
        document = {
          ...document,
          id: request.projectId,
        };
      }

      // Cache the result in Redis for 1 hour
      await this.cacheResult(document.id, document, qa);

      // Partial regen persists the merged document itself
      if (!request.regenerateSlideIds?.length) {
        await this.persistDocument(
          request.projectId || document.id,
          document,
          request.userId,
        );
      }

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
   * Load a cached generation result by session / document / project id.
   * Checks Redis first, then Project.dslDocument.
   */
  async getCachedDocument(
    documentId: string,
  ): Promise<PresentationDocument | null> {
    try {
      const raw = await this.redis.get(`gen:result:${documentId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { document?: PresentationDocument };
        if (parsed.document) {
          return parsed.document;
        }
      }
    } catch {
      /* Redis may be unavailable */
    }

    return this.loadPersistedDocument(documentId);
  }

  /**
   * Load PresentationDocument from Project.dslDocument.
   */
  async loadPersistedDocument(
    projectId: string,
  ): Promise<PresentationDocument | null> {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, dslDocument: true },
      });
      if (!project?.dslDocument) {
        return null;
      }
      const doc = project.dslDocument as unknown as PresentationDocument;
      return { ...doc, id: project.id };
    } catch (error) {
      this.logger.warn(
        `Failed to load dslDocument for ${projectId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Persist PresentationDocument onto a project (creates thin project if needed).
   */
  async persistDocument(
    projectId: string | undefined,
    document: PresentationDocument,
    userId?: string,
  ): Promise<string | null> {
    if (!projectId && !userId) {
      return null;
    }

    try {
      if (projectId) {
        const existing = await this.prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, ownerId: true },
        });

        if (existing) {
          if (userId && existing.ownerId !== userId) {
            this.logger.warn(
              `Skip dsl persist: user ${userId} does not own ${projectId}`,
            );
            return null;
          }

          await this.prisma.project.update({
            where: { id: projectId },
            data: {
              dslDocument: document as unknown as Prisma.InputJsonValue,
              title: document.title || undefined,
              description: document.subtitle || document.metadata.summary,
              tone: document.metadata.tone,
              audience: document.metadata.audience,
            },
          });
          return projectId;
        }
      }

      if (!userId) {
        return null;
      }

      // Create a project shell to own the DSL document
      const created = await this.prisma.project.create({
        data: {
          id: projectId || undefined,
          title: document.title,
          description: document.subtitle || document.metadata.summary,
          type: 'PRESENTATION',
          status: 'DRAFT',
          ownerId: userId,
          tone: document.metadata.tone,
          audience: document.metadata.audience,
          dslDocument: document as unknown as Prisma.InputJsonValue,
        },
      });

      // Align document id with project id
      if (created.id !== document.id) {
        const aligned = { ...document, id: created.id };
        await this.prisma.project.update({
          where: { id: created.id },
          data: {
            dslDocument: aligned as unknown as Prisma.InputJsonValue,
          },
        });
      }

      return created.id;
    } catch (error) {
      this.logger.warn(
        `Failed to persist dslDocument: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Regenerate specific slides while preserving pinned blocks and edit memory.
   */
  async regeneratePartial(
    request: GenerationRequest,
    existingDocument: PresentationDocument,
  ): Promise<PipelineResult> {
    const slideIds = request.regenerateSlideIds || [];
    if (!slideIds.length) {
      throw new Error('regenerateSlideIds required for partial regeneration');
    }

    const mergedMemory = this.mergeEditMemory(
      existingDocument.editMemory || [],
      request.editMemory || [],
    );

    const enrichedRequest: GenerationRequest = {
      ...request,
      projectId: request.projectId || existingDocument.id,
      editMemory: mergedMemory,
      topic: request.topic || existingDocument.title,
      length: request.length || existingDocument.metadata.totalSlides,
      brandGuidelines:
        request.brandGuidelines ||
        this.themeToBrandGuidelines(existingDocument.theme),
    };

    const result = await this.generate(enrichedRequest);
    const merged = this.mergePartialDocument(
      existingDocument,
      result.document,
      new Set(slideIds),
      mergedMemory,
    );

    const documentId = existingDocument.id;
    const finalDocument = {
      ...merged,
      id: documentId,
      version: existingDocument.version + 1,
    };

    await this.cacheResult(documentId, finalDocument, result.qa);
    await this.persistDocument(
      request.projectId || documentId,
      finalDocument,
      request.userId,
    );

    return {
      ...result,
      document: finalDocument,
    };
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
    const editMemory = request.editMemory || [];
    const pinnedByBlock = new Map(
      editMemory
        .filter((e) => e.pinned && e.blockId)
        .map((e) => [e.blockId!, e]),
    );
    const pinnedBySlideField = new Map(
      editMemory
        .filter((e) => e.pinned && !e.blockId)
        .map((e) => [`${e.slideId}:${e.field}`, e]),
    );

    let slideGlobalIndex = 0;

    const sections: PresentationSection[] = narrative.sections.map(
      (narrativeSection, sIdx) => {
        const outlineSection = outline.sections[sIdx];

        const slides: PresentationSlide[] = narrativeSection.slides.map(
          (narrativeSlide) => {
            const currentGlobalIdx = slideGlobalIndex++;
            const slideId = `slide-${currentGlobalIdx}`;
            const layoutDecision = layout.slides[currentGlobalIdx];

            const blocks: SlideBlock[] = [];
            let blockOrder = 0;
            const usedPlacementIndexes = new Set<number>();

            const pushBlock = (
              kind: SlideBlock['kind'],
              content: SlideBlock['content'],
              style: SlideBlock['style'],
              fieldHint: string,
            ) => {
              const blockId = `block-${currentGlobalIdx}-${blockOrder}`;
              const pinnedEntry =
                pinnedByBlock.get(blockId) ||
                pinnedBySlideField.get(`${slideId}:${fieldHint}`);
              const placements = layoutDecision?.blockPlacements || [];
              const placementIdx = placements.findIndex(
                (bp, i) => bp.blockKind === kind && !usedPlacementIndexes.has(i),
              );
              if (placementIdx >= 0) {
                usedPlacementIndexes.add(placementIdx);
              }
              const density = layoutDecision?.layout?.density || 'balanced';
              blocks.push({
                id: blockId,
                slideId,
                kind,
                content: pinnedEntry
                  ? { ...content, text: pinnedEntry.newValue }
                  : content,
                style: {
                  ...style,
                  fontSize: style.fontSize || getBlockFontSize(kind, density, design.theme),
                },
                order: blockOrder++,
                zone: placementIdx >= 0 ? placements[placementIdx].zone : undefined,
                source: pinnedEntry ? 'user' : 'ai',
                pinned: Boolean(pinnedEntry),
              });
            };

            const density = layoutDecision?.layout?.density || 'balanced';
            const slidePadding = getSlidePadding(
              density,
              design.theme.spacing?.base || 8,
            );

            pushBlock(
              'heading',
              { text: narrativeSlide.heading },
              {
                fontWeight: 'bold',
                color: design.theme.colors.text,
              },
              'heading',
            );

            if (narrativeSlide.bodyContent) {
              pushBlock(
                'paragraph',
                { text: narrativeSlide.bodyContent },
                {
                  color: design.theme.colors.text,
                },
                'body',
              );
            }

            if (narrativeSlide.bulletPoints?.length) {
              pushBlock(
                'bullet-list',
                { items: narrativeSlide.bulletPoints },
                { color: design.theme.colors.text },
                'bullets',
              );
            }

            if (narrativeSlide.statisticHighlight) {
              pushBlock(
                'statistic',
                {
                  label: narrativeSlide.statisticHighlight.label,
                  value: narrativeSlide.statisticHighlight.value,
                },
                {
                  color: design.theme.colors.primary,
                  fontWeight: 'bold',
                },
                'statistic',
              );
            }

            if (narrativeSlide.calloutText) {
              pushBlock(
                'callout',
                { text: narrativeSlide.calloutText },
                {
                  backgroundColor: design.theme.colors.surface,
                  borderRadius: design.theme.effects.borderRadius,
                  padding: `${design.theme.spacing?.base || 8}px`,
                },
                'callout',
              );
            }

            const matchingImage = images.images.find(
              (img) => img.slideIndex === currentGlobalIdx,
            );
            if (matchingImage) {
              pushBlock(
                'image',
                {
                  url: matchingImage.imageUrl,
                  alt: narrativeSlide.suggestedVisual || narrativeSlide.heading,
                  generationPrompt: matchingImage.prompt,
                },
                {},
                'image',
              );
            }

            const baseLayout = layoutDecision?.layout || {
              preset: 'single-column' as const,
              zones: 1,
              density: 'balanced' as const,
            };

            // Fill any missing zones from layout geometry (placements may be incomplete)
            assignZonesToBlocks(blocks, baseLayout);

            return {
              id: slideId,
              sectionId: `section-${sIdx}`,
              order: currentGlobalIdx,
              layout: {
                ...baseLayout,
                padding: baseLayout.padding || slidePadding,
              },
              blocks,
              speakerNotes: narrativeSlide.speakerNotes,
              transition: { type: 'fade' as const, duration: 300 },
              aiConfidence: layoutDecision?.fitScore || 0.7,
              userEdited: blocks.some((b) => b.pinned),
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

    // Place brand logo on title (first) and closing (last) slides when available
    const logoUrl = request.brandGuidelines?.logos?.[0];
    if (logoUrl) {
      const allSlides = sections.flatMap((s) => s.slides);
      const targets = [allSlides[0], allSlides[allSlides.length - 1]].filter(
        Boolean,
      ) as PresentationSlide[];
      for (const slide of targets) {
        if (slide.blocks.some((b) => b.kind === 'image' && b.content.url === logoUrl)) {
          continue;
        }
        slide.blocks.push({
          id: `block-logo-${slide.id}`,
          slideId: slide.id,
          kind: 'image',
          content: { url: logoUrl, alt: 'Brand logo' },
          style: {},
          order: slide.blocks.length,
          source: 'user',
          pinned: true,
        });
      }
    }

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
        regeneratedSlides: request.regenerateSlideIds || [],
      },
      editMemory: [...editMemory],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private async resolveBrandGuidelines(
    request: GenerationRequest,
  ): Promise<GenerationRequest> {
    if (request.brandGuidelines?.colors?.length) {
      return request;
    }

    try {
      const kit = request.brandKitId
        ? await this.brandKitService.findOne(request.brandKitId, request.userId)
        : await this.brandKitService.getDefault(request.userId);

      if (!kit) {
        return request;
      }

      const dontList = Array.isArray(kit.dontList)
        ? (kit.dontList as string[])
        : [];

      const brandGuidelines: BrandGuidelines = {
        colors: [
          kit.primaryColor,
          kit.secondaryColor,
          kit.accentColor,
          kit.backgroundColor,
          kit.textColor,
        ].filter((c): c is string => Boolean(c)),
        fonts: [kit.headingFont, kit.bodyFont].filter(
          (f): f is string => Boolean(f),
        ),
        tone:
          kit.voiceDescription ||
          (Array.isArray(kit.toneKeywords)
            ? (kit.toneKeywords as string[])[0]
            : undefined),
        logos: [kit.logoUrl, kit.logoLight, kit.logoDark].filter(
          (u): u is string => Boolean(u),
        ),
        restrictions: dontList,
      };

      return { ...request, brandGuidelines };
    } catch (error) {
      this.logger.warn(
        `Brand kit resolve skipped: ${(error as Error).message}`,
      );
      return request;
    }
  }

  private forceBrandTheme(
    design: DesignOutput,
    guidelines?: BrandGuidelines,
  ): DesignOutput {
    if (!guidelines?.colors?.length) {
      return design;
    }

    const [primary, secondary, accent, background, text] = guidelines.colors;

    return {
      ...design,
      theme: {
        ...design.theme,
        name: design.theme.name?.includes('Brand')
          ? design.theme.name
          : `${design.theme.name} (Brand)`,
        colors: {
          ...design.theme.colors,
          ...(primary && { primary }),
          ...(secondary && { secondary }),
          ...(accent && { accent }),
          ...(background && { background }),
          ...(text && { text }),
          chart: guidelines.colors.slice(0, 5).length
            ? [
                ...guidelines.colors.slice(0, 5),
                ...design.theme.colors.chart,
              ].slice(0, 5)
            : design.theme.colors.chart,
        },
        typography: {
          ...design.theme.typography,
          ...(guidelines.fonts?.[0] && {
            headingFont: guidelines.fonts[0],
          }),
          ...(guidelines.fonts?.[1] && { bodyFont: guidelines.fonts[1] }),
        },
      },
    };
  }

  private themeToBrandGuidelines(
    theme: PresentationDocument['theme'],
  ): BrandGuidelines {
    return {
      colors: [
        theme.colors.primary,
        theme.colors.secondary,
        theme.colors.accent,
        theme.colors.background,
        theme.colors.text,
      ],
      fonts: [theme.typography.headingFont, theme.typography.bodyFont],
    };
  }

  private mergeEditMemory(
    existing: EditMemoryEntry[],
    incoming: EditMemoryEntry[],
  ): EditMemoryEntry[] {
    const map = new Map<string, EditMemoryEntry>();
    for (const entry of [...existing, ...incoming]) {
      const key = `${entry.slideId}:${entry.blockId || ''}:${entry.field}`;
      map.set(key, entry);
    }
    return [...map.values()];
  }

  /**
   * Hard-apply pinned edit memory onto block content after generation.
   */
  private applyEditMemory(
    document: PresentationDocument,
    editMemory: EditMemoryEntry[],
  ): PresentationDocument {
    const pinned = editMemory.filter((e) => e.pinned);
    if (!pinned.length) {
      return { ...document, editMemory };
    }

    const sections = document.sections.map((section) => ({
      ...section,
      slides: section.slides.map((slide) => {
        const slideEntries = pinned.filter((e) => e.slideId === slide.id);
        if (!slideEntries.length) {
          return slide;
        }

        return {
          ...slide,
          userEdited: true,
          blocks: slide.blocks.map((block) => {
            const entry = slideEntries.find(
              (e) =>
                e.blockId === block.id ||
                (!e.blockId &&
                  ((e.field === 'heading' && block.kind === 'heading') ||
                    (e.field === 'body' && block.kind === 'paragraph') ||
                    (e.field === 'content' && Boolean(block.content.text)))),
            );
            if (!entry) {
              return block;
            }

            return {
              ...block,
              pinned: true,
              source: 'user' as const,
              content: {
                ...block.content,
                text: entry.newValue,
              },
            };
          }),
        };
      }),
    }));

    return {
      ...document,
      sections,
      editMemory,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Keep non-target slides from the existing deck; merge regenerated slides
   * while preserving pinned blocks.
   */
  private mergePartialDocument(
    existing: PresentationDocument,
    generated: PresentationDocument,
    regenerateIds: Set<string>,
    editMemory: EditMemoryEntry[],
  ): PresentationDocument {
    const generatedByOrder = new Map(
      generated.sections
        .flatMap((s) => s.slides)
        .map((slide) => [slide.order, slide]),
    );

    const sections = existing.sections.map((section) => ({
      ...section,
      slides: section.slides.map((slide) => {
        if (!regenerateIds.has(slide.id)) {
          return slide;
        }

        const replacement = generatedByOrder.get(slide.order);
        if (!replacement) {
          return slide;
        }

        const pinnedBlocks = slide.blocks.filter((b) => b.pinned);
        const mergedBlocks = replacement.blocks.map((block) => {
          const pinned =
            pinnedBlocks.find((p) => p.id === block.id) ||
            pinnedBlocks.find((p) => p.kind === block.kind);
          if (pinned) {
            return { ...pinned, slideId: slide.id };
          }
          return { ...block, slideId: slide.id };
        });

        for (const pinned of pinnedBlocks) {
          if (!mergedBlocks.some((b) => b.id === pinned.id)) {
            mergedBlocks.push({ ...pinned, slideId: slide.id });
          }
        }

        return {
          ...replacement,
          id: slide.id,
          sectionId: slide.sectionId,
          order: slide.order,
          blocks: mergedBlocks,
          userEdited: slide.userEdited || pinnedBlocks.length > 0,
        };
      }),
    }));

    return this.applyEditMemory(
      {
        ...existing,
        sections,
        theme: existing.theme,
        version: existing.version + 1,
        updatedAt: new Date().toISOString(),
        generationState: {
          ...generated.generationState,
          regeneratedSlides: [...regenerateIds],
        },
        editMemory,
      },
      editMemory,
    );
  }

  private async cacheResult(
    documentId: string,
    document: PresentationDocument,
    qa: QAOutput,
  ): Promise<void> {
    await this.redis
      .setex(`gen:result:${documentId}`, 3600, JSON.stringify({ document, qa }))
      .catch(() => {
        /* Redis may be unavailable */
      });
  }
}
