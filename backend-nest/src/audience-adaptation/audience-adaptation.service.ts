import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import type { Block as PrismaBlock, Prisma } from '@prisma/client';

export type AudienceType =
  | 'executives'
  | 'sales'
  | 'technical'
  | 'marketing'
  | 'training'
  | 'investors'
  | 'general'
  | 'academic'
  | 'customers';

export interface AdaptationOptions {
  targetAudience: AudienceType;
  adjustTone: boolean;
  adjustLength: boolean;
  adjustComplexity: boolean;
  preserveKeyPoints: boolean;
}

export interface AdaptationResult {
  projectId: string;
  originalAudience: string;
  targetAudience: AudienceType;
  adaptedSlides: AdaptedSlide[];
  summary: {
    totalChanges: number;
    toneAdjustments: number;
    lengthAdjustments: number;
    complexityAdjustments: number;
  };
}

interface AdaptationResponse {
  adaptedText: string;
  changes: string[];
}

interface AdaptedSlide {
  slideId: string;
  originalContent: PrismaBlock[];
  adaptedContent: Prisma.JsonValue[];
  changes: string[];
}

@Injectable()
export class AudienceAdaptationService {
  private readonly logger = new Logger(AudienceAdaptationService.name);

  private audienceProfiles: Record<
    AudienceType,
    {
      tone: string;
      complexity: string;
      focus: string;
      avgWordCount: number;
      keyElements: string[];
    }
  > = {
    executives: {
      tone: 'concise, strategic, results-focused',
      complexity: 'high-level, minimal jargon',
      focus: 'ROI, business impact, key metrics',
      avgWordCount: 50,
      keyElements: [
        'executive summary',
        'key takeaways',
        'financial impact',
        'timeline',
      ],
    },
    sales: {
      tone: 'persuasive, benefit-oriented, action-driven',
      complexity: 'accessible, customer-focused',
      focus: 'value proposition, benefits, testimonials',
      avgWordCount: 75,
      keyElements: [
        'pain points',
        'solutions',
        'proof points',
        'call to action',
      ],
    },
    technical: {
      tone: 'precise, detailed, factual',
      complexity: 'technical, in-depth',
      focus: 'specifications, architecture, implementation',
      avgWordCount: 120,
      keyElements: [
        'technical specs',
        'diagrams',
        'code examples',
        'best practices',
      ],
    },
    marketing: {
      tone: 'engaging, creative, brand-aligned',
      complexity: 'accessible, visual-first',
      focus: 'brand story, target audience, campaigns',
      avgWordCount: 60,
      keyElements: [
        'visuals',
        'brand messaging',
        'market data',
        'campaign metrics',
      ],
    },
    training: {
      tone: 'instructional, clear, step-by-step',
      complexity: 'progressive, comprehensive',
      focus: 'learning objectives, procedures, practice',
      avgWordCount: 100,
      keyElements: ['objectives', 'examples', 'exercises', 'key takeaways'],
    },
    investors: {
      tone: 'confident, data-driven, visionary',
      complexity: 'strategic, metrics-focused',
      focus: 'market opportunity, traction, financials',
      avgWordCount: 65,
      keyElements: ['market size', 'traction', 'financials', 'team', 'ask'],
    },
    general: {
      tone: 'professional, clear, balanced',
      complexity: 'moderate, accessible',
      focus: 'key information, context, next steps',
      avgWordCount: 80,
      keyElements: ['introduction', 'main points', 'conclusion', 'Q&A'],
    },
    academic: {
      tone: 'scholarly, evidence-based, analytical',
      complexity: 'rigorous, citation-heavy',
      focus: 'methodology, findings, implications',
      avgWordCount: 150,
      keyElements: [
        'research question',
        'methodology',
        'results',
        'discussion',
      ],
    },
    customers: {
      tone: 'friendly, helpful, solution-oriented',
      complexity: 'simple, jargon-free',
      focus: 'benefits, how-to, support',
      avgWordCount: 55,
      keyElements: ['features', 'benefits', 'getting started', 'support'],
    },
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Adapt an entire presentation to a specific audience
   */
  async adaptPresentation(
    projectId: string,
    userId: string,
    options: AdaptationOptions,
  ): Promise<AdaptationResult> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
      include: {
        slides: {
          include: { blocks: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!project) {
      throw new BadRequestException('Project not found');
    }

    if (!project) {
      throw new BadRequestException('Project not found');
    }

    const targetProfile = this.audienceProfiles[options.targetAudience];
    const adaptedSlides: AdaptedSlide[] = [];
    let totalChanges = 0;
    let toneAdjustments = 0;
    let lengthAdjustments = 0;
    let complexityAdjustments = 0;

    for (const slide of project.slides) {
      const adaptedBlocks: Prisma.JsonValue[] = [];
      const changes: string[] = [];

      for (const block of slide.blocks) {
        const adaptedBlock = await this.adaptBlock(
          block,
          targetProfile,
          options,
        );

        adaptedBlocks.push(adaptedBlock.content);
        changes.push(...adaptedBlock.changes);

        if (adaptedBlock.changes.some((c) => c.includes('tone')))
          toneAdjustments++;
        if (adaptedBlock.changes.some((c) => c.includes('length')))
          lengthAdjustments++;
        if (adaptedBlock.changes.some((c) => c.includes('complexity')))
          complexityAdjustments++;
      }

      totalChanges += changes.length;
      adaptedSlides.push({
        slideId: slide.id,
        originalContent: slide.blocks,
        adaptedContent: adaptedBlocks,
        changes,
      });
    }

    // Log the adaptation
    await this.prisma.aIGeneration.create({
      data: {
        userId,
        projectId,
        prompt: `Audience adaptation: ${options.targetAudience}`,
        response: JSON.stringify({ adaptedSlides }),
        tokens: 0,
        model: 'gpt-4o',
      },
    });

    return {
      projectId,
      originalAudience: project.audience || 'general',
      targetAudience: options.targetAudience,
      adaptedSlides,
      summary: {
        totalChanges,
        toneAdjustments,
        lengthAdjustments,
        complexityAdjustments,
      },
    };
  }

  /**
   * Adapt a single block to target audience
   */
  private async adaptBlock(
    block: PrismaBlock,
    targetProfile: (typeof this.audienceProfiles)[AudienceType],
    options: AdaptationOptions,
  ): Promise<{ content: Prisma.JsonValue; changes: string[] }> {
    const changes: string[] = [];
    let content: Prisma.JsonValue = block.content;
    if (
      typeof content === 'object' &&
      content !== null &&
      !Array.isArray(content)
    ) {
      content = { ...(content as Record<string, unknown>) } as Prisma.JsonValue;
    }

    // Only adapt text-based blocks
    const textBlockTypes = [
      'HEADING',
      'SUBHEADING',
      'PARAGRAPH',
      'BULLET_LIST',
      'NUMBERED_LIST',
      'QUOTE',
    ];

    if (!textBlockTypes.includes(block.blockType)) {
      return { content, changes };
    }

    const originalText = this.extractText(content);
    if (!originalText || originalText.length < 10) {
      return { content, changes };
    }

    const prompt = this.buildAdaptationPrompt(
      originalText,
      targetProfile,
      options,
    );

    try {
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert at adapting presentation content for different audiences. 
            Return a JSON object with: { "adaptedText": "...", "changes": ["change1", "change2"] }`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const result: AdaptationResponse = JSON.parse(
        response.choices[0]?.message?.content || '{}',
      ) as AdaptationResponse;

      if (result.adaptedText) {
        content = this.applyAdaptedText(
          content,
          block.blockType,
          result.adaptedText,
        );
        changes.push(...(result.changes || []));
      }
    } catch (error: unknown) {
      this.logger.error(`Failed to adapt block ${block.id}:`, error);
    }

    return { content, changes };
  }

  private buildAdaptationPrompt(
    text: string,
    profile: (typeof this.audienceProfiles)[AudienceType],
    options: AdaptationOptions,
  ): string {
    const instructions: string[] = [];

    if (options.adjustTone) {
      instructions.push(`Adjust tone to be: ${profile.tone}`);
    }
    if (options.adjustLength) {
      instructions.push(
        `Target word count: ~${profile.avgWordCount} words per paragraph`,
      );
    }
    if (options.adjustComplexity) {
      instructions.push(`Adjust complexity to: ${profile.complexity}`);
    }
    if (options.preserveKeyPoints) {
      instructions.push('Preserve all key facts and data points');
    }

    return `
Adapt the following presentation content for a ${options.targetAudience} audience:

ORIGINAL TEXT:
${text}

ADAPTATION GUIDELINES:
- Focus on: ${profile.focus}
- ${instructions.join('\n- ')}

Consider including these elements if relevant: ${profile.keyElements.join(', ')}

Provide the adapted text and list the specific changes made.
    `.trim();
  }

  private extractText(content: Prisma.JsonValue): string {
    if (typeof content === 'string') return content;
    if (content && typeof content === 'object') {
      const obj = content as Record<string, unknown>;
      if (typeof (obj as { text?: string }).text === 'string')
        return (obj as { text?: string }).text ?? '';
      if (typeof (obj as { content?: string }).content === 'string')
        return (obj as { content?: string }).content ?? '';
      if (Array.isArray((obj as Record<string, { items?: string[] }>).items))
        return (
          (obj as Record<string, { items?: string[] }>).items as string[]
        ).join('\n');
      return JSON.stringify(obj);
    }
    return '';
  }

  private applyAdaptedText(
    content: Prisma.JsonValue,
    _blockType: string,
    adaptedText: string,
  ): Prisma.JsonValue {
    if (typeof content === 'string') return adaptedText;
    if (content && typeof content === 'object') {
      const obj = { ...(content as Record<string, unknown>) } as Record<
        string,
        unknown
      > & {
        text?: string;
        content?: string;
        items?: string[];
      };
      if ('text' in obj)
        return { ...obj, text: adaptedText } as Prisma.JsonValue;
      if ('content' in obj)
        return { ...obj, content: adaptedText } as Prisma.JsonValue;
      if (Array.isArray(obj.items)) {
        return {
          ...obj,
          items: adaptedText.split('\n').filter(Boolean),
        } as Prisma.JsonValue;
      }
      // Fallback: set a content property
      return { ...obj, content: adaptedText } as Prisma.JsonValue;
    }
    return adaptedText;
  }

  /**
   * Get suggestions for audience-specific improvements
   */
  async getAudienceSuggestions(
    projectId: string,
    userId: string,
    targetAudience: AudienceType,
  ): Promise<{
    suggestions: Array<{
      slideId: string;
      suggestion: string;
      priority: 'high' | 'medium' | 'low';
    }>;
  }> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
      include: {
        slides: {
          include: { blocks: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!project) {
      throw new BadRequestException('Project not found');
    }

    const targetProfile = this.audienceProfiles[targetAudience];
    const suggestions: Array<{
      slideId: string;
      suggestion: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    // Analyze each slide for improvements
    for (const slide of project.slides) {
      const slideContent = slide.blocks
        .map((b) => this.extractText(b.content))
        .join(' ');

      // Check for missing key elements
      for (const element of targetProfile.keyElements) {
        if (!slideContent.toLowerCase().includes(element.toLowerCase())) {
          suggestions.push({
            slideId: slide.id,
            suggestion: `Consider adding ${element} for ${targetAudience} audience`,
            priority: 'medium',
          });
        }
      }
    }

    return { suggestions };
  }

  /**
   * Get available audience types
   */
  getAudienceTypes(): Array<{
    type: AudienceType;
    name: string;
    description: string;
  }> {
    return [
      {
        type: 'executives',
        name: 'Executives',
        description: 'C-suite and senior leadership',
      },
      {
        type: 'sales',
        name: 'Sales Team',
        description: 'Sales reps and account managers',
      },
      {
        type: 'technical',
        name: 'Technical',
        description: 'Developers and engineers',
      },
      {
        type: 'marketing',
        name: 'Marketing',
        description: 'Marketing and brand teams',
      },
      {
        type: 'training',
        name: 'Training',
        description: 'Employees and learners',
      },
      {
        type: 'investors',
        name: 'Investors',
        description: 'VCs and angel investors',
      },
      {
        type: 'general',
        name: 'General',
        description: 'Mixed or general audience',
      },
      {
        type: 'academic',
        name: 'Academic',
        description: 'Researchers and scholars',
      },
      {
        type: 'customers',
        name: 'Customers',
        description: 'End users and clients',
      },
    ];
  }
}
