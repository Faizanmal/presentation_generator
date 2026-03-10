import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';

interface NarrativeArc {
  structure: string;
  sections: NarrativeSection[];
  totalDuration: number;
  flowDescription: string;
}

interface NarrativeSection {
  type: 'intro' | 'rising_action' | 'climax' | 'resolution' | 'call_to_action';
  title: string;
  purpose: string;
  duration: number;
  keyPoints: string[];
  emotionalTone: string;
  suggestedVisuals: string[];
}

interface TransitionRecommendation {
  from: string;
  to: string;
  type: string;
  duration: number;
  notes: string;
}

interface PacingConfig {
  overall: string;
  sectionPacing: Array<{ section: string; pace: string; emphasis: number }>;
  pausePoints: string[];
  climaxBuild: string[];
}

interface FlowAnalysis {
  score: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  emotionalJourney: Array<{
    section: string;
    emotion: string;
    intensity: number;
  }>;
}

interface VisualPreview {
  visualDescription: string;
  layoutSuggestion: string;
  colorPalette: string[];
  imagePrompts: string[];
}

interface VariationResult {
  variations?: Array<{
    title: string;
    description: string;
    structure: Array<{ title: string; type: string; keyPoints: string[] }>;
  }>;
}

@Injectable()
export class StoryboardingService {
  private readonly logger = new Logger(StoryboardingService.name);

  // Audience type templates
  private readonly audienceTemplates = {
    executive: {
      totalSlides: 8,
      maxDuration: 15,
      style: 'concise',
      focusAreas: ['ROI', 'key metrics', 'strategic impact', 'action items'],
      avoidTopics: ['technical details', 'implementation specifics'],
    },
    technical: {
      totalSlides: 15,
      maxDuration: 30,
      style: 'detailed',
      focusAreas: [
        'architecture',
        'implementation',
        'technical specs',
        'code examples',
      ],
      avoidTopics: ['high-level summaries without substance'],
    },
    educational: {
      totalSlides: 12,
      maxDuration: 45,
      style: 'progressive',
      focusAreas: ['learning objectives', 'examples', 'exercises', 'summary'],
      avoidTopics: ['jargon without explanation'],
    },
    marketing: {
      totalSlides: 10,
      maxDuration: 20,
      style: 'persuasive',
      focusAreas: [
        'benefits',
        'social proof',
        'emotional appeal',
        'call to action',
      ],
      avoidTopics: ['technical complexity'],
    },
    creative: {
      totalSlides: 12,
      maxDuration: 25,
      style: 'visual',
      focusAreas: ['visual storytelling', 'inspiration', 'unique perspectives'],
      avoidTopics: ['heavy text', 'data overload'],
    },
  };

  // Presentation type structures
  private readonly presentationStructures = {
    summary: {
      sections: ['intro', 'key_points', 'conclusion'],
      emphasis: { intro: 0.2, key_points: 0.6, conclusion: 0.2 },
    },
    deep_dive: {
      sections: [
        'intro',
        'context',
        'analysis',
        'details',
        'implications',
        'conclusion',
      ],
      emphasis: {
        intro: 0.1,
        context: 0.15,
        analysis: 0.25,
        details: 0.25,
        implications: 0.15,
        conclusion: 0.1,
      },
    },
    pitch: {
      sections: ['hook', 'problem', 'solution', 'proof', 'call_to_action'],
      emphasis: {
        hook: 0.15,
        problem: 0.2,
        solution: 0.3,
        proof: 0.2,
        call_to_action: 0.15,
      },
    },
    tutorial: {
      sections: [
        'objectives',
        'prerequisites',
        'steps',
        'practice',
        'summary',
        'resources',
      ],
      emphasis: {
        objectives: 0.1,
        prerequisites: 0.1,
        steps: 0.5,
        practice: 0.15,
        summary: 0.1,
        resources: 0.05,
      },
    },
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Safely retrieve a string property from an unknown object.
   * Avoids using explicit `any` casts in prompts.
   */
  private safeString(key: string, obj: unknown, defaultVal: string): string {
    if (obj && typeof obj === 'object' && key in obj) {
      const v = (obj as Record<string, unknown>)[key];
      return typeof v === 'string' ? v : defaultVal;
    }
    return defaultVal;
  }

  /**
   * Generate a dynamic storyboard for a presentation
   */
  async generateStoryboard(
    userId: string,
    options: {
      topic: string;
      projectId?: string;
      audienceType: string;
      presentationType: string;
      duration?: number;
      keyPoints?: string[];
      tone?: string;
    },
  ) {
    const {
      topic,
      projectId,
      audienceType,
      presentationType,
      duration,
      keyPoints = [],
      tone = 'professional',
    } = options;

    const audienceConfig =
      this.audienceTemplates[
        audienceType as keyof typeof this.audienceTemplates
      ] || this.audienceTemplates.executive;
    const structureConfig =
      this.presentationStructures[
        presentationType as keyof typeof this.presentationStructures
      ] || this.presentationStructures.summary;

    const estimatedDuration = duration || audienceConfig.maxDuration;

    // Create storyboard record
    const storyboard = await this.prisma.storyboard.create({
      data: {
        userId,
        projectId,
        title: topic,
        audienceType,
        presentationType,
        duration: estimatedDuration,
        narrativeArc: {},
        status: 'generating',
      },
    });

    try {
      // Generate narrative arc using AI
      const narrativeArc = await this.generateNarrativeArc(
        topic,
        audienceType,
        presentationType,
        estimatedDuration,
        keyPoints,
        tone,
      );

      // Generate detailed sections
      const sections = await this.generateSections(
        storyboard.id,
        topic,
        narrativeArc,
        audienceConfig,
        structureConfig as unknown as typeof this.presentationStructures.summary,
        estimatedDuration,
      );

      // Generate pacing recommendations
      const pacing = this.generatePacingRecommendations(
        sections as unknown as {
          title: string;
          type: string;
          duration?: number | null;
        }[],
        audienceType,
        presentationType,
      );

      // Generate transition suggestions
      const transitions = this.generateTransitionSuggestions(
        sections as unknown as { title: string; type: string }[],
        presentationType,
      );

      // Update storyboard
      const updatedStoryboard = await this.prisma.storyboard.update({
        where: { id: storyboard.id },
        data: {
          narrativeArc: narrativeArc as unknown as object,
          pacing: pacing as unknown as object,
          transitions: transitions as unknown as object,
          status: 'completed',
        },
        include: {
          sections: {
            orderBy: { order: 'asc' },
          },
        },
      });

      return updatedStoryboard;
    } catch (error) {
      this.logger.error('Storyboard generation failed', error);
      await this.prisma.storyboard.update({
        where: { id: storyboard.id },
        data: { status: 'draft' },
      });
      throw error;
    }
  }

  /**
   * Generate narrative arc using AI
   */

  private async generateNarrativeArc(
    topic: string,
    audienceType: string,
    presentationType: string,
    duration: number,
    keyPoints: string[],
    tone: string,
  ): Promise<NarrativeArc> {
    const prompt = `Create a narrative arc for a presentation about "${topic}".

Audience: ${audienceType}
Presentation Type: ${presentationType}
Duration: ${duration} minutes
Tone: ${tone}
${keyPoints.length > 0 ? `Key Points to Cover: ${keyPoints.join(', ')}` : ''}

Generate a compelling story structure with the following JSON format:
{
  "structure": "description of the overall narrative structure",
  "sections": [
    {
      "type": "intro|rising_action|climax|resolution|call_to_action",
      "title": "Section title",
      "purpose": "Why this section exists",
      "duration": minutes as number,
      "keyPoints": ["point 1", "point 2"],
      "emotionalTone": "description of emotional state",
      "suggestedVisuals": ["visual suggestion 1", "visual suggestion 2"]
    }
  ],
  "totalDuration": total minutes,
  "flowDescription": "How the presentation flows from start to finish"
}

Return only valid JSON.`;

    try {
      const response = await this.aiService.generateText(prompt, {
        maxTokens: 1500,
      });
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as NarrativeArc;
      }
    } catch (error) {
      this.logger.error('Failed to generate narrative arc', error);
    }

    // Fallback structure
    return {
      structure: `${presentationType} structure for ${audienceType} audience`,
      sections: [
        {
          type: 'intro',
          title: 'Introduction',
          purpose: 'Set the stage and capture attention',
          duration: Math.ceil(duration * 0.15),
          keyPoints: ['Opening hook', 'Overview of topic'],
          emotionalTone: 'Engaging and welcoming',
          suggestedVisuals: ['Title slide', 'Agenda overview'],
        },
        {
          type: 'rising_action',
          title: 'Main Content',
          purpose: 'Deliver the core message',
          duration: Math.ceil(duration * 0.6),
          keyPoints:
            keyPoints.length > 0
              ? keyPoints
              : ['Key concept 1', 'Key concept 2'],
          emotionalTone: 'Informative and compelling',
          suggestedVisuals: ['Data visualizations', 'Examples'],
        },
        {
          type: 'climax',
          title: 'Key Insight',
          purpose: 'Drive home the main message',
          duration: Math.ceil(duration * 0.1),
          keyPoints: ['Main takeaway'],
          emotionalTone: 'Impactful',
          suggestedVisuals: ['Highlight visual'],
        },
        {
          type: 'call_to_action',
          title: 'Conclusion & Next Steps',
          purpose: 'Inspire action',
          duration: Math.ceil(duration * 0.15),
          keyPoints: ['Summary', 'Call to action'],
          emotionalTone: 'Motivating',
          suggestedVisuals: ['Summary slide', 'Contact information'],
        },
      ],
      totalDuration: duration,
      flowDescription: `A ${presentationType} presentation structure optimized for ${audienceType} audience`,
    };
  }

  /**
   * Generate detailed sections for the storyboard
   */
  private async generateSections(
    storyboardId: string,
    topic: string,
    narrativeArc: NarrativeArc,
    audienceConfig: typeof this.audienceTemplates.executive,
    _structureConfig: typeof this.presentationStructures.summary,
    totalDuration: number,
  ) {
    const sections: Record<string, unknown>[] = [];
    let order = 0;

    for (const arcSection of narrativeArc.sections) {
      // Generate speaker notes for this section
      const speakerNotes = await this.generateSpeakerNotes(
        topic,
        arcSection,
        audienceConfig,
      );

      // Determine best layout
      const suggestedLayout = this.suggestLayout(
        arcSection.type,
        arcSection.keyPoints.length,
      );

      // Calculate duration in seconds
      const durationSeconds = Math.ceil(
        (arcSection.duration / totalDuration) * totalDuration * 60,
      );

      const section = await this.prisma.storyboardSection.create({
        data: {
          storyboardId,
          title: arcSection.title,
          order: order++,
          type: arcSection.type,
          duration: durationSeconds,
          keyPoints: arcSection.keyPoints,
          suggestedLayout,
          speakerNotes,
          transitionIn: order === 0 ? 'fade' : 'slide',
          transitionOut: 'slide',
        },
      });

      sections.push(section);
    }

    return sections;
  }

  /**
   * Generate speaker notes for a section
   */
  private async generateSpeakerNotes(
    topic: string,
    section: NarrativeSection,
    audienceConfig: typeof this.audienceTemplates.executive,
  ): Promise<string> {
    const prompt = `Generate speaker notes for a presentation section.

Topic: ${topic}
Section: ${section.title}
Purpose: ${section.purpose}
Key Points: ${section.keyPoints.join(', ')}
Emotional Tone: ${section.emotionalTone}
Audience Focus Areas: ${audienceConfig.focusAreas.join(', ')}

Write natural, conversational speaker notes (2-3 paragraphs) that help the presenter deliver this section effectively. Include timing cues and engagement tips.`;

    try {
      return await this.aiService.generateText(prompt, { maxTokens: 400 });
    } catch {
      return `Deliver the ${section.title} section with ${section.emotionalTone} tone. Cover: ${section.keyPoints.join(', ')}.`;
    }
  }

  /**
   * Suggest layout based on section type
   */
  private suggestLayout(sectionType: string, keyPointCount: number): string {
    const layoutMap: Record<string, string> = {
      intro: 'title',
      rising_action: keyPointCount > 3 ? 'two-column' : 'title-content',
      climax: 'quote-highlight',
      resolution: 'stats-grid',
      call_to_action: 'title-content',
    };

    return layoutMap[sectionType] || 'title-content';
  }

  /**
   * Generate pacing recommendations
   */
  private generatePacingRecommendations(
    sections: Array<{ title: string; type: string; duration?: number | null }>,
    audienceType: string,
    presentationType: string,
  ): PacingConfig {
    const paceMap: Record<string, string> = {
      executive: 'fast',
      technical: 'moderate',
      educational: 'slow',
      marketing: 'dynamic',
      creative: 'varied',
    };

    const sectionPacing = sections.map((section) => ({
      section: section.title,
      pace:
        section.type === 'climax'
          ? 'slow'
          : paceMap[audienceType] || 'moderate',
      emphasis:
        section.type === 'climax' ? 1 : section.type === 'intro' ? 0.8 : 0.6,
    }));

    return {
      overall: paceMap[audienceType] || 'moderate',
      sectionPacing,
      pausePoints: sections
        .filter((s) => s.type === 'climax' || s.type === 'call_to_action')
        .map((s) => `After ${s.title}`),
      climaxBuild:
        presentationType === 'pitch'
          ? [
              'Build tension through problem statement',
              'Release with solution reveal',
            ]
          : ['Gradually increase engagement', 'Peak at key insight'],
    };
  }

  /**
   * Generate transition suggestions
   */
  private generateTransitionSuggestions(
    sections: Array<{ title: string; type: string }>,
    presentationType: string,
  ): TransitionRecommendation[] {
    const transitions: TransitionRecommendation[] = [];

    for (let i = 0; i < sections.length - 1; i++) {
      const from = sections[i];
      const to = sections[i + 1];

      let transitionType = 'fade';
      let duration = 0.5;

      // Determine transition based on section types
      if (from.type === 'intro' && to.type === 'rising_action') {
        transitionType = 'slide-up';
        duration = 0.7;
      } else if (to.type === 'climax') {
        transitionType = presentationType === 'pitch' ? 'zoom' : 'fade';
        duration = 1;
      } else if (from.type === 'climax') {
        transitionType = 'dissolve';
        duration = 0.8;
      }

      transitions.push({
        from: from.title,
        to: to.title,
        type: transitionType,
        duration,
        notes: `Transition from ${from.type} to ${to.type}`,
      });
    }

    return transitions;
  }

  /**
   * Get storyboard by ID
   */
  async getStoryboard(id: string, userId: string) {
    const storyboard = await this.prisma.storyboard.findUnique({
      where: { id },
      include: {
        sections: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!storyboard || storyboard.userId !== userId) {
      throw new BadRequestException('Storyboard not found');
    }

    return storyboard;
  }

  /**
   * Get user's storyboards
   */
  async getUserStoryboards(userId: string, limit: number = 10) {
    return this.prisma.storyboard.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sections: {
          select: { id: true, title: true, type: true, order: true },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  /**
   * Update storyboard section
   */
  async updateSection(
    sectionId: string,
    userId: string,
    data: Partial<{
      title: string;
      keyPoints: string[];
      speakerNotes: string;
      suggestedLayout: string;
      duration: number;
    }>,
  ) {
    const section = await this.prisma.storyboardSection.findUnique({
      where: { id: sectionId },
      include: { storyboard: true },
    });

    if (!section || section.storyboard.userId !== userId) {
      throw new BadRequestException('Section not found');
    }

    return this.prisma.storyboardSection.update({
      where: { id: sectionId },
      data,
    });
  }

  /**
   * Apply storyboard to project (create slides)
   */
  async applyToProject(
    storyboardId: string,
    projectId: string,
    userId: string,
  ) {
    const storyboard = await this.getStoryboard(storyboardId, userId);

    // Verify project ownership
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.ownerId !== userId) {
      throw new BadRequestException('Project not found');
    }

    // Create slides from storyboard sections
    const slides: Record<string, unknown>[] = [];
    for (const section of storyboard.sections) {
      const slide = await this.prisma.slide.create({
        data: {
          projectId,
          title: section.title,
          order: section.order,
          layout: section.suggestedLayout || 'default',
          content: {
            keyPoints: section.keyPoints,
            speakerNotes: section.speakerNotes,
            sectionType: section.type,
          },
        },
      });
      slides.push(slide);
    }

    // Link storyboard to project
    await this.prisma.storyboard.update({
      where: { id: storyboardId },
      data: { projectId },
    });

    return { storyboard, slides };
  }

  /**
   * Delete storyboard
   */
  async deleteStoryboard(id: string, userId: string) {
    const storyboard = await this.prisma.storyboard.findUnique({
      where: { id },
    });

    if (!storyboard || storyboard.userId !== userId) {
      throw new BadRequestException('Storyboard not found');
    }

    return this.prisma.storyboard.delete({ where: { id } });
  }

  /**
   * Analyze story flow and provide recommendations
   */
  async analyzeStoryFlow(
    storyboardId: string,
    userId: string,
  ): Promise<{
    score: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    emotionalJourney: Array<{
      section: string;
      emotion: string;
      intensity: number;
    }>;
  }> {
    const storyboard = await this.getStoryboard(storyboardId, userId);

    const prompt = `Analyze this presentation storyboard and evaluate its narrative flow:

Topic: ${this.safeString('topic', storyboard, 'General Presentation')}
Audience: ${this.safeString('audienceType', storyboard, 'General')}
Type: ${this.safeString('presentationType', storyboard, 'Standard')}

Sections:
${storyboard.sections.map((s, i) => `${i + 1}. ${s.title} (${s.type}): ${JSON.stringify(s.keyPoints)}`).join('\n')}

Return JSON:
{
  "score": 85,
  "strengths": ["Strong opening", "Clear progression"],
  "weaknesses": ["Weak climax", "Too many points in section 3"],
  "recommendations": ["Add more impact to climax", "Reduce section 3 content"],
  "emotionalJourney": [
    {"section": "Introduction", "emotion": "curiosity", "intensity": 6},
    {"section": "Problem", "emotion": "concern", "intensity": 7}
  ]
}`;

    try {
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a narrative expert. Analyze presentation flow critically.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No analysis generated');
      }

      return JSON.parse(content) as FlowAnalysis;
    } catch (error) {
      this.logger.error('Flow analysis failed', error);
      return {
        score: 70,
        strengths: ['Standard structure'],
        weaknesses: [],
        recommendations: ['Consider adding more engaging elements'],
        emotionalJourney: [],
      };
    }
  }

  /**
   * Generate visual storyboard preview
   */
  async generateVisualPreview(
    storyboardId: string,
    userId: string,
  ): Promise<{
    sections: Array<{
      title: string;
      visualDescription: string;
      layoutSuggestion: string;
      colorPalette: string[];
      imagePrompts: string[];
    }>;
  }> {
    const storyboard = await this.getStoryboard(storyboardId, userId);

    const visualSections = await Promise.all(
      storyboard.sections.map(async (section) => {
        const prompt = `Generate visual design suggestions for this slide:

Title: ${section.title}
Type: ${section.type}
Key Points: ${JSON.stringify(section.keyPoints)}
Speaker Notes: ${section.speakerNotes || 'N/A'}

Return JSON:
{
  "visualDescription": "Detailed visual description",
  "layoutSuggestion": "hero-image" | "split-content" | "centered" | "grid",
  "colorPalette": ["#ffffff", "#1a73e8", "#34a853"],
  "imagePrompts": ["prompt 1", "prompt 2"]
}`;

        try {
          const response = await this.aiService.chatCompletion({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content:
                  'Generate visual design suggestions for presentation slides.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 500,
            response_format: { type: 'json_object' },
          });

          const content = response.choices[0]?.message?.content;
          if (!content) {
            throw new Error('No visual preview generated');
          }

          const visual = JSON.parse(content) as VisualPreview;
          return {
            title: section.title,
            ...visual,
          };
        } catch (error) {
          this.logger.warn(
            `Visual preview failed for section: ${section.title}`,
            error,
          );
          return {
            title: section.title,
            visualDescription: 'Standard layout',
            layoutSuggestion: 'centered',
            colorPalette: ['#ffffff', '#000000'],
            imagePrompts: [],
          };
        }
      }),
    );

    return { sections: visualSections };
  }

  /**
   * Optimize storyboard pacing
   */
  async optimizePacing(
    storyboardId: string,
    userId: string,
    targetDuration: number,
  ): Promise<{
    optimized: boolean;
    originalDuration: number;
    newDuration: number;
    adjustments: Array<{
      section: string;
      oldDuration: number;
      newDuration: number;
      reason: string;
    }>;
  }> {
    const storyboard = await this.getStoryboard(storyboardId, userId);

    const totalDuration = storyboard.sections.reduce(
      (sum, s) => sum + (s.duration || 0),
      0,
    );

    if (Math.abs(totalDuration - targetDuration) < 1) {
      return {
        optimized: false,
        originalDuration: totalDuration,
        newDuration: totalDuration,
        adjustments: [],
      };
    }

    const adjustments: Array<{
      section: string;
      oldDuration: number;
      newDuration: number;
      reason: string;
    }> = [];

    const scaleFactor = targetDuration / totalDuration;

    for (const section of storyboard.sections) {
      const oldDuration = section.duration || 0;
      let newDuration = oldDuration * scaleFactor;

      // Apply minimum and maximum constraints
      const minDuration = section.type === 'intro' ? 0.5 : 1;
      const maxDuration = section.type === 'climax' ? 5 : 3;

      newDuration = Math.max(minDuration, Math.min(maxDuration, newDuration));

      if (Math.abs(newDuration - oldDuration) > 0.1) {
        adjustments.push({
          section: section.title,
          oldDuration,
          newDuration,
          reason:
            newDuration > oldDuration
              ? 'Extended for emphasis'
              : 'Condensed for time',
        });

        // Update section duration
        await this.prisma.storyboardSection.update({
          where: { id: section.id },
          data: { duration: newDuration },
        });
      }
    }

    const newTotalDuration = adjustments.reduce(
      (sum, a) => sum - a.oldDuration + a.newDuration,
      totalDuration,
    );

    return {
      optimized: true,
      originalDuration: totalDuration,
      newDuration: newTotalDuration,
      adjustments,
    };
  }

  /**
   * Generate alternative storyboard variations
   */
  async generateVariations(
    storyboardId: string,
    userId: string,
    count: number = 3,
  ): Promise<
    Array<{
      title: string;
      description: string;
      structure: Array<{ title: string; type: string; keyPoints: string[] }>;
    }>
  > {
    const storyboard = await this.getStoryboard(storyboardId, userId);

    const prompt = `Generate ${count} alternative storyboard structures for this presentation:

Topic: ${this.safeString('topic', storyboard, 'General Presentation')}
Audience: ${this.safeString('audienceType', storyboard, 'General')}
Current Structure: ${storyboard.sections.map((s) => `${s.title} (${s.type})`).join(' → ')}

Generate ${count} different narrative approaches. Each should have a unique angle.

Return JSON:
{
  "variations": [
    {
      "title": "Problem-Solution Approach",
      "description": "Focus on pain points first",
      "structure": [
        {"title": "Section 1", "type": "intro", "keyPoints": ["point 1", "point 2"]},
        ...
      ]
    }
  ]
}`;

    try {
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a storytelling expert. Generate creative narrative variations.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No variations generated');
      }

      const result = JSON.parse(content) as VariationResult;
      return result.variations || [];
    } catch (error) {
      this.logger.error('Variation generation failed', error);
      return [];
    }
  }

  /**
   * A/B test storyboard variations
   */
  async compareStoryboards(
    storyboardIds: string[],
    userId: string,
  ): Promise<{
    comparison: Array<{
      storyboardId: string;
      topic: string;
      scores: {
        clarity: number;
        engagement: number;
        persuasiveness: number;
        overall: number;
      };
      recommendation: string;
    }>;
    bestChoice: string;
  }> {
    const storyboards = await Promise.all(
      storyboardIds.map((id) => this.getStoryboard(id, userId)),
    );

    const analyses = await Promise.all(
      storyboards.map(async (sb) => {
        const flow = await this.analyzeStoryFlow(sb.id, userId);

        // Calculate dimension scores
        const clarity = Math.min(
          100,
          flow.score + (sb.sections.length <= 10 ? 10 : 0),
        );
        const engagement = Math.min(
          100,
          flow.score + (flow.emotionalJourney.length > 0 ? 15 : 0),
        );
        const persuasiveness = Math.min(
          100,
          flow.score + (sb.presentationType === 'pitch' ? 10 : 0),
        );
        const overall = (clarity + engagement + persuasiveness) / 3;

        return {
          storyboardId: sb.id,
          topic: this.safeString('topic', sb, 'Presentation'),
          scores: {
            clarity: Math.round(clarity),
            engagement: Math.round(engagement),
            persuasiveness: Math.round(persuasiveness),
            overall: Math.round(overall),
          },
          recommendation:
            overall >= 80
              ? 'Excellent choice'
              : overall >= 70
                ? 'Good option'
                : 'Needs improvement',
        };
      }),
    );

    const bestChoice = analyses.reduce((best, current) =>
      current.scores.overall > best.scores.overall ? current : best,
    ).storyboardId;

    return {
      comparison: analyses,
      bestChoice,
    };
  }
}
