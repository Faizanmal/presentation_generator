import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { AIService } from '../ai.service';
import {
  PresentationPlan,
  EnhancedPresentation,
  EnhancedSection,
  EnhancedBlock,
  ThinkingStep,
  LayoutType,
  ChartData,
} from './thinking-agent.types';

/**
 * Generator Agent Service
 *
 * Responsible for the GENERATION phase of the thinking loop.
 * Creates high-quality presentation content based on the plan,
 * using detailed chain-of-thought prompting for each section.
 */
@Injectable()
export class GeneratorAgentService {
  private readonly logger = new Logger(GeneratorAgentService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Generate a complete presentation based on the plan
   */
  async generatePresentation(
    plan: PresentationPlan,
    topic: string,
    options: {
      tone?: string;
      style?: string;
      generateImages?: boolean;
      rawData?: string;
    } = {},
  ): Promise<{
    presentation: EnhancedPresentation;
    thinkingSteps: ThinkingStep[];
    tokensUsed: number;
  }> {
    const thinkingSteps: ThinkingStep[] = [];
    let totalTokens = 0;
    const startTime = Date.now();

    // Step 1: Generate compelling title
    this.logger.log('✍️ Step 1: Generating compelling title...');
    const titleResult = await this.generateTitle(plan, topic);
    totalTokens += titleResult.tokens;
    thinkingSteps.push({
      stepNumber: 1,
      phase: 'generation',
      thought: `Generated title: "${titleResult.title}" with subtitle: "${titleResult.subtitle}"`,
      action: 'Title generation',
      observation: `Title captures the main theme: ${plan.mainObjective}`,
      timestamp: new Date(),
    });

    // Step 2: Generate each section with context awareness
    this.logger.log('✍️ Step 2: Generating sections...');
    const sections: EnhancedSection[] = [];
    const totalSections = plan.estimatedSlides;

    for (let i = 0; i < totalSections; i++) {
      const sectionType = this.determineSectionType(i, totalSections, plan);
      const previousContext = sections
        .slice(-2)
        .map((s) => s.heading)
        .join(' -> ');

      this.logger.log(
        `✍️ Generating section ${i + 1}/${totalSections}: ${sectionType}...`,
      );

      const sectionResult = await this.generateSection(plan, topic, {
        index: i,
        total: totalSections,
        type: sectionType,
        previousContext,
        tone: options.tone || 'professional',
        style: options.style || 'professional',
        keyMessage: plan.keyMessages[i % plan.keyMessages.length],
        rawData: options.rawData,
      });

      sections.push(sectionResult.section);
      totalTokens += sectionResult.tokens;

      thinkingSteps.push({
        stepNumber: 2 + i,
        phase: 'generation',
        thought: `Generated ${sectionType} section: "${sectionResult.section.heading}" with ${sectionResult.section.blocks.length} blocks`,
        action: `Section ${i + 1} generation`,
        observation: `Layout: ${sectionResult.section.layout}, Duration: ~${sectionResult.section.duration || 60}s`,
        timestamp: new Date(),
      });
    }

    // Step 3: Generate metadata
    this.logger.log('✍️ Step 3: Generating presentation metadata...');
    const metadata = this.generateMetadata(plan, sections, topic);

    thinkingSteps.push({
      stepNumber: 2 + totalSections,
      phase: 'generation',
      thought: `Generated metadata - Duration: ${metadata.estimatedDuration}min, Keywords: ${metadata.keywords.length}`,
      action: 'Metadata generation',
      observation: `Total generation time: ${Date.now() - startTime}ms`,
      timestamp: new Date(),
    });

    const presentation: EnhancedPresentation = {
      title: titleResult.title,
      subtitle: titleResult.subtitle,
      sections,
      metadata,
    };

    this.logger.log(
      `✅ Generation complete: ${sections.length} sections in ${Date.now() - startTime}ms`,
    );

    return {
      presentation,
      thinkingSteps,
      tokensUsed: totalTokens,
    };
  }

  /**
   * Generate a compelling title and subtitle
   */
  private async generateTitle(
    plan: PresentationPlan,
    topic: string,
  ): Promise<{ title: string; subtitle: string; tokens: number }> {
    const prompt = `You are an expert presentation title creator. Create a compelling title.

TOPIC: "${topic}"
MAIN OBJECTIVE: ${plan.mainObjective}
AUDIENCE: ${plan.targetAudience.type} (${plan.targetAudience.knowledgeLevel})
TONE: Based on hook type: ${plan.contentStrategy.hookType}
KEY MESSAGES: ${plan.keyMessages.slice(0, 3).join(', ')}

Think step by step:
1. What words will immediately grab attention?
2. What promise or value can we convey?
3. How do we make it memorable?

Return JSON:
{
  "reasoning": "Your title creation process...",
  "title": "Main compelling title",
  "subtitle": "Supporting subtitle with more detail"
}`;

    const response = await this.callAI(prompt);
    const parsed = this.parseJSON(response.content, {
      title: topic,
      subtitle: `A comprehensive overview for ${plan.targetAudience.type}`,
    });

    return {
      title: parsed.title,
      subtitle: parsed.subtitle,
      tokens: response.tokens,
    };
  }

  /**
   * Determine the type of section based on position
   */
  private determineSectionType(
    index: number,
    total: number,
    plan: PresentationPlan,
  ): string {
    const position = index / (total - 1);

    if (index === 0) {
      return plan.contentStrategy.hookType === 'question'
        ? 'hook-question'
        : plan.contentStrategy.hookType === 'statistic'
          ? 'hook-statistic'
          : plan.contentStrategy.hookType === 'story'
            ? 'hook-story'
            : 'title-intro';
    }

    if (index === total - 1) {
      return plan.contentStrategy.conclusionStyle === 'call-to-action'
        ? 'cta-conclusion'
        : plan.contentStrategy.conclusionStyle === 'vision'
          ? 'vision-conclusion'
          : 'summary-conclusion';
    }

    if (position < 0.3) return 'problem-setup';
    if (position < 0.5) return 'solution-reveal';
    if (position < 0.7) return 'evidence-data';
    if (position < 0.85) return 'benefits-outcomes';
    return 'implementation-next-steps';
  }

  /**
   * Generate a single section with full context
   */
  private async generateSection(
    plan: PresentationPlan,
    topic: string,
    context: {
      index: number;
      total: number;
      type: string;
      previousContext: string;
      tone: string;
      style: string;
      keyMessage: string;
      rawData?: string;
    },
  ): Promise<{ section: EnhancedSection; tokens: number }> {
    const layoutForType = this.getLayoutForSectionType(context.type);

    const prompt = `You are an expert presentation content creator. Generate ONE powerful, visually rich slide.

TOPIC: "${topic}"
SLIDE POSITION: ${context.index + 1} of ${context.total}
SLIDE TYPE: ${context.type}
PREVIOUS CONTEXT: ${context.previousContext || 'This is the first slide'}
KEY MESSAGE TO CONVEY: ${context.keyMessage}
TONE: ${context.tone}
STYLE: ${context.style}
AUDIENCE: ${plan.targetAudience.type} (${plan.targetAudience.knowledgeLevel} level)
NARRATIVE ARC: ${plan.contentStrategy.narrativeArc}
SUGGESTED LAYOUT: ${layoutForType}
${context.rawData ? `RAW DATA REFERENCE: "${context.rawData.substring(0, 3000)}..."` : ''}

CRITICAL INSTRUCTIONS:
1. **Charts:** If this slide discusses data, trends, or comparisons, YOU MUST generate a "chart" block with realistic "chartData".
2. **Visuals:** Use relevant emojis 🌟 in headings or key points to add visual appeal.
3. **Card Style:** For key paragraphs or concepts, use "paragraph" blocks with 'variant': 'card' in formatting.
4. **Colors:** Use 'color' in formatting to distinguish headings (e.g., 'primary'), paragraphs ('default'), and lists.
5. **Detail:** Provide comprehensive, detailed content. Avoid brief summaries. Aim for 50-75 words per paragraph.

Think step by step:
1. What is the main point? Does it need a chart?
2. How can I make the text visually distinct?
3. What card-style layouts can I use?

Return JSON:
{
  "heading": "Compelling heading with emoji 🚀",
  "subheading": "Detailed subheading explaining the context",
  "blocks": [
    {
      "type": "chart",
      "content": "Description of the chart",
      "chartData": {
        "type": "bar|line|pie|doughnut",
        "labels": ["Q1", "Q2", "Q3", "Q4"],
        "datasets": [{ "label": "Sales", "data": [10, 25, 40, 30], "backgroundColor": "#3b82f6" }]
      }
    },
    {
      "type": "paragraph",
      "content": "Detailed explanation...",
      "formatting": { "variant": "card", "color": "text-primary", "bold": true }
    }
  ],
  "layout": "${layoutForType}",
  "suggestedImage": {
    "prompt": "Highly detailed, photorealistic image of...",
    "style": "photography",
    "placement": "right"
  },
  "speakerNotes": "Comprehensive notes...",
  "transition": "fade",
  "duration": 90
}`;

    const response = await this.callAI(prompt);

    interface ParsedSection {
      heading: string;
      subheading?: string;
      blocks: Array<{
        type: string;
        content: string;
        formatting?: {
          bold?: boolean;
          size?: string;
          alignment?: string;
          color?: string;
          variant?: string;
        };
        chartData?: unknown; // Allow chartData to be passed
      }>;
      layout: string;
      suggestedImage?: { prompt: string; style: string; placement: string };
      speakerNotes?: string;
      transition?: string;
      duration?: number;
    }

    const parsed = this.parseJSON<ParsedSection>(response.content, {
      heading: `Slide ${context.index + 1}`,
      blocks: [{ type: 'paragraph', content: 'Content for this slide' }],
      layout: layoutForType,
      duration: 60,
    });

    // Ensure all blocks have IDs and proper types
    const blocksWithIds: EnhancedBlock[] = (parsed.blocks || []).map(
      (block) => ({
        id: uuidv4(),
        type: (block.type || 'paragraph') as EnhancedBlock['type'],
        content: block.content || '',
        formatting: block.formatting as EnhancedBlock['formatting'],
        chartData: block.chartData as ChartData | undefined,
      }),
    );

    const section: EnhancedSection = {
      id: uuidv4(),
      heading: parsed.heading,
      subheading: parsed.subheading,
      blocks: blocksWithIds,
      layout: (parsed.layout as LayoutType) || 'title-content',
      suggestedImage: parsed.suggestedImage,
      speakerNotes: parsed.speakerNotes,
      transition:
        (parsed.transition as EnhancedSection['transition']) || 'fade',
      duration: parsed.duration || 60,
    };

    return { section, tokens: response.tokens };
  }

  /**
   * Get recommended layout for section type
   */
  private getLayoutForSectionType(sectionType: string): LayoutType {
    const layoutMap: Record<string, LayoutType> = {
      'hook-question': 'title',
      'hook-statistic': 'stats-grid',
      'hook-story': 'quote-highlight',
      'title-intro': 'title-subtitle',
      'problem-setup': 'title-content',
      'solution-reveal': 'image-right',
      'evidence-data': 'chart-focus',
      'benefits-outcomes': 'two-column',
      'implementation-next-steps': 'timeline',
      'cta-conclusion': 'title',
      'vision-conclusion': 'image-full',
      'summary-conclusion': 'title-content',
    };

    return layoutMap[sectionType] || 'title-content';
  }

  /**
   * Generate presentation metadata
   */
  private generateMetadata(
    plan: PresentationPlan,
    sections: EnhancedSection[],
    topic: string,
  ): {
    estimatedDuration: number;
    keywords: string[];
    summary: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    category: string;
  } {
    const totalDuration = sections.reduce(
      (acc, s) => acc + (s.duration || 60),
      0,
    );

    // Map knowledge level to difficulty (expert -> advanced)
    const difficultyMap: Record<
      string,
      'beginner' | 'intermediate' | 'advanced'
    > = {
      beginner: 'beginner',
      intermediate: 'intermediate',
      expert: 'advanced',
    };

    return {
      estimatedDuration: Math.ceil(totalDuration / 60), // Convert to minutes
      keywords: plan.keyMessages.slice(0, 5),
      summary: `${plan.contentStrategy.narrativeArc} presentation about ${topic} for ${plan.targetAudience.type}`,
      difficulty:
        difficultyMap[plan.targetAudience.knowledgeLevel] || 'intermediate',
      category: this.categorize(topic),
    };
  }

  /**
   * Categorize the presentation topic
   */
  private categorize(topic: string): string {
    const categories: Record<string, string[]> = {
      Business: [
        'strategy',
        'marketing',
        'sales',
        'startup',
        'business',
        'company',
        'market',
      ],
      Technology: [
        'ai',
        'software',
        'tech',
        'digital',
        'data',
        'cloud',
        'api',
        'machine learning',
      ],
      Education: [
        'learn',
        'course',
        'training',
        'teach',
        'education',
        'student',
      ],
      Design: ['design', 'ux', 'ui', 'creative', 'visual', 'brand'],
      Science: ['research', 'study', 'experiment', 'scientific', 'analysis'],
    };

    const lowerTopic = topic.toLowerCase();
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some((kw) => lowerTopic.includes(kw))) {
        return category;
      }
    }
    return 'General';
  }

  /**
   * Apply refinements to an existing presentation
   */
  async applyRefinements(
    presentation: EnhancedPresentation,
    improvements: Array<{
      area: string;
      currentState: string;
      suggestedChange: string;
      priority: string;
      affectedSections: number[];
    }>,
  ): Promise<{
    presentation: EnhancedPresentation;
    thinkingSteps: ThinkingStep[];
    tokensUsed: number;
  }> {
    const thinkingSteps: ThinkingStep[] = [];
    let totalTokens = 0;

    // Sort by priority
    const sortedImprovements = [...improvements].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return (
        (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) -
        (priorityOrder[b.priority as keyof typeof priorityOrder] || 2)
      );
    });

    // Apply each improvement
    for (const improvement of sortedImprovements) {
      this.logger.log(`🔧 Applying improvement: ${improvement.area}`);

      for (const sectionIndex of improvement.affectedSections) {
        if (sectionIndex < presentation.sections.length) {
          const refined = await this.refineSection(
            presentation.sections[sectionIndex],
            improvement,
          );

          presentation.sections[sectionIndex] = refined.section;
          totalTokens += refined.tokens;

          thinkingSteps.push({
            stepNumber: thinkingSteps.length + 1,
            phase: 'refinement',
            thought: `Applied ${improvement.priority} priority improvement to section ${sectionIndex}: ${improvement.area}`,
            action: improvement.suggestedChange,
            observation: `Section "${refined.section.heading}" updated`,
            timestamp: new Date(),
          });
        }
      }
    }

    return { presentation, thinkingSteps, tokensUsed: totalTokens };
  }

  /**
   * Refine a single section based on improvement
   */
  private async refineSection(
    section: EnhancedSection,
    improvement: {
      area: string;
      currentState: string;
      suggestedChange: string;
    },
  ): Promise<{ section: EnhancedSection; tokens: number }> {
    const prompt = `You are a presentation refinement expert. Improve this slide based on feedback.

CURRENT SLIDE:
- Heading: ${section.heading}
- Blocks: ${JSON.stringify(section.blocks)}
- Layout: ${section.layout}

IMPROVEMENT NEEDED:
- Area: ${improvement.area}
- Current State: ${improvement.currentState}
- Suggested Change: ${improvement.suggestedChange}

Apply the improvement while maintaining the slide's overall purpose. Return the ENTIRE improved slide.

Return JSON:
{
  "reasoning": "How you improved the slide...",
  "heading": "Improved heading",
  "blocks": [/* improved blocks */],
  "layout": "improved layout if needed",
  "speakerNotes": "Updated speaker notes"
}`;

    const response = await this.callAI(prompt);

    interface ParsedRefinement {
      heading: string;
      blocks: Array<{
        type: string;
        content: string;
        formatting?: unknown;
        chartData?: unknown;
      }>;
      layout: string;
      speakerNotes?: string;
    }

    const parsed = this.parseJSON<ParsedRefinement>(response.content, {
      heading: section.heading,
      blocks: section.blocks as Array<{
        type: string;
        content: string;
        formatting?: unknown;
        chartData?: unknown;
      }>,
      layout: section.layout,
    });

    return {
      section: {
        ...section,
        heading: parsed.heading || section.heading,
        blocks:
          parsed.blocks?.map((b) => ({
            id: uuidv4(),
            type: (b.type || 'paragraph') as EnhancedBlock['type'],
            content: b.content || '',
            formatting: b.formatting as EnhancedBlock['formatting'],
            chartData: b.chartData as ChartData | undefined,
          })) || section.blocks,
        layout: (parsed.layout as LayoutType) || section.layout,
        speakerNotes: parsed.speakerNotes || section.speakerNotes,
      },
      tokens: response.tokens,
    };
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
            'You are an expert presentation creator. Always respond with valid JSON. Be creative, engaging, and professional.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 2500,
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
