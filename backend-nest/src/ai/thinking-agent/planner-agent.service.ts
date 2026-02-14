import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIService } from '../ai.service';
import {
  PresentationPlan,
  EnhancedGenerationParams,
  ThinkingStep,
  AudienceProfile,
  ContentStrategy,
  StructurePlan,
  VisualStrategy,
} from './thinking-agent.types';

/**
 * Planner Agent Service
 *
 * Responsible for the PLANNING phase of the thinking loop.
 * Analyzes user requirements and creates a comprehensive presentation plan
 * before any content generation begins.
 */
@Injectable()
export class PlannerAgentService {
  private readonly logger = new Logger(PlannerAgentService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Create a comprehensive presentation plan using chain-of-thought reasoning
   */
  async createPlan(params: EnhancedGenerationParams): Promise<{
    plan: PresentationPlan;
    thinkingSteps: ThinkingStep[];
  }> {
    const thinkingSteps: ThinkingStep[] = [];
    const startStep = Date.now();

    // Step 1: Analyze the topic and extract key concepts
    this.logger.log(
      '🧠 Step 1: Analyzing topic and extracting key concepts...',
    );
    const topicAnalysis = await this.analyzeTopicDeep(
      params.topic,
      params.additionalContext,
    );
    thinkingSteps.push({
      stepNumber: 1,
      phase: 'planning',
      thought: `Analyzed topic "${params.topic}" - identified ${topicAnalysis.keyConcepts.length} key concepts and ${topicAnalysis.potentialAngles.length} potential angles.`,
      action: 'Topic deep analysis',
      observation: `Main theme: ${topicAnalysis.mainTheme}, Complexity: ${topicAnalysis.complexity}`,
      timestamp: new Date(),
    });

    if (params.rawData) {
      // Step 1b: Analyze raw data if present
      this.logger.log('🧠 Step 1b: Analyzing raw data...');
      const rawDataAnalysis = await this.analyzeRawData(
        params.rawData,
        params.topic,
        params.additionalContext,
      );

      // Merge analysis
      topicAnalysis.mainTheme = rawDataAnalysis.mainTheme;
      topicAnalysis.keyConcepts = [
        ...new Set([
          ...topicAnalysis.keyConcepts,
          ...rawDataAnalysis.keyConcepts,
        ]),
      ];
      topicAnalysis.potentialAngles = [
        ...new Set([
          ...topicAnalysis.potentialAngles,
          ...rawDataAnalysis.potentialAngles,
        ]),
      ];

      thinkingSteps.push({
        stepNumber: 1,
        phase: 'planning',
        thought: `Analyzed raw data input - extracted structural insights and content hierarchy.`,
        action: 'Raw data analysis',
        observation: `Data structured into ${rawDataAnalysis.keyConcepts.length} key sections`,
        timestamp: new Date(),
      });
    }

    // Step 2: Profile the target audience
    this.logger.log('🧠 Step 2: Profiling target audience...');
    const audienceProfile = await this.profileAudience(
      params.audience || 'general',
      params.topic,
      topicAnalysis.complexity,
    );
    thinkingSteps.push({
      stepNumber: 2,
      phase: 'planning',
      thought: `Profiled audience "${params.audience}" - knowledge level: ${audienceProfile.knowledgeLevel}, key interests identified.`,
      action: 'Audience profiling',
      observation: `Pain points: ${audienceProfile.painPoints.join(', ')}`,
      timestamp: new Date(),
    });

    // Step 3: Develop content strategy
    this.logger.log('🧠 Step 3: Developing content strategy...');
    const contentStrategy = await this.developContentStrategy(
      params,
      topicAnalysis,
      audienceProfile,
    );
    thinkingSteps.push({
      stepNumber: 3,
      phase: 'planning',
      thought: `Developed ${contentStrategy.narrativeArc} narrative arc with ${contentStrategy.hookType} hook.`,
      action: 'Content strategy development',
      observation: `Storytelling approach: ${contentStrategy.storytellingApproach}`,
      timestamp: new Date(),
    });

    // Step 4: Plan structure
    this.logger.log('🧠 Step 4: Planning presentation structure...');
    const structurePlan = await this.planStructure(params, contentStrategy);
    thinkingSteps.push({
      stepNumber: 4,
      phase: 'planning',
      thought: `Planned ${structurePlan.openingSlides + structurePlan.contentSlides + structurePlan.dataSlides + structurePlan.closingSlides} slides total.`,
      action: 'Structure planning',
      observation: `Transition points: ${structurePlan.transitionPoints.join(', ')}`,
      timestamp: new Date(),
    });

    // Step 5: Define visual strategy
    this.logger.log('🧠 Step 5: Defining visual strategy...');
    const visualStrategy = await this.defineVisualStrategy(
      params,
      contentStrategy,
    );
    thinkingSteps.push({
      stepNumber: 5,
      phase: 'planning',
      thought: `Defined ${visualStrategy.colorMood} color mood with ${visualStrategy.imageStyle} image style.`,
      action: 'Visual strategy definition',
      observation: `Layout variety: ${visualStrategy.layoutVariety.join(', ')}`,
      timestamp: new Date(),
    });

    // Step 6: Synthesize final plan
    this.logger.log('🧠 Step 6: Synthesizing comprehensive plan...');
    const keyMessages = await this.extractKeyMessages(
      params.topic,
      topicAnalysis,
      audienceProfile,
    );
    const potentialChallenges = this.identifyChallenges(
      params,
      audienceProfile,
    );

    const plan: PresentationPlan = {
      mainObjective: topicAnalysis.mainTheme,
      targetAudience: audienceProfile,
      contentStrategy,
      structurePlan,
      visualStrategy,
      estimatedSlides: params.length || 8,
      keyMessages,
      potentialChallenges,
    };

    thinkingSteps.push({
      stepNumber: 6,
      phase: 'planning',
      thought: `Synthesized comprehensive plan with ${keyMessages.length} key messages.`,
      action: 'Plan synthesis',
      observation: `Total planning time: ${Date.now() - startStep}ms`,
      timestamp: new Date(),
    });

    this.logger.log(`✅ Planning complete in ${Date.now() - startStep}ms`);

    return { plan, thinkingSteps };
  }

  /**
   * Deep topic analysis using chain-of-thought
   */
  private async analyzeTopicDeep(
    topic: string,
    additionalContext?: string,
  ): Promise<{
    mainTheme: string;
    keyConcepts: string[];
    potentialAngles: string[];
    complexity: 'simple' | 'moderate' | 'complex';
    relatedTopics: string[];
  }> {
    const prompt = `You are an expert content strategist. Analyze this presentation topic using step-by-step reasoning.

TOPIC: "${topic}"
${additionalContext ? `ADDITIONAL CONTEXT: ${additionalContext}` : ''}

Think through this step by step:
1. What is the core theme or main message?
2. What are the key concepts that must be explained?
3. What are different angles or perspectives to approach this topic?
4. How complex is this topic for a general audience?
5. What related topics might enrich the presentation?

Return JSON:
{
  "reasoning": "Your step-by-step thought process...",
  "mainTheme": "The central message",
  "keyConcepts": ["concept1", "concept2", ...],
  "potentialAngles": ["angle1", "angle2", ...],
  "complexity": "simple|moderate|complex",
  "relatedTopics": ["topic1", "topic2", ...]
}`;

    const response = await this.callAI(prompt);
    return this.parseJSON(response, {
      mainTheme: topic,
      keyConcepts: [topic],
      potentialAngles: ['overview'],
      complexity: 'moderate' as const,
      relatedTopics: [],
    });
  }

  /**
   * Analyze raw unstructured data
   */
  private async analyzeRawData(
    rawData: string,
    topic: string,
    additionalContext?: string,
  ): Promise<{
    mainTheme: string;
    keyConcepts: string[];
    potentialAngles: string[];
    structureSuggestion: string;
  }> {
    const prompt = `You are an expert data analyst and content strategist. Analyze this raw unstructured data to create a presentation structure.
    
RAW DATA:
"${rawData.substring(0, 5000)}..." ${rawData.length > 5000 ? '(truncated)' : ''}

TOPIC/TITLE: "${topic}"
${additionalContext ? `CONTEXT: ${additionalContext}` : ''}

Think step by step:
1. What is the core message hidden in this raw data?
2. Extract the key topics/sections naturally present in the data.
3. How should this data be structured for a presentation?

Return JSON:
{
  "reasoning": "Your analysis...",
  "mainTheme": "The extracted central theme",
  "keyConcepts": ["concept1", "concept2", ...],
  "potentialAngles": ["angle1", "angle2", ...],
  "structureSuggestion": "Brief description of suggested structure"
}`;

    const response = await this.callAI(prompt);
    const parsed = this.parseJSON(response, {
      mainTheme: topic,
      keyConcepts: [topic],
      potentialAngles: ['data-driven'],
      structureSuggestion: 'Standard flow',
    });

    // Ensure return type matches
    return {
      mainTheme: parsed.mainTheme || topic,
      keyConcepts: parsed.keyConcepts || [topic],
      potentialAngles: parsed.potentialAngles || [],
      structureSuggestion: parsed.structureSuggestion || 'Standard flow',
    };
  }

  /**
   * Create detailed audience profile
   */
  private async profileAudience(
    audienceDescription: string,
    topic: string,
    complexity: string,
  ): Promise<AudienceProfile> {
    const prompt = `You are an audience research specialist. Create a detailed audience profile.

AUDIENCE: "${audienceDescription}"
TOPIC: "${topic}"
TOPIC COMPLEXITY: ${complexity}

Think step by step:
1. What is their likely knowledge level about this topic?
2. What are their main interests related to this content?
3. What pain points or challenges might they have?
4. What do they hope to gain from this presentation?

Return JSON:
{
  "reasoning": "Your step-by-step analysis...",
  "type": "audience type description",
  "knowledgeLevel": "beginner|intermediate|expert",
  "interests": ["interest1", "interest2", ...],
  "painPoints": ["pain1", "pain2", ...],
  "expectedOutcome": "what they want to achieve"
}`;

    const response = await this.callAI(prompt);
    return this.parseJSON(response, {
      type: audienceDescription,
      knowledgeLevel: 'intermediate' as const,
      interests: [],
      painPoints: [],
      expectedOutcome: 'Learn about ' + topic,
    });
  }

  /**
   * Develop content strategy with narrative arc
   */
  private async developContentStrategy(
    params: EnhancedGenerationParams,
    topicAnalysis: { mainTheme: string; complexity: string },
    audienceProfile: AudienceProfile,
  ): Promise<ContentStrategy> {
    const prompt = `You are a storytelling expert for presentations. Develop a content strategy.

TOPIC: "${params.topic}"
TONE: ${params.tone || 'professional'}
AUDIENCE: ${audienceProfile.type} (${audienceProfile.knowledgeLevel} level)
COMPLEXITY: ${topicAnalysis.complexity}
STYLE: ${params.style || 'professional'}

Think step by step:
1. What narrative arc works best? (Hero's journey, Problem-Solution, Compare-Contrast, etc.)
2. What type of hook will grab their attention?
3. How should we conclude for maximum impact?
4. How much data/evidence should we include?
5. What storytelling techniques will resonate?

Return JSON:
{
  "reasoning": "Your step-by-step strategy development...",
  "narrativeArc": "chosen narrative structure",
  "hookType": "question|statistic|story|quote|provocation",
  "conclusionStyle": "call-to-action|summary|vision|challenge",
  "dataUsage": "minimal|moderate|heavy",
  "storytellingApproach": "description of approach"
}`;

    const response = await this.callAI(prompt);
    return this.parseJSON(response, {
      narrativeArc: 'Problem-Solution',
      hookType: 'question',
      conclusionStyle: 'call-to-action',
      dataUsage: 'moderate' as const,
      storytellingApproach: 'Clear and engaging',
    });
  }

  /**
   * Plan the presentation structure
   */
  private async planStructure(
    params: EnhancedGenerationParams,
    contentStrategy: ContentStrategy,
  ): Promise<StructurePlan> {
    const totalSlides = params.length || 8;
    const prompt = `You are a presentation structure expert. Plan the slide structure.

TOPIC: "${params.topic}"
TOTAL SLIDES: ${totalSlides}
NARRATIVE ARC: ${contentStrategy.narrativeArc}
HOOK TYPE: ${contentStrategy.hookType}
DATA USAGE: ${contentStrategy.dataUsage}

Think step by step:
1. How many opening/hook slides do we need?
2. How many main content slides for the core message?
3. How many data/evidence slides are appropriate?
4. How many closing/CTA slides?
5. Where are the key transition points?

Return JSON:
{
  "reasoning": "Your step-by-step structure planning...",
  "openingSlides": 1,
  "contentSlides": 4,
  "dataSlides": 2,
  "closingSlides": 1,
  "transitionPoints": ["After intro to problem", "After solution reveal", ...]
}`;

    const response = await this.callAI(prompt);
    return this.parseJSON(response, {
      openingSlides: 1,
      contentSlides: Math.floor(totalSlides * 0.5),
      dataSlides: Math.floor(totalSlides * 0.25),
      closingSlides: 1,
      transitionPoints: ['After introduction', 'Before conclusion'],
    });
  }

  /**
   * Define visual strategy
   */
  private async defineVisualStrategy(
    params: EnhancedGenerationParams,
    contentStrategy: ContentStrategy,
  ): Promise<VisualStrategy> {
    const prompt = `You are a presentation design expert. Define the visual strategy.

TOPIC: "${params.topic}"
TONE: ${params.tone || 'professional'}
STYLE: ${params.style || 'professional'}
DATA USAGE: ${contentStrategy.dataUsage}
${params.brandGuidelines ? `BRAND COLORS: ${params.brandGuidelines.colors?.join(', ')}` : ''}

Think step by step:
1. What color mood fits this presentation?
2. What image style would be most effective?
3. What chart types work best for this content?
4. What variety of layouts should we use?

Return JSON:
{
  "reasoning": "Your step-by-step visual strategy...",
  "colorMood": "professional|vibrant|minimal|warm|cool|bold",
  "imageStyle": "photography|illustration|abstract|iconographic|mixed",
  "chartPreference": "clean-minimal|detailed|infographic|animated",
  "layoutVariety": ["layout1", "layout2", ...]
}`;

    const response = await this.callAI(prompt);
    return this.parseJSON(response, {
      colorMood: 'professional',
      imageStyle: 'photography',
      chartPreference: 'clean-minimal',
      layoutVariety: ['title-content', 'two-column', 'image-right'],
    });
  }

  /**
   * Extract key messages from topic analysis
   */
  private async extractKeyMessages(
    topic: string,
    topicAnalysis: { mainTheme: string; keyConcepts: string[] },
    audienceProfile: AudienceProfile,
  ): Promise<string[]> {
    const prompt = `You are a key message strategist. Extract the most important messages.

TOPIC: "${topic}"
MAIN THEME: ${topicAnalysis.mainTheme}
KEY CONCEPTS: ${topicAnalysis.keyConcepts.join(', ')}
AUDIENCE: ${audienceProfile.type}
EXPECTED OUTCOME: ${audienceProfile.expectedOutcome}

What are the 3-5 key messages the audience should remember?

Return JSON:
{
  "reasoning": "Your message extraction process...",
  "keyMessages": ["message1", "message2", ...]
}`;

    const response = await this.callAI(prompt);
    const parsed = this.parseJSON(response, {
      keyMessages: [topicAnalysis.mainTheme],
    });
    return parsed.keyMessages;
  }

  /**
   * Identify potential challenges
   */
  private identifyChallenges(
    params: EnhancedGenerationParams,
    audienceProfile: AudienceProfile,
  ): string[] {
    const challenges: string[] = [];

    // Knowledge level challenges
    if (audienceProfile.knowledgeLevel === 'beginner') {
      challenges.push('Need to explain technical concepts simply');
    } else if (audienceProfile.knowledgeLevel === 'expert') {
      challenges.push('Need to provide advanced insights, not basics');
    }

    // Length challenges
    if ((params.length || 8) < 5) {
      challenges.push('Limited slides - must be very concise');
    } else if ((params.length || 8) > 15) {
      challenges.push('Many slides - need to maintain engagement');
    }

    // Tone challenges
    if (params.tone === 'casual' && params.type === 'pitch-deck') {
      challenges.push('Balance casual tone with professional credibility');
    }

    return challenges;
  }

  /**
   * Call AI with fallback
   */
  /**
   * Call AI with fallback using centralized service
   */
  private async callAI(prompt: string): Promise<string> {
    const options = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert AI assistant. Always respond with valid JSON. Think through problems step by step.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    };

    try {
      const response = await this.aiService.chatCompletion(options);
      return response.choices[0]?.message?.content || '{}';
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
      const parsed = JSON.parse(content) as T;
      return parsed;
    } catch {
      this.logger.warn('Failed to parse AI response, using fallback');
      return fallback;
    }
  }
}
