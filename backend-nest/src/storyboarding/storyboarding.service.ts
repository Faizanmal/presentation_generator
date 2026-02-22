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
        sections,
        audienceType,
        presentationType,
      );

      // Generate transition suggestions
      const transitions = this.generateTransitionSuggestions(
        sections,
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
        return JSON.parse(jsonMatch[0]);
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
}
