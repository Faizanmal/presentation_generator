import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIService } from '../ai.service';
import {
  EnhancedPresentation,
  ReflectionResult,
  ReflectionCriteria,
  ImprovementSuggestion,
  ThinkingStep,
  PresentationPlan,
  QualityReport,
  QualityBreakdown,
} from './thinking-agent.types';

/**
 * Critic Agent Service
 *
 * Responsible for the REFLECTION phase of the thinking loop.
 * Critically evaluates generated content and provides detailed
 * improvement suggestions using multi-criteria analysis.
 */
@Injectable()
export class CriticAgentService {
  private readonly logger = new Logger(CriticAgentService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Perform comprehensive reflection on the generated presentation
   */
  async reflect(
    presentation: EnhancedPresentation,
    plan: PresentationPlan,
    topic: string,
  ): Promise<{
    reflection: ReflectionResult;
    thinkingSteps: ThinkingStep[];
    tokensUsed: number;
  }> {
    const thinkingSteps: ThinkingStep[] = [];
    let totalTokens = 0;
    const startTime = Date.now();

    // Step 1: Evaluate clarity
    this.logger.log('🔍 Step 1: Evaluating clarity...');
    const clarityResult = await this.evaluateCriteria(
      presentation,
      'clarity',
      'How clear and easy to understand is the content? Consider language simplicity, logical flow, and jargon usage.',
    );
    totalTokens += clarityResult.tokens;
    thinkingSteps.push({
      stepNumber: 1,
      phase: 'reflection',
      thought: `Clarity score: ${clarityResult.score}/10 - ${clarityResult.feedback}`,
      action: 'Clarity evaluation',
      observation: clarityResult.feedback,
      timestamp: new Date(),
    });

    // Step 2: Evaluate relevance
    this.logger.log('🔍 Step 2: Evaluating relevance...');
    const relevanceResult = await this.evaluateCriteria(
      presentation,
      'relevance',
      `How relevant is the content to the topic "${topic}" and the target audience "${plan.targetAudience.type}"?`,
    );
    totalTokens += relevanceResult.tokens;
    thinkingSteps.push({
      stepNumber: 2,
      phase: 'reflection',
      thought: `Relevance score: ${relevanceResult.score}/10 - ${relevanceResult.feedback}`,
      action: 'Relevance evaluation',
      observation: relevanceResult.feedback,
      timestamp: new Date(),
    });

    // Step 3: Evaluate engagement
    this.logger.log('🔍 Step 3: Evaluating engagement potential...');
    const engagementResult = await this.evaluateCriteria(
      presentation,
      'engagement',
      'How engaging is this presentation? Consider hooks, storytelling, visual variety, and audience interaction potential.',
    );
    totalTokens += engagementResult.tokens;
    thinkingSteps.push({
      stepNumber: 3,
      phase: 'reflection',
      thought: `Engagement score: ${engagementResult.score}/10 - ${engagementResult.feedback}`,
      action: 'Engagement evaluation',
      observation: engagementResult.feedback,
      timestamp: new Date(),
    });

    // Step 4: Evaluate structure
    this.logger.log('🔍 Step 4: Evaluating structure...');
    const structureResult = await this.evaluateStructure(presentation, plan);
    totalTokens += structureResult.tokens;
    thinkingSteps.push({
      stepNumber: 4,
      phase: 'reflection',
      thought: `Structure score: ${structureResult.score}/10 - ${structureResult.feedback}`,
      action: 'Structure evaluation',
      observation: structureResult.feedback,
      timestamp: new Date(),
    });

    // Step 5: Evaluate visual appeal
    this.logger.log('🔍 Step 5: Evaluating visual strategy...');
    const visualResult = await this.evaluateVisualAppeal(
      presentation,
      plan.visualStrategy,
    );
    totalTokens += visualResult.tokens;
    thinkingSteps.push({
      stepNumber: 5,
      phase: 'reflection',
      thought: `Visual appeal score: ${visualResult.score}/10 - ${visualResult.feedback}`,
      action: 'Visual appeal evaluation',
      observation: visualResult.feedback,
      timestamp: new Date(),
    });

    // Step 6: Evaluate completeness
    this.logger.log('🔍 Step 6: Evaluating completeness...');
    const completenessResult = await this.evaluateCompleteness(
      presentation,
      plan,
    );
    totalTokens += completenessResult.tokens;
    thinkingSteps.push({
      stepNumber: 6,
      phase: 'reflection',
      thought: `Completeness score: ${completenessResult.score}/10 - ${completenessResult.feedback}`,
      action: 'Completeness evaluation',
      observation: completenessResult.feedback,
      timestamp: new Date(),
    });

    // Step 7: Evaluate audience alignment
    this.logger.log('🔍 Step 7: Evaluating audience alignment...');
    const audienceResult = await this.evaluateAudienceAlignment(
      presentation,
      plan.targetAudience,
    );
    totalTokens += audienceResult.tokens;
    thinkingSteps.push({
      stepNumber: 7,
      phase: 'reflection',
      thought: `Audience alignment score: ${audienceResult.score}/10 - ${audienceResult.feedback}`,
      action: 'Audience alignment evaluation',
      observation: audienceResult.feedback,
      timestamp: new Date(),
    });

    // Compile criteria
    const criteria: ReflectionCriteria = {
      clarity: { score: clarityResult.score, feedback: clarityResult.feedback },
      relevance: {
        score: relevanceResult.score,
        feedback: relevanceResult.feedback,
      },
      engagement: {
        score: engagementResult.score,
        feedback: engagementResult.feedback,
      },
      structure: {
        score: structureResult.score,
        feedback: structureResult.feedback,
      },
      visualAppeal: {
        score: visualResult.score,
        feedback: visualResult.feedback,
      },
      completeness: {
        score: completenessResult.score,
        feedback: completenessResult.feedback,
      },
      audienceAlignment: {
        score: audienceResult.score,
        feedback: audienceResult.feedback,
      },
    };

    // Step 8: Synthesize strengths and weaknesses
    this.logger.log('🔍 Step 8: Synthesizing analysis...');
    const synthesisResult = await this.synthesizeAnalysis(
      presentation,
      criteria,
      topic,
    );
    totalTokens += synthesisResult.tokens;

    // Step 9: Generate improvement suggestions
    this.logger.log('🔍 Step 9: Generating improvement suggestions...');
    const improvementsResult = await this.generateImprovements(
      presentation,
      criteria,
      synthesisResult.weaknesses,
      topic,
    );
    totalTokens += improvementsResult.tokens;

    thinkingSteps.push({
      stepNumber: 8,
      phase: 'reflection',
      thought: `Synthesized ${synthesisResult.strengths.length} strengths and ${synthesisResult.weaknesses.length} weaknesses`,
      action: 'Synthesis and improvement generation',
      observation: `Generated ${improvementsResult.improvements.length} improvement suggestions`,
      timestamp: new Date(),
    });

    // Calculate overall score
    const overallScore = this.calculateOverallScore(criteria);
    const shouldRefine =
      overallScore < 7.5 ||
      improvementsResult.improvements.some((i) => i.priority === 'high');

    const reflection: ReflectionResult = {
      overallScore,
      criteria,
      strengths: synthesisResult.strengths,
      weaknesses: synthesisResult.weaknesses,
      improvements: improvementsResult.improvements,
      shouldRefine,
    };

    thinkingSteps.push({
      stepNumber: 9,
      phase: 'reflection',
      thought: `Overall score: ${overallScore.toFixed(1)}/10. Should refine: ${shouldRefine}`,
      action: 'Final reflection synthesis',
      observation: `Total reflection time: ${Date.now() - startTime}ms`,
      timestamp: new Date(),
    });

    this.logger.log(
      `✅ Reflection complete: Score ${overallScore.toFixed(1)}/10 in ${Date.now() - startTime}ms`,
    );

    return { reflection, thinkingSteps, tokensUsed: totalTokens };
  }

  /**
   * Generate a quality report for external consumption
   */
  generateQualityReport(reflection: ReflectionResult): QualityReport {
    const breakdown: QualityBreakdown = {
      contentQuality:
        ((reflection.criteria.clarity.score +
          reflection.criteria.relevance.score) /
          2) *
        10,
      structureQuality: reflection.criteria.structure.score * 10,
      engagementPotential: reflection.criteria.engagement.score * 10,
      visualRichness: reflection.criteria.visualAppeal.score * 10,
      audienceAlignment: reflection.criteria.audienceAlignment.score * 10,
      originality: reflection.criteria.completeness.score * 10, // Proxy for now
    };

    return {
      overallScore: reflection.overallScore * 10,
      breakdown,
      suggestions: reflection.improvements.map(
        (i) => `${i.area}: ${i.suggestedChange}`,
      ),
      comparisonToTarget: (reflection.overallScore / 8) * 100, // 8 is default target
      passedThreshold: !reflection.shouldRefine,
    };
  }

  /**
   * Evaluate a specific criteria
   */
  private async evaluateCriteria(
    presentation: EnhancedPresentation,
    criteriaName: string,
    criteriaDescription: string,
  ): Promise<{ score: number; feedback: string; tokens: number }> {
    const prompt = `You are a presentation quality critic. Evaluate this presentation on ${criteriaName}.

PRESENTATION:
Title: ${presentation.title}
Sections: ${presentation.sections.length}
Content Summary: ${presentation.sections.map((s) => `"${s.heading}": ${s.blocks.length} blocks`).join('; ')}

Full Content:
${JSON.stringify(
  presentation.sections.map((s) => ({
    heading: s.heading,
    blocks: s.blocks.slice(0, 3),
  })),
  null,
  2,
)}

EVALUATION CRITERIA: ${criteriaDescription}

Think step by step:
1. What works well for this criteria?
2. What could be improved?
3. How does it compare to excellent presentations?

Return JSON:
{
  "reasoning": "Your step-by-step evaluation...",
  "score": 7.5,
  "feedback": "Specific, actionable feedback"
}`;

    const response = await this.callAI(prompt);
    const parsed = this.parseJSON(response.content, {
      score: 5,
      feedback: 'Unable to evaluate',
    });

    return {
      score: Math.max(1, Math.min(10, parsed.score || 5)),
      feedback: parsed.feedback || 'No feedback available',
      tokens: response.tokens,
    };
  }

  /**
   * Evaluate presentation structure against the plan
   */
  private async evaluateStructure(
    presentation: EnhancedPresentation,
    plan: PresentationPlan,
  ): Promise<{ score: number; feedback: string; tokens: number }> {
    const prompt = `You are a presentation structure expert. Evaluate how well this presentation follows the planned structure.

PLANNED STRUCTURE:
- Narrative Arc: ${plan.contentStrategy.narrativeArc}
- Hook Type: ${plan.contentStrategy.hookType}
- Conclusion Style: ${plan.contentStrategy.conclusionStyle}
- Opening Slides: ${plan.structurePlan.openingSlides}
- Content Slides: ${plan.structurePlan.contentSlides}
- Data Slides: ${plan.structurePlan.dataSlides}
- Closing Slides: ${plan.structurePlan.closingSlides}
- Key Transitions: ${plan.structurePlan.transitionPoints.join(', ')}

ACTUAL STRUCTURE:
${presentation.sections.map((s, i) => `${i + 1}. "${s.heading}" (Layout: ${s.layout}, Blocks: ${s.blocks.length})`).join('\n')}

Think step by step:
1. Does the presentation follow the narrative arc?
2. Is the hook effective?
3. Are transitions smooth?
4. Is the conclusion impactful?

Return JSON:
{
  "reasoning": "Your structural analysis...",
  "score": 7.5,
  "feedback": "Specific feedback on structure"
}`;

    const response = await this.callAI(prompt);
    const parsed = this.parseJSON(response.content, {
      score: 5,
      feedback: 'Unable to evaluate structure',
    });

    return {
      score: Math.max(1, Math.min(10, parsed.score || 5)),
      feedback: parsed.feedback || 'No feedback available',
      tokens: response.tokens,
    };
  }

  /**
   * Evaluate visual appeal and layout variety
   */
  private async evaluateVisualAppeal(
    presentation: EnhancedPresentation,
    visualStrategy: {
      colorMood: string;
      imageStyle: string;
      layoutVariety: string[];
    },
  ): Promise<{ score: number; feedback: string; tokens: number }> {
    const layouts = presentation.sections.map((s) => s.layout);
    const uniqueLayouts = new Set(layouts);
    const hasImages = presentation.sections.some((s) => s.suggestedImage);

    const prompt = `You are a presentation design critic. Evaluate the visual design strategy.

PLANNED VISUAL STRATEGY:
- Color Mood: ${visualStrategy.colorMood}
- Image Style: ${visualStrategy.imageStyle}
- Layout Variety: ${visualStrategy.layoutVariety.join(', ')}

ACTUAL VISUALS:
- Layouts Used: ${Array.from(uniqueLayouts).join(', ')}
- Layout Variety: ${uniqueLayouts.size} unique layouts out of ${layouts.length} slides
- Has Image Suggestions: ${hasImages}
- Sections with Speaker Notes: ${presentation.sections.filter((s) => s.speakerNotes).length}

Think step by step:
1. Is there enough layout variety?
2. Are images/visuals appropriately placed?
3. Does the design support the content?

Return JSON:
{
  "reasoning": "Your visual analysis...",
  "score": 7.5,
  "feedback": "Specific feedback on visuals"
}`;

    const response = await this.callAI(prompt);
    const parsed = this.parseJSON(response.content, {
      score: 5,
      feedback: 'Unable to evaluate visuals',
    });

    return {
      score: Math.max(1, Math.min(10, parsed.score || 5)),
      feedback: parsed.feedback || 'No feedback available',
      tokens: response.tokens,
    };
  }

  /**
   * Evaluate completeness of the presentation
   */
  private async evaluateCompleteness(
    presentation: EnhancedPresentation,
    plan: PresentationPlan,
  ): Promise<{ score: number; feedback: string; tokens: number }> {
    const keyMessagesCovered = plan.keyMessages.filter((km) =>
      presentation.sections.some(
        (s) =>
          s.heading.toLowerCase().includes(km.toLowerCase()) ||
          s.blocks.some((b) =>
            this.formatBlockContent(b.content)
              .toLowerCase()
              .includes(km.toLowerCase()),
          ),
      ),
    );

    const prompt = `You are a presentation completeness evaluator. Check if all important aspects are covered.

KEY MESSAGES PLANNED: ${plan.keyMessages.join('; ')}
KEY MESSAGES FOUND IN CONTENT: ${keyMessagesCovered.join('; ')}
COVERAGE: ${keyMessagesCovered.length}/${plan.keyMessages.length}

PLANNED SLIDES: ${plan.estimatedSlides}
ACTUAL SLIDES: ${presentation.sections.length}

MAIN OBJECTIVE: ${plan.mainObjective}
PRESENTATION TITLE: ${presentation.title}

Think step by step:
1. Are all key messages addressed?
2. Is there any critical information missing?
3. Is the main objective fulfilled?

Return JSON:
{
  "reasoning": "Your completeness analysis...",
  "score": 7.5,
  "feedback": "Specific feedback on completeness"
}`;

    const response = await this.callAI(prompt);
    const parsed = this.parseJSON(response.content, {
      score: 5,
      feedback: 'Unable to evaluate completeness',
    });

    return {
      score: Math.max(1, Math.min(10, parsed.score || 5)),
      feedback: parsed.feedback || 'No feedback available',
      tokens: response.tokens,
    };
  }

  /**
   * Evaluate audience alignment
   */
  private async evaluateAudienceAlignment(
    presentation: EnhancedPresentation,
    audience: {
      type: string;
      knowledgeLevel: string;
      interests: string[];
      painPoints: string[];
    },
  ): Promise<{ score: number; feedback: string; tokens: number }> {
    const prompt = `You are an audience alignment expert. Evaluate how well this presentation fits its target audience.

TARGET AUDIENCE:
- Type: ${audience.type}
- Knowledge Level: ${audience.knowledgeLevel}
- Interests: ${audience.interests.join(', ')}
- Pain Points: ${audience.painPoints.join(', ')}

PRESENTATION CONTENT:
${presentation.sections.map((s) => `"${s.heading}": ${s.blocks.map((b) => this.formatBlockContent(b.content).substring(0, 100)).join(' | ')}`).join('\n')}

Think step by step:
1. Is the language appropriate for the knowledge level?
2. Are the interests addressed?
3. Are pain points acknowledged and solved?

Return JSON:
{
  "reasoning": "Your audience alignment analysis...",
  "score": 7.5,
  "feedback": "Specific feedback on audience fit"
}`;

    const response = await this.callAI(prompt);
    const parsed = this.parseJSON(response.content, {
      score: 5,
      feedback: 'Unable to evaluate audience alignment',
    });

    return {
      score: Math.max(1, Math.min(10, parsed.score || 5)),
      feedback: parsed.feedback || 'No feedback available',
      tokens: response.tokens,
    };
  }

  /**
   * Safely convert a block's content into a searchable/display string.
   * Handles string, object shapes (e.g. { text }, { items: [] }, image/url objects), arrays and nulls.
   */
  private formatBlockContent(content: unknown): string {
    if (content == null) return '';
    if (typeof content === 'string') return content;
    if (typeof content === 'number' || typeof content === 'boolean') {
      return String(content);
    }
    if (typeof content === 'object') {
      // Common block content shapes used across the app
      const objectContent = content as Record<string, unknown>;
      if (typeof objectContent.text === 'string') return objectContent.text;
      if (Array.isArray(objectContent.items)) {
        return objectContent.items
          .map((item) =>
            typeof item === 'string' ? item : JSON.stringify(item),
          )
          .join(' ');
      }
      if (typeof objectContent.url === 'string') return objectContent.url;
      if (typeof objectContent.alt === 'string') return objectContent.alt;
      try {
        return JSON.stringify(content);
      } catch {
        return '[unserializable object]';
      }
    }
    return '';
  }

  /**
   * Synthesize strengths and weaknesses
   */
  private async synthesizeAnalysis(
    presentation: EnhancedPresentation,
    criteria: ReflectionCriteria,
    topic: string,
  ): Promise<{ strengths: string[]; weaknesses: string[]; tokens: number }> {
    const criteriaScores = Object.entries(criteria)
      .map(([name, data]) => `${name}: ${data.score}/10 - ${data.feedback}`)
      .join('\n');

    const prompt = `You are a presentation analysis synthesizer. Based on these evaluation scores, identify strengths and weaknesses.

TOPIC: ${topic}
TITLE: ${presentation.title}
SLIDES: ${presentation.sections.length}

CRITERIA SCORES:
${criteriaScores}

Synthesize into clear strengths (scores >= 7) and weaknesses (scores < 7).

Return JSON:
{
  "reasoning": "Your synthesis process...",
  "strengths": ["strength1", "strength2", ...],
  "weaknesses": ["weakness1", "weakness2", ...]
}`;

    const response = await this.callAI(prompt);
    const parsed = this.parseJSON(response.content, {
      strengths: [],
      weaknesses: [],
    });

    return {
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || [],
      tokens: response.tokens,
    };
  }

  /**
   * Generate specific improvement suggestions
   */
  private async generateImprovements(
    presentation: EnhancedPresentation,
    criteria: ReflectionCriteria,
    weaknesses: string[],
    topic: string,
  ): Promise<{ improvements: ImprovementSuggestion[]; tokens: number }> {
    if (weaknesses.length === 0) {
      return { improvements: [], tokens: 0 };
    }

    const prompt = `You are a presentation improvement specialist. Generate specific, actionable improvements.

TOPIC: ${topic}
WEAKNESSES IDENTIFIED:
${weaknesses.map((w, i) => `${i + 1}. ${w}`).join('\n')}

CURRENT SECTIONS:
${presentation.sections.map((s, i) => `${i}. "${s.heading}"`).join('\n')}

LOW SCORING CRITERIA:
${Object.entries(criteria)
  .filter(([, data]) => data.score < 7)
  .map(([name, data]) => `${name}: ${data.score}/10 - ${data.feedback}`)
  .join('\n')}

Generate specific improvements for each weakness. Be precise about what to change and where.

Return JSON:
{
  "reasoning": "Your improvement generation process...",
  "improvements": [
    {
      "area": "specific area to improve",
      "currentState": "what's wrong now",
      "suggestedChange": "exactly what to do",
      "priority": "high|medium|low",
      "affectedSections": [0, 2, 3]
    }
  ]
}`;

    const response = await this.callAI(prompt);
    const parsed = this.parseJSON(response.content, { improvements: [] });

    return {
      improvements: (parsed.improvements || []).map(
        (imp: Partial<ImprovementSuggestion>) => ({
          area: imp.area || 'General',
          currentState: imp.currentState || 'Needs improvement',
          suggestedChange: imp.suggestedChange || 'Review and enhance',
          priority:
            (imp.priority as ImprovementSuggestion['priority']) || 'medium',
          affectedSections: imp.affectedSections || [],
        }),
      ),
      tokens: response.tokens,
    };
  }

  /**
   * Calculate overall score from criteria
   */
  private calculateOverallScore(criteria: ReflectionCriteria): number {
    const weights = {
      clarity: 0.15,
      relevance: 0.15,
      engagement: 0.15,
      structure: 0.15,
      visualAppeal: 0.1,
      completeness: 0.15,
      audienceAlignment: 0.15,
    };

    let weightedSum = 0;
    for (const [key, weight] of Object.entries(weights)) {
      const criteriaKey = key as keyof ReflectionCriteria;
      weightedSum += criteria[criteriaKey].score * weight;
    }

    return Math.round(weightedSum * 10) / 10;
  }

  /**
   * Call AI with fallback
   */
  /**
   * Call AI with fallback using centralized service
   */
  private async callAI(
    prompt: string,
  ): Promise<{ content: string; tokens: number }> {
    const options = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert presentation critic and quality evaluator. Be thorough but constructive. Always respond with valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5, // Lower temperature for more consistent evaluation
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    };

    try {
      const response = await this.aiService.chatCompletion(options);
      return {
        content: response.choices[0]?.message?.content || '{}',
        tokens: response.usage?.total_tokens || 0,
      };
    } catch (error) {
      this.logger.error(`AI call failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse JSON with fallback
   */
  private parseJSON<T>(content: string, fallback: T): T {
    try {
      return JSON.parse(content) as T;
    } catch {
      this.logger.warn('Failed to parse AI response, using fallback');
      return fallback;
    }
  }
}
