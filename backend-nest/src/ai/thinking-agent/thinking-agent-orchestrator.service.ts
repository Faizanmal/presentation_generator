import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PlannerAgentService } from './planner-agent.service';
import { GeneratorAgentService } from './generator-agent.service';
import { CriticAgentService } from './critic-agent.service';
import {
  ThinkingState,
  ThinkingPhase,
  ThinkingStep,
  EnhancedGenerationParams,
  EnhancedGenerationResult,
  EnhancedPresentation,
  PresentationPlan,
  GenerationMetadata,
} from './thinking-agent.types';

/**
 * Thinking Agent Orchestrator Service
 *
 * The main orchestrator for the multi-agent thinking loop.
 * Coordinates Planning → Generation → Reflection → Refinement cycles
 * until quality targets are met or max iterations reached.
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    THINKING LOOP                                │
 * │                                                                 │
 * │    ┌──────────┐     ┌───────────┐     ┌──────────┐             │
 * │    │ PLANNER  │ ──▶ │ GENERATOR │ ──▶ │  CRITIC  │             │
 * │    │  Agent   │     │   Agent   │     │  Agent   │             │
 * │    └──────────┘     └───────────┘     └──────────┘             │
 * │                                            │                    │
 * │                                            ▼                    │
 * │                                    ┌──────────────┐             │
 * │                                    │ Quality OK?  │             │
 * │                                    └──────────────┘             │
 * │                                      │         │                │
 * │                                 NO   │         │ YES            │
 * │                           ┌──────────┘         └──────────┐     │
 * │                           ▼                               ▼     │
 * │                    ┌──────────┐                    ┌──────────┐ │
 * │                    │ REFINE & │                    │ COMPLETE │ │
 * │                    │ LOOP BACK│                    │          │ │
 * │                    └──────────┘                    └──────────┘ │
 * └─────────────────────────────────────────────────────────────────┘
 */
import { ResearchAgentService } from './research-agent.service';

@Injectable()
export class ThinkingAgentOrchestratorService {
  private readonly logger = new Logger(ThinkingAgentOrchestratorService.name);

  constructor(
    private readonly plannerAgent: PlannerAgentService,
    private readonly generatorAgent: GeneratorAgentService,
    private readonly criticAgent: CriticAgentService,
    private readonly researchAgent: ResearchAgentService,
  ) {}

  // Token budget limits per quality level (to prevent runaway costs)
  private readonly TOKEN_BUDGETS = {
    standard: 15000,
    high: 35000,
    premium: 60000,
  };

  /**
   * Generate a presentation using the full thinking loop
   * With token budget limits and smart early stopping
   */
  async generateWithThinking(
    params: EnhancedGenerationParams,
  ): Promise<EnhancedGenerationResult> {
    const sessionId = uuidv4();
    const startTime = Date.now();

    // Apply conservative defaults and caps
    const maxIterations = Math.min(params.maxThinkingIterations || 2, 3); // Cap at 3
    const targetQualityScore = Math.min(params.targetQualityScore || 7.0, 8.5); // Cap at 8.5 (9+ is unrealistic)
    const tokenBudget =
      this.TOKEN_BUDGETS[params.qualityLevel || 'high'] ||
      this.TOKEN_BUDGETS.high;

    const state: ThinkingState = {
      sessionId,
      currentPhase: 'planning',
      steps: [],
      iterations: 0,
      maxIterations,
      qualityScore: 0,
      targetQualityScore,
      startTime: new Date(),
    };

    let totalTokens = 0;
    let presentation: EnhancedPresentation | null = null;
    let plan: PresentationPlan | null = null;
    const fallbackUsed = false;
    let lastQualityScore = 0;
    let noImprovementCount = 0;
    let lastReflectionResult: Awaited<
      ReturnType<typeof this.criticAgent.reflect>
    > | null = null;

    this.logger.log(`🧠 Starting Thinking Loop [Session: ${sessionId}]`);
    this.logger.log(
      `📊 Target Quality: ${targetQualityScore}/10, Max Iterations: ${maxIterations}`,
    );
    this.logger.log(`💰 Token Budget: ${tokenBudget.toLocaleString()} tokens`);

    try {
      // ===========================
      // PHASE 1: PLANNING
      // ===========================
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.log('📋 PHASE 1: PLANNING');
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      state.currentPhase = 'planning';
      const planningResult = await this.plannerAgent.createPlan(params);
      plan = planningResult.plan;
      state.steps.push(...planningResult.thinkingSteps);
      totalTokens += planningResult.thinkingSteps.length * 500; // Estimate

      this.logPhaseComplete('Planning', planningResult.thinkingSteps.length);

      // ===========================
      // PHASE 1.5: RESEARCH (Optional)
      // ===========================
      let researchData = params.rawData || '';

      // If no raw data provided, and topic is complex/factual, conduct research
      if (
        !params.rawData &&
        params.topic.length > 5 &&
        !params.useThinkingMode
      ) {
        // Only skip if explicitly disabled or too simple.
        // For now, let's assume we research if permitted by config/context
        // In a real app, we'd check a flag or the Planner's recommendation
        try {
          this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          this.logger.log('🔍 PHASE 1.5: RESEARCH');
          this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          state.currentPhase = 'research';

          const researchResult = await this.researchAgent.conductResearch(
            params.topic,
            plan.keyMessages.slice(0, 3), // Focus on top 3 key messages
          );

          if (researchResult.summary && researchResult.sources.length > 0) {
            researchData = `RESEARCH SUMMARY:\n${researchResult.summary}\n\nKEY DATA POINTS:\n${researchResult.dataPoints.join('\n')}\n\nSOURCES:\n${researchResult.sources.join('\n')}`;

            state.steps.push({
              stepNumber: state.steps.length + 1,
              phase: 'research',
              thought: `Conducted web research on "${params.topic}" to ensure factual accuracy. Found ${researchResult.sources.length} sources.`,
              action: 'Web Research',
              observation: `Key data points: ${researchResult.dataPoints.length} found.`,
              timestamp: new Date(),
            });
            this.logger.log(
              `✅ Research complete: ${researchResult.sources.length} sources found`,
            );
          }
        } catch (error) {
          this.logger.warn(
            `Research phase failed (non-critical): ${error.message}`,
          );
        }
      }

      // ===========================
      // PHASE 2-4: GENERATION → REFLECTION → REFINEMENT LOOP
      // ===========================
      while (state.iterations < state.maxIterations) {
        state.iterations++;
        this.logger.log(
          `\n🔄 === ITERATION ${state.iterations}/${state.maxIterations} ===`,
        );

        // ===========================
        // PHASE 2: GENERATION
        // ===========================
        this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        this.logger.log('✍️ PHASE 2: GENERATION');
        this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        state.currentPhase = 'generation';

        if (state.iterations === 1) {
          // First iteration: generate from scratch
          const generationResult =
            await this.generatorAgent.generatePresentation(plan, params.topic, {
              tone: params.tone,
              style: params.style,
              generateImages: params.generateImages,
              rawData: researchData, // Pass the combined research data
            });
          presentation = generationResult.presentation;
          state.steps.push(...generationResult.thinkingSteps);
          totalTokens += generationResult.tokensUsed;
        } else if (presentation) {
          // Subsequent iterations: refine existing presentation
          // (Refinements are applied at the end of the loop)
        }

        if (!presentation) {
          throw new Error('Generation failed to produce a presentation');
        }

        this.logPhaseComplete('Generation', presentation.sections.length);

        // ===========================
        // PHASE 3: REFLECTION
        // ===========================
        this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        this.logger.log('🔍 PHASE 3: REFLECTION');
        this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        state.currentPhase = 'reflection';
        const reflectionResult = await this.criticAgent.reflect(
          presentation,
          plan,
          params.topic,
        );
        state.steps.push(...reflectionResult.thinkingSteps);
        totalTokens += reflectionResult.tokensUsed;
        state.qualityScore = reflectionResult.reflection.overallScore;

        this.logger.log(
          `📊 Quality Score: ${state.qualityScore.toFixed(1)}/10`,
        );
        this.logger.log(
          `✅ Strengths: ${reflectionResult.reflection.strengths.length}`,
        );
        this.logger.log(
          `⚠️ Weaknesses: ${reflectionResult.reflection.weaknesses.length}`,
        );
        this.logger.log(
          `💡 Improvements: ${reflectionResult.reflection.improvements.length}`,
        );

        // Store for final report (avoid re-reflecting at the end)
        lastReflectionResult = reflectionResult;

        // Check if we've reached quality target
        if (state.qualityScore >= state.targetQualityScore) {
          this.logger.log(
            `\n🎉 Quality target reached! Score: ${state.qualityScore.toFixed(1)}/10`,
          );
          state.currentPhase = 'complete';
          break;
        }

        // Check if we should continue refining
        if (!reflectionResult.reflection.shouldRefine) {
          this.logger.log(
            `\n✅ No further refinements needed. Final score: ${state.qualityScore.toFixed(1)}/10`,
          );
          state.currentPhase = 'complete';
          break;
        }

        // Check if we have iterations left
        if (state.iterations >= state.maxIterations) {
          this.logger.log(
            `\n⏱️ Max iterations reached. Final score: ${state.qualityScore.toFixed(1)}/10`,
          );
          state.currentPhase = 'complete';
          break;
        }

        // SMART EARLY STOPPING: Check for quality plateau
        const scoreImprovement = state.qualityScore - lastQualityScore;
        if (state.iterations > 1 && scoreImprovement < 0.3) {
          noImprovementCount++;
          this.logger.log(
            `⚠️ Minimal improvement detected (+${scoreImprovement.toFixed(2)}). Plateau count: ${noImprovementCount}/2`,
          );
          if (noImprovementCount >= 2) {
            this.logger.log(
              `\n🛑 Early stopping: Quality plateaued. Final score: ${state.qualityScore.toFixed(1)}/10`,
            );
            state.currentPhase = 'complete';
            break;
          }
        } else {
          noImprovementCount = 0; // Reset if we see improvement
        }
        lastQualityScore = state.qualityScore;

        // TOKEN BUDGET CHECK
        if (totalTokens >= tokenBudget) {
          this.logger.log(
            `\n💰 Token budget exhausted (${totalTokens.toLocaleString()}/${tokenBudget.toLocaleString()}). Final score: ${state.qualityScore.toFixed(1)}/10`,
          );
          state.currentPhase = 'complete';
          break;
        }
        this.logger.log(
          `💰 Token usage: ${totalTokens.toLocaleString()}/${tokenBudget.toLocaleString()}`,
        );

        // ===========================
        // PHASE 4: REFINEMENT
        // ===========================
        this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        this.logger.log('🔧 PHASE 4: REFINEMENT');
        this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        state.currentPhase = 'refinement';

        const highPriorityImprovements =
          reflectionResult.reflection.improvements.filter(
            (i) => i.priority === 'high' || i.priority === 'medium',
          );

        if (highPriorityImprovements.length > 0) {
          this.logger.log(
            `🔧 Applying ${highPriorityImprovements.length} improvements...`,
          );

          const refinementResult = await this.generatorAgent.applyRefinements(
            presentation,
            highPriorityImprovements,
          );
          presentation = refinementResult.presentation;
          state.steps.push(...refinementResult.thinkingSteps);
          totalTokens += refinementResult.tokensUsed;

          this.logPhaseComplete('Refinement', highPriorityImprovements.length);
        } else {
          this.logger.log('No high-priority improvements to apply.');
        }
      }

      // ===========================
      // FINALIZATION
      // ===========================
      state.endTime = new Date();
      const totalTimeMs = Date.now() - startTime;

      // Use the last reflection result instead of re-reflecting (saves tokens!)
      const qualityReport = lastReflectionResult
        ? this.criticAgent.generateQualityReport(
            lastReflectionResult.reflection,
          )
        : {
            overallScore: state.qualityScore * 10,
            breakdown: {
              contentQuality: 70,
              structureQuality: 70,
              engagementPotential: 70,
              visualRichness: 70,
              audienceAlignment: 70,
              originality: 70,
            },
            suggestions: [],
            comparisonToTarget: (state.qualityScore / 8) * 100,
            passedThreshold: state.qualityScore >= state.targetQualityScore,
          };

      const metadata: GenerationMetadata = {
        totalTokensUsed: totalTokens,
        thinkingIterations: state.iterations,
        totalTimeMs,
        modelUsed: 'gpt-4o / llama-3.3-70b-versatile',
        fallbackUsed,
        generateImages: params.generateImages,
      };

      this.logger.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.log('🏁 THINKING LOOP COMPLETE');
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.log(
        `📊 Final Quality Score: ${state.qualityScore.toFixed(1)}/10`,
      );
      this.logger.log(`🔄 Total Iterations: ${state.iterations}`);
      this.logger.log(`📝 Total Steps: ${state.steps.length}`);
      this.logger.log(`⏱️ Total Time: ${(totalTimeMs / 1000).toFixed(1)}s`);
      this.logger.log(`💰 Tokens Used: ${totalTokens.toLocaleString()}`);

      return {
        presentation: presentation!,
        thinkingProcess: state,
        qualityReport,
        metadata,
      };
    } catch (error) {
      this.logger.error('Thinking loop failed', error);
      throw error;
    }
  }

  /**
   * Quick generation without full thinking loop (for comparison)
   */
  async generateQuick(
    params: EnhancedGenerationParams,
  ): Promise<EnhancedGenerationResult> {
    const sessionId = uuidv4();
    const startTime = Date.now();

    this.logger.log(`⚡ Quick generation mode [Session: ${sessionId}]`);

    const state: ThinkingState = {
      sessionId,
      currentPhase: 'generation',
      steps: [],
      iterations: 1,
      maxIterations: 1,
      qualityScore: 0,
      targetQualityScore: params.targetQualityScore || 7.5,
      startTime: new Date(),
    };

    // Simplified planning
    const quickPlan: PresentationPlan = {
      mainObjective: params.topic,
      targetAudience: {
        type: params.audience || 'general',
        knowledgeLevel: 'intermediate',
        interests: [],
        painPoints: [],
        expectedOutcome: `Learn about ${params.topic}`,
      },
      contentStrategy: {
        narrativeArc: 'Problem-Solution',
        hookType: 'question',
        conclusionStyle: 'call-to-action',
        dataUsage: 'moderate',
        storytellingApproach: 'Clear and engaging',
      },
      structurePlan: {
        openingSlides: 1,
        contentSlides: (params.length || 6) - 2,
        dataSlides: 1,
        closingSlides: 1,
        transitionPoints: ['After introduction', 'Before conclusion'],
      },
      visualStrategy: {
        colorMood: 'professional',
        imageStyle: 'photography',
        chartPreference: 'clean-minimal',
        layoutVariety: ['title-content', 'two-column', 'image-right'],
      },
      estimatedSlides: params.length || 6,
      keyMessages: [params.topic],
      potentialChallenges: [],
    };

    state.steps.push({
      stepNumber: 1,
      phase: 'planning',
      thought: 'Quick planning with minimal analysis',
      action: 'Quick plan creation',
      observation: `Created plan for ${quickPlan.estimatedSlides} slides`,
      timestamp: new Date(),
    });

    // Generate presentation
    const generationResult = await this.generatorAgent.generatePresentation(
      quickPlan,
      params.topic,
      {
        tone: params.tone,
        style: params.style,
        generateImages: params.generateImages,
        rawData: params.rawData,
      },
    );

    state.steps.push(...generationResult.thinkingSteps);
    state.currentPhase = 'complete';
    state.endTime = new Date();

    // Quick quality assessment
    const reflectionResult = await this.criticAgent.reflect(
      generationResult.presentation,
      quickPlan,
      params.topic,
    );
    state.qualityScore = reflectionResult.reflection.overallScore;
    const qualityReport = this.criticAgent.generateQualityReport(
      reflectionResult.reflection,
    );

    const totalTimeMs = Date.now() - startTime;

    return {
      presentation: generationResult.presentation,
      thinkingProcess: state,
      qualityReport,
      metadata: {
        totalTokensUsed:
          generationResult.tokensUsed + reflectionResult.tokensUsed,
        thinkingIterations: 1,
        totalTimeMs,
        modelUsed: 'gpt-4o / llama-3.3-70b-versatile',
        fallbackUsed: false,
        generateImages: params.generateImages,
      },
    };
  }

  /**
   * Get the current phase description
   */
  getPhaseDescription(phase: ThinkingPhase): string {
    const descriptions: Record<ThinkingPhase, string> = {
      planning:
        '📋 Analyzing topic, profiling audience, and creating content strategy...',
      research: '🔍 Gathering relevant information and context...',
      generation: '✍️ Creating presentation content section by section...',
      reflection: '🔍 Evaluating quality and identifying improvements...',
      refinement: '🔧 Applying improvements and enhancing content...',
      complete: '✅ Thinking process complete!',
    };
    return descriptions[phase];
  }

  /**
   * Log phase completion
   */
  private logPhaseComplete(phase: string, count: number): void {
    this.logger.log(`✅ ${phase} complete: ${count} items processed`);
  }

  /**
   * Stream thinking progress (for real-time updates)
   */
  async *streamThinking(params: EnhancedGenerationParams): AsyncGenerator<{
    type: string;
    data: ThinkingStep | ThinkingState | EnhancedPresentation;
  }> {
    const sessionId = uuidv4();

    const state: ThinkingState = {
      sessionId,
      currentPhase: 'planning',
      steps: [],
      iterations: 0,
      maxIterations: params.maxThinkingIterations || 3,
      qualityScore: 0,
      targetQualityScore: params.targetQualityScore || 7.5,
      startTime: new Date(),
    };

    yield { type: 'state', data: state };

    // Planning phase
    state.currentPhase = 'planning';
    yield { type: 'state', data: state };

    const planningResult = await this.plannerAgent.createPlan(params);
    for (const step of planningResult.thinkingSteps) {
      state.steps.push(step);
      yield { type: 'step', data: step };
    }

    // Generation phase
    state.currentPhase = 'generation';
    yield { type: 'state', data: state };
    state.iterations = 1;

    const generationResult = await this.generatorAgent.generatePresentation(
      planningResult.plan,
      params.topic,
      { tone: params.tone, style: params.style, rawData: params.rawData },
    );

    for (const step of generationResult.thinkingSteps) {
      state.steps.push(step);
      yield { type: 'step', data: step };
    }

    // Reflection phase
    state.currentPhase = 'reflection';
    yield { type: 'state', data: state };

    const reflectionResult = await this.criticAgent.reflect(
      generationResult.presentation,
      planningResult.plan,
      params.topic,
    );

    for (const step of reflectionResult.thinkingSteps) {
      state.steps.push(step);
      yield { type: 'step', data: step };
    }

    state.qualityScore = reflectionResult.reflection.overallScore;

    // Check for refinement
    if (
      reflectionResult.reflection.shouldRefine &&
      state.iterations < state.maxIterations
    ) {
      state.currentPhase = 'refinement';
      yield { type: 'state', data: state };

      const improvements = reflectionResult.reflection.improvements.filter(
        (i) => i.priority === 'high' || i.priority === 'medium',
      );

      if (improvements.length > 0) {
        const refinementResult = await this.generatorAgent.applyRefinements(
          generationResult.presentation,
          improvements,
        );

        for (const step of refinementResult.thinkingSteps) {
          state.steps.push(step);
          yield { type: 'step', data: step };
        }

        yield { type: 'presentation', data: refinementResult.presentation };
      }
    }

    state.currentPhase = 'complete';
    state.endTime = new Date();
    yield { type: 'state', data: state };
    yield { type: 'presentation', data: generationResult.presentation };
  }
}
