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
}

export interface GeneratedBlock {
  type: string;
  content: string;
}

export interface GeneratedSection {
  heading: string;
  blocks: GeneratedBlock[];
}

export interface GeneratedPresentation {
  title: string;
  sections: GeneratedSection[];
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

${isPresentation
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
}
