import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';

// Types for AI generation
export interface GenerationParams {
  topic: string;
  tone?: string;
  audience?: string;
  length?: number;
  type?: string;
  generateImages?: boolean;
  smartLayout?: boolean;
}

export interface GeneratedBlock {
  type: string;
  content: string;
  chartData?: ChartData;
  embedUrl?: string;
  embedType?: 'youtube' | 'vimeo' | 'figma' | 'miro' | 'custom';
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'scatter';
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
  }>;
  options?: Record<string, any>;
}

export type LayoutType =
  | 'title'
  | 'title-content'
  | 'two-column'
  | 'image-left'
  | 'image-right'
  | 'image-full'
  | 'comparison'
  | 'timeline'
  | 'quote-highlight'
  | 'stats-grid'
  | 'chart-focus';

export interface GeneratedSection {
  heading: string;
  blocks: GeneratedBlock[];
  layout: LayoutType;
  suggestedImage?: string;
  speakerNotes?: string;
}

export interface GeneratedPresentation {
  title: string;
  sections: GeneratedSection[];
  metadata?: {
    estimatedDuration: number;
    keywords: string[];
    summary: string;
  };
}

export interface ImageGenerationResult {
  url: string;
  revisedPrompt: string;
}

export interface TextToSpeechResult {
  audioBuffer: Buffer;
  duration: number;
}

export interface AIInsight {
  type: 'improvement' | 'warning' | 'tip' | 'success';
  title: string;
  description: string;
  actionable: boolean;
  priority: 'high' | 'medium' | 'low';
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Generate a full presentation/document structure using AI
   */
  async generatePresentation(
    params: GenerationParams,
  ): Promise<GeneratedPresentation> {
    const {
      topic,
      tone = 'professional',
      audience = 'general',
      length = 5,
      type = 'presentation',
    } = params;

    const systemPrompt = this.buildSystemPrompt(type);
    const userPrompt = this.buildUserPrompt(
      topic,
      tone,
      audience,
      length,
      type,
    );

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new InternalServerErrorException('No content generated from AI');
      }

      // Parse and validate the response
      const parsed = this.parseAndValidateResponse(content);

      // Log the generation for analytics
      await this.logGeneration(
        params,
        parsed,
        response.usage?.total_tokens || 0,
      );

      this.logger.log(
        `Generated ${type} with ${parsed.sections.length} sections`,
      );

      return parsed;
    } catch (error) {
      this.logger.error('AI generation failed', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to generate content. Please try again.',
      );
    }
  }

  /**
   * Build the system prompt for the AI
   */
  private buildSystemPrompt(type: string): string {
    const isPresentation = type === 'presentation';

    return `You are a professional ${isPresentation ? 'presentation' : 'document'} creator with expertise in creating compelling, well-structured content.

Your task is to generate a complete ${isPresentation ? 'presentation' : 'document'} structure based on user requirements.

IMPORTANT RULES:
1. Return ONLY valid JSON - no markdown, no explanations
2. Create engaging, informative content
3. Use clear, concise language
4. Structure content logically
5. Include a compelling title
6. Each section should have a clear heading and supporting content blocks

JSON STRUCTURE (FOLLOW EXACTLY):
{
  "title": "Compelling title for the ${isPresentation ? 'presentation' : 'document'}",
  "sections": [
    {
      "heading": "Section heading",
      "blocks": [
        { "type": "bullet", "content": "Key point 1" },
        { "type": "bullet", "content": "Key point 2" },
        { "type": "paragraph", "content": "Supporting text..." }
      ]
    }
  ]
}

AVAILABLE BLOCK TYPES:
- "bullet" - For bullet points (use for lists of items)
- "paragraph" - For explanatory text
- "subheading" - For sub-sections within a slide
- "quote" - For impactful quotes or statistics
- "numbered" - For numbered/ordered lists

${
  isPresentation
    ? 'For presentations: Keep each section focused on ONE key idea. Use bullet points for easy scanning. Limit content per slide.'
    : 'For documents: Provide more detailed content. Use paragraphs for explanations. Structure with clear headings.'
}`;
  }

  /**
   * Build the user prompt with specific parameters
   */
  private buildUserPrompt(
    topic: string,
    tone: string,
    audience: string,
    length: number,
    type: string,
  ): string {
    return `Create a ${type} about: "${topic}"

SPECIFICATIONS:
- Tone: ${tone}
- Target audience: ${audience}
- Number of sections/slides: ${length}

REQUIREMENTS:
1. First section should be a title slide with introduction
2. Middle sections should cover key points
3. Last section should be a summary/conclusion
4. Each section should have 3-5 content blocks
5. Content should be relevant and valuable to the target audience

Generate the complete ${type} structure in JSON format.`;
  }

  /**
   * Parse and validate the AI response
   */
  /**
   * Parse and validate the AI response
   */
  /**
   * Parse and validate the AI response
   */
  private parseAndValidateResponse(content: string): GeneratedPresentation {
    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch {
      this.logger.error('Failed to parse AI response as JSON', content);
      throw new BadRequestException(
        'AI generated invalid content. Please try again.',
      );
    }

    // Validate structure
    if (typeof parsed !== 'object' || parsed === null) {
      throw new BadRequestException('Invalid JSON structure');
    }

    const typedParsed = parsed as { title?: unknown; sections?: unknown };

    if (typeof typedParsed.title !== 'string' || !typedParsed.title) {
      throw new BadRequestException('Generated content missing title');
    }

    if (
      !Array.isArray(typedParsed.sections) ||
      typedParsed.sections.length === 0
    ) {
      throw new BadRequestException('Generated content missing sections');
    }

    const sections: GeneratedSection[] = [];

    // Validate each section
    for (const section of typedParsed.sections as unknown[]) {
      if (typeof section !== 'object' || section === null) {
        continue;
      }

      const typedSection = section as { heading?: unknown; blocks?: unknown };

      if (typeof typedSection.heading !== 'string' || !typedSection.heading) {
        throw new BadRequestException('Section missing heading');
      }

      let blocks: GeneratedBlock[] = [];

      if (Array.isArray(typedSection.blocks)) {
        blocks = typedSection.blocks.filter(
          (block: unknown): block is GeneratedBlock => {
            if (typeof block !== 'object' || block === null) return false;
            const b = block as { type?: unknown; content?: unknown };
            return typeof b.type === 'string' && typeof b.content === 'string';
          },
        );
      }

      sections.push({
        heading: typedSection.heading,
        blocks,
        layout: 'title-content' as const,
      });
    }

    return {
      title: typedParsed.title,
      sections,
    };
  }

  /**
   * Log AI generation for analytics
   */
  private async logGeneration(
    params: GenerationParams,
    result: GeneratedPresentation,
    tokens: number,
  ) {
    try {
      await this.prisma.aIGeneration.create({
        data: {
          userId: 'system', // Will be updated when called from service
          prompt: JSON.stringify(params),
          response: result as unknown as any, // Cast to any to satisfy Prisma InputJsonValue if needed, but prefer simpler object
          tokens,
          model: 'gpt-4o',
        },
      });
    } catch (error) {
      // Don't fail if logging fails
      this.logger.warn('Failed to log AI generation', error);
    }
  }

  /**
   * Enhance existing content using AI
   */
  async enhanceContent(content: string, instruction: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a content enhancement assistant. Improve the given content based on the instruction. Return only the enhanced content, no explanations.',
          },
          {
            role: 'user',
            content: `Content: "${content}"\n\nInstruction: ${instruction}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return response.choices[0]?.message?.content || content;
    } catch (error) {
      this.logger.error('Content enhancement failed', error);
      throw new InternalServerErrorException('Failed to enhance content');
    }
  }

  /**
   * Generate suggestions for improving a presentation
   */
  async generateSuggestions(
    presentation: GeneratedPresentation,
  ): Promise<string[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a presentation coach. Analyze the presentation and provide 3-5 actionable suggestions for improvement. Return as JSON array of strings.',
          },
          {
            role: 'user',
            content: JSON.stringify(presentation),
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];

      const parsed = JSON.parse(content) as { suggestions?: string[] };
      return Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    } catch (error) {
      this.logger.error('Failed to generate suggestions', error);
      return [];
    }
  }

  // ============================================
  // ADVANCED AI FEATURES - GAMMA LEVEL
  // ============================================

  /**
   * Generate an image using DALL-E 3
   */
  async generateImage(
    prompt: string,
    style: 'vivid' | 'natural' = 'vivid',
    size: '1024x1024' | '1792x1024' | '1024x1792' = '1792x1024',
  ): Promise<ImageGenerationResult> {
    try {
      const enhancedPrompt = `Create a professional, clean presentation visual for: ${prompt}. 
Style: Modern, minimalist, suitable for business presentations. 
No text overlays, clean composition, high quality.`;

      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        n: 1,
        size,
        style,
        quality: 'hd',
      });

      const imageData = response.data?.[0];
      if (!imageData?.url) {
        throw new InternalServerErrorException('No image generated');
      }

      this.logger.log(
        `Generated image for prompt: ${prompt.substring(0, 50)}...`,
      );

      return {
        url: imageData.url,
        revisedPrompt: imageData.revised_prompt || prompt,
      };
    } catch (error) {
      this.logger.error('Image generation failed', error);
      throw new InternalServerErrorException(
        'Failed to generate image. Please try again.',
      );
    }
  }

  /**
   * Generate multiple images for a presentation
   */
  async generatePresentationImages(
    sections: GeneratedSection[],
  ): Promise<Map<number, ImageGenerationResult>> {
    const imageMap = new Map<number, ImageGenerationResult>();

    // Generate images for sections that have suggestedImage
    const imagePromises = sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.suggestedImage)
      .map(async ({ section, index }) => {
        try {
          const result = await this.generateImage(section.suggestedImage!);
          imageMap.set(index, result);
        } catch (error) {
          this.logger.warn(
            `Failed to generate image for section ${index}`,
            error,
          );
        }
      });

    await Promise.allSettled(imagePromises);
    return imageMap;
  }

  /**
   * Generate text-to-speech narration using OpenAI TTS
   */
  async generateNarration(
    text: string,
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova',
    speed: number = 1.0,
  ): Promise<TextToSpeechResult> {
    try {
      // Limit text length for TTS
      const truncatedText = text.length > 4096 ? text.substring(0, 4096) : text;

      const response = await this.openai.audio.speech.create({
        model: 'tts-1-hd',
        voice,
        input: truncatedText,
        speed: Math.max(0.25, Math.min(4.0, speed)),
      });

      const buffer = Buffer.from(await response.arrayBuffer());

      // Estimate duration (roughly 150 words per minute)
      const wordCount = truncatedText.split(/\s+/).length;
      const estimatedDuration = ((wordCount / 150) * 60) / speed;

      this.logger.log(
        `Generated narration: ${wordCount} words, ~${Math.round(estimatedDuration)}s`,
      );

      return {
        audioBuffer: buffer,
        duration: estimatedDuration,
      };
    } catch (error) {
      this.logger.error('Narration generation failed', error);
      throw new InternalServerErrorException('Failed to generate narration');
    }
  }

  /**
   * Generate speaker notes for all slides
   */
  async generateAllSpeakerNotes(
    presentation: GeneratedPresentation,
  ): Promise<string[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a presentation coach. Generate concise speaker notes for each slide.
Each note should:
1. Summarize key talking points (2-3 sentences)
2. Include transition cues
3. Suggest emphasis points
Return as JSON: { "notes": ["Note for slide 1", "Note for slide 2", ...] }`,
          },
          {
            role: 'user',
            content: JSON.stringify(presentation),
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];

      const parsed = JSON.parse(content) as { notes?: string[] };
      return Array.isArray(parsed.notes) ? parsed.notes : [];
    } catch (error) {
      this.logger.error('Failed to generate speaker notes', error);
      return [];
    }
  }

  /**
   * Smart layout recommendation based on content
   */
  async recommendLayout(
    content: GeneratedBlock[],
    heading: string,
  ): Promise<LayoutType> {
    // Analyze content to recommend layout
    const hasImage = content.some((b) => b.type === 'image');
    const hasChart = content.some((b) => b.type === 'chart');
    const hasQuote = content.some((b) => b.type === 'quote');
    const bulletCount = content.filter((b) => b.type === 'bullet').length;
    const hasComparison =
      heading.toLowerCase().includes('vs') ||
      heading.toLowerCase().includes('comparison') ||
      heading.toLowerCase().includes('versus');
    const hasTimeline =
      heading.toLowerCase().includes('timeline') ||
      heading.toLowerCase().includes('history') ||
      heading.toLowerCase().includes('roadmap');
    const hasStats = content.some((b) =>
      b.content.match(/\d+%|\$[\d,]+|\d+\s*(million|billion|k)/i),
    );

    // Priority-based layout selection
    if (hasChart) return 'chart-focus';
    if (hasTimeline) return 'timeline';
    if (hasComparison) return 'comparison';
    if (hasStats && bulletCount >= 3) return 'stats-grid';
    if (hasQuote) return 'quote-highlight';
    if (hasImage && bulletCount > 2) return 'image-left';
    if (hasImage) return 'image-right';
    if (bulletCount >= 6) return 'two-column';
    if (
      heading.toLowerCase().includes('introduction') ||
      heading.toLowerCase().includes('welcome')
    )
      return 'title';

    return 'title-content';
  }

  /**
   * Generate chart data from natural language
   */
  async generateChartData(
    description: string,
    chartType: ChartData['type'] = 'bar',
  ): Promise<ChartData> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a data visualization expert. Generate chart data based on the description.
Return JSON in this exact format:
{
  "type": "${chartType}",
  "labels": ["Label1", "Label2", ...],
  "datasets": [{
    "label": "Dataset name",
    "data": [10, 20, 30, ...],
    "backgroundColor": ["#3b82f6", "#10b981", "#f59e0b", ...]
  }]
}
Generate realistic, plausible data that matches the description.`,
          },
          {
            role: 'user',
            content: description,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No chart data generated');
      }

      return JSON.parse(content) as ChartData;
    } catch (error) {
      this.logger.error('Chart data generation failed', error);
      // Return default chart data
      return {
        type: chartType,
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        datasets: [
          {
            label: 'Data',
            data: [25, 35, 45, 55],
            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
          },
        ],
      };
    }
  }

  /**
   * Advanced presentation generation with smart layouts and image suggestions
   */
  async generateAdvancedPresentation(
    params: GenerationParams,
  ): Promise<GeneratedPresentation> {
    const {
      topic,
      tone = 'professional',
      audience = 'general',
      length = 5,
      type = 'presentation',
      generateImages = false,
      smartLayout = true,
    } = params;

    const systemPrompt = this.buildAdvancedSystemPrompt(type);
    const userPrompt = this.buildAdvancedUserPrompt(
      topic,
      tone,
      audience,
      length,
      type,
    );

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 6000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new InternalServerErrorException('No content generated from AI');
      }

      const parsed = this.parseAdvancedResponse(content);

      // Apply smart layouts if enabled
      if (smartLayout) {
        for (const section of parsed.sections) {
          if (!section.layout) {
            section.layout = await this.recommendLayout(
              section.blocks,
              section.heading,
            );
          }
        }
      }

      // Generate images if enabled
      if (generateImages) {
        const imageMap = await this.generatePresentationImages(parsed.sections);
        imageMap.forEach((image, index) => {
          if (parsed.sections[index]) {
            parsed.sections[index].blocks.unshift({
              type: 'image',
              content: image.url,
            });
          }
        });
      }

      // Log generation
      await this.logGeneration(
        params,
        parsed,
        response.usage?.total_tokens || 0,
      );

      this.logger.log(
        `Generated advanced ${type} with ${parsed.sections.length} sections`,
      );

      return parsed;
    } catch (error) {
      this.logger.error('Advanced AI generation failed', error);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        'Failed to generate content. Please try again.',
      );
    }
  }

  /**
   * Build advanced system prompt
   */
  private buildAdvancedSystemPrompt(type: string): string {
    const isPresentation = type === 'presentation';

    return `You are an elite ${isPresentation ? 'presentation' : 'document'} designer, similar to the team at Gamma.app.
Create compelling, visually-oriented content with smart layout suggestions.

IMPORTANT RULES:
1. Return ONLY valid JSON
2. Use storytelling techniques - hook, problem, solution, evidence, call-to-action
3. Suggest appropriate layouts for each section
4. Include image descriptions for visual slides
5. Add speaker notes for key slides

JSON STRUCTURE:
{
  "title": "Compelling title",
  "metadata": {
    "estimatedDuration": 10,
    "keywords": ["key", "terms"],
    "summary": "Brief summary"
  },
  "sections": [
    {
      "heading": "Section heading",
      "layout": "title-content|two-column|image-left|image-right|comparison|timeline|quote-highlight|stats-grid|chart-focus",
      "suggestedImage": "Description for AI image generation (optional)",
      "speakerNotes": "Notes for presenter (optional)",
      "blocks": [
        { "type": "bullet|paragraph|subheading|quote|numbered|chart|embed", "content": "..." }
      ]
    }
  ]
}

LAYOUT OPTIONS:
- title: Title/intro slides
- title-content: Standard content slide
- two-column: Side-by-side comparison or dual content
- image-left/image-right: Content with featured image
- comparison: A vs B layouts
- timeline: Chronological content
- quote-highlight: Featured quote with attribution
- stats-grid: Multiple statistics displayed prominently
- chart-focus: Data visualization focused

For chart blocks, include chartData: { type: "bar|line|pie", description: "what to visualize" }
For embed blocks, include embedUrl and embedType: "youtube|vimeo|figma|miro"`;
  }

  /**
   * Build advanced user prompt
   */
  private buildAdvancedUserPrompt(
    topic: string,
    tone: string,
    audience: string,
    length: number,
    type: string,
  ): string {
    return `Create a stunning ${type} about: "${topic}"

SPECIFICATIONS:
- Tone: ${tone}
- Target audience: ${audience}
- Number of sections: ${length}

STRUCTURE REQUIREMENTS:
1. Start with a hook/attention-grabbing slide
2. Present the problem or opportunity
3. Provide solution/main content (2-3 slides)
4. Include evidence/data (with chart if applicable)
5. End with clear call-to-action and summary

QUALITY REQUIREMENTS:
- Each slide should have a clear purpose
- Use data and statistics where relevant
- Suggest images for visual impact
- Include speaker notes for complex slides
- Vary layouts for visual interest

Generate the complete ${type} with all metadata.`;
  }

  /**
   * Parse advanced AI response
   */
  private parseAdvancedResponse(content: string): GeneratedPresentation {
    let parsed: any;

    try {
      parsed = JSON.parse(content);
    } catch {
      this.logger.error('Failed to parse advanced AI response', content);
      throw new BadRequestException(
        'AI generated invalid content. Please try again.',
      );
    }

    if (!parsed.title || !Array.isArray(parsed.sections)) {
      throw new BadRequestException('Invalid presentation structure');
    }

    const sections: GeneratedSection[] = parsed.sections.map(
      (section: any) => ({
        heading: section.heading || 'Untitled',
        layout: section.layout || 'title-content',
        suggestedImage: section.suggestedImage,
        speakerNotes: section.speakerNotes,
        blocks: (section.blocks || []).map((block: any) => ({
          type: block.type || 'paragraph',
          content: block.content || '',
          chartData: block.chartData,
          embedUrl: block.embedUrl,
          embedType: block.embedType,
        })),
      }),
    );

    return {
      title: parsed.title,
      sections,
      metadata: parsed.metadata || {
        estimatedDuration: sections.length * 2,
        keywords: [],
        summary: '',
      },
    };
  }

  /**
   * Generate AI insights for analytics
   */
  async generateAnalyticsInsights(analyticsData: {
    totalViews: number;
    uniqueViews: number;
    averageDuration: number;
    completionRate: number;
    dropOffSlide: number | null;
    topSlides: Array<{
      slideIndex: number;
      averageDuration: number;
      viewCount: number;
    }>;
    totalSlides: number;
  }): Promise<AIInsight[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a presentation analytics expert. Analyze the data and provide actionable insights.
Return JSON: {
  "insights": [
    {
      "type": "improvement|warning|tip|success",
      "title": "Short title",
      "description": "Detailed explanation",
      "actionable": true,
      "priority": "high|medium|low"
    }
  ]
}
Provide 3-5 specific, actionable insights based on the data patterns.`,
          },
          {
            role: 'user',
            content: JSON.stringify(analyticsData),
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];

      const parsed = JSON.parse(content) as { insights?: AIInsight[] };
      return Array.isArray(parsed.insights) ? parsed.insights : [];
    } catch (error) {
      this.logger.error('Failed to generate analytics insights', error);
      return [];
    }
  }

  /**
   * Translate content to another language
   */
  async translateContent(
    content: string,
    targetLanguage: string,
    preserveFormatting: boolean = true,
  ): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the content to ${targetLanguage}.
${preserveFormatting ? 'Preserve all formatting, bullet points, and structure.' : ''}
Return only the translated content, no explanations.`,
          },
          {
            role: 'user',
            content,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      return response.choices[0]?.message?.content || content;
    } catch (error) {
      this.logger.error('Translation failed', error);
      throw new InternalServerErrorException('Failed to translate content');
    }
  }

  /**
   * Extract content from uploaded document for presentation generation
   */
  async extractAndStructureDocument(
    documentText: string,
    targetSlides: number = 10,
  ): Promise<GeneratedPresentation> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a document-to-presentation expert. Extract key information and structure it into a presentation.
Create ${targetSlides} slides that capture the essence of the document.
Use the advanced presentation JSON format with layouts and image suggestions.`,
          },
          {
            role: 'user',
            content: `Convert this document into a presentation:\n\n${documentText.substring(0, 10000)}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 6000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new InternalServerErrorException(
          'Failed to extract document content',
        );
      }

      return this.parseAdvancedResponse(content);
    } catch (error) {
      this.logger.error('Document extraction failed', error);
      throw new InternalServerErrorException('Failed to process document');
    }
  }
}
