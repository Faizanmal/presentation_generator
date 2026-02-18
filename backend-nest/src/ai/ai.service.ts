import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { RealTimeDataService } from './realtime-data.service';
import { HfInference } from '@huggingface/inference';
import Replicate from 'replicate';

import axios from 'axios';

// Types for AI generation
export interface GenerationParams {
  topic: string;
  tone?: string;
  audience?: string;
  length?: number;
  type?: string;
  generateImages?: boolean;
  imageSource?: 'ai' | 'stock';
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
  options?: Record<string, unknown>;
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

export type ImageProvider =
  | 'pollinations'
  | 'huggingface'
  | 'replicate'
  | 'dall-e-3';

export interface ImageGenerationResult {
  imageUrl: string;
  revisedPrompt: string;
  provider?: ImageProvider;
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
  private groq: OpenAI | null = null;
  private google: GoogleGenerativeAI | null = null;
  private readonly db: PrismaClient;
  private hf: HfInference;
  private replicate: Replicate;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly realTimeDataService: RealTimeDataService,
  ) {
    this.db = this.prisma as unknown as PrismaClient;
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });

    const groqApiKey = this.configService.get<string>('GROQ_API_KEY');
    if (groqApiKey) {
      this.groq = new OpenAI({
        apiKey: groqApiKey,
        baseURL: 'https://api.groq.com/openai/v1',
      });
    }

    const googleApiKey = this.configService.get<string>(
      'GOOGLE_GENERATIVE_AI_API_KEY',
    );
    if (googleApiKey) {
      this.google = new GoogleGenerativeAI(googleApiKey);
    }

    this.hf = new HfInference(
      this.configService.get<string>('HUGGINGFACE_API_KEY'),
    );
    this.replicate = new Replicate({
      auth: this.configService.get<string>('REPLICATE_API_TOKEN'),
    });
  }

  /**
   * Helper to execute an operation with retry logic for 429/5xx errors
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    providerName: string,
    maxRetries = 3,
    initialDelay = 1000,
  ): Promise<T> {
    let lastError: unknown;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error: unknown) {
        lastError = error;
        const status =
          (error as { status?: number; statusCode?: number })?.status ||
          (error as { status?: number; statusCode?: number })?.statusCode;

        // Check for rate limit (429) or server error (5xx)
        if (status && (status === 429 || (status >= 500 && status < 600))) {
          const delay = initialDelay * Math.pow(2, i);
          this.logger.warn(
            `${providerName} API issue (Status: ${status}). Attempt ${i + 1}/${maxRetries}. Retrying in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // If it's not a retryable error, throw immediately
        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Generate text using AI with fallback and retry logic
   */
  public async generateText(
    prompt: string,
    options: { maxTokens?: number; temperature?: number; model?: string } = {},
  ): Promise<string> {
    const completion = await this.chatCompletion({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.maxTokens || 1000,
      temperature: options.temperature || 0.7,
      model: options.model || 'gpt-4o-mini',
    });

    return completion.choices[0]?.message?.content || '';
  }

  /**
   * Public method to call AI with fallback (Groq -> OpenAI) and retry logic
   * Can be used by other services (AIChatService, etc.) to benefit from optimizations
   */
  public async chatCompletion(
    options: Record<string, unknown>,
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const chatParams =
      options as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

    // 1. Try Groq first (if available) - Faster and cheaper
    if (this.groq) {
      try {
        // Use a high-performance model on Groq
        const groqOptions = {
          ...chatParams,
          model: 'llama-3.3-70b-versatile',
        } satisfies OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

        return (await this.retryOperation(
          () => this.groq!.chat.completions.create(groqOptions),
          'Groq',
          2, // Try twice then failover
          1000,
        )) as OpenAI.Chat.Completions.ChatCompletion;
      } catch (error) {
        this.logger.warn(
          `Groq AI failed after retries: ${(error as Error).message}. Falling back to OpenAI.`,
        );
      }
    }

    // 2. Try Google next (if available) - Good balance of speed/quality
    if (this.google) {
      try {
        return await this.retryOperation(
          () => this.callGoogleAI(options),
          'Google AI',
          2,
          1000,
        );
      } catch (error) {
        this.logger.warn(
          `Google AI failed after retries: ${(error as Error).message}. Falling back to OpenAI.`,
        );
      }
    }

    // 3. Fallback to OpenAI - More reliable but slower/expensive
    return (await this.retryOperation(
      () => this.openai.chat.completions.create(chatParams),
      'OpenAI',
      3, // Retry up to 3 times
      1000, // Start with 1s delay
    )) as OpenAI.Chat.Completions.ChatCompletion;
  }

  /**
   * Generate speech using OpenAI's TTS API
   */
  public async generateSpeech(
    input: string,
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
    speed: number = 1.0,
  ): Promise<Buffer> {
    return this.retryOperation(
      async () => {
        const mp3 = await this.openai.audio.speech.create({
          model: 'tts-1-hd',
          voice,
          input,
          speed,
          response_format: 'mp3',
        });
        return Buffer.from(await mp3.arrayBuffer());
      },
      'OpenAI Audio',
      3,
      1000,
    );
  }

  /**
   * Transcribe audio using OpenAI Whisper
   */
  public async transcribeAudio(
    file: fs.ReadStream,
    language?: string,
  ): Promise<unknown> {
    return this.retryOperation(
      () =>
        this.openai.audio.transcriptions.create({
          file,
          model: 'whisper-1',
          response_format: 'verbose_json',
          language,
        }),
      'OpenAI Whisper',
      3,
      1000,
    );
  }

  /**
   * Generate embeddings using OpenAI
   */
  public async generateEmbedding(input: string): Promise<number[]> {
    return this.retryOperation(
      async () => {
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input,
        });
        return response.data[0].embedding;
      },
      'OpenAI Embedding',
      3,
      1000,
    );
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
      const response = await this.chatCompletion({
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
      // Sanitized log - do not store full prompt or response PII
      const sanitizedPrompt = {
        topic: params.topic, // Topic might still be sensitive, but less than full context
        type: params.type,
        tokens,
      };

      await this.db.aIGeneration.create({
        data: {
          userId: 'system', // Will be updated when called from service
          prompt: JSON.stringify(sanitizedPrompt),
          // Store minimal metadata or success indicator instead of full response
          response: {
            status: 'success',
            sectionCount: result.sections.length,
            title: result.title,
          } as unknown as Prisma.InputJsonValue,
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
      const response = await this.chatCompletion({
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
      const response = await this.chatCompletion({
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

  private async callGoogleAI(
    options: Record<string, unknown>,
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const generationConfig: Record<string, unknown> = {};
    const responseFormat = options.response_format as
      | { type?: string }
      | undefined;
    if (responseFormat?.type === 'json_object') {
      generationConfig.responseMimeType = 'application/json';
    }

    // Use Gemini 1.5 Flash for speed/cost (comparable to Groq fallback)
    const model = this.google!.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig,
    });

    const messages =
      options.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    const systemMessage = messages.find((m) => m.role === 'system');
    const systemInstructionText =
      typeof systemMessage?.content === 'string'
        ? systemMessage.content
        : Array.isArray(systemMessage?.content)
          ? systemMessage.content
              .filter(
                (
                  part,
                ): part is OpenAI.Chat.Completions.ChatCompletionContentPartText =>
                  part.type === 'text',
              )
              .map((part) => part.text)
              .join('\n')
          : undefined;

    // Convert messages to Gemini history format
    // Filter out system message as it's handled separately
    const history = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [
          {
            text: (m as OpenAI.Chat.Completions.ChatCompletionMessage)
              .content as string,
          },
        ],
      }));

    if (history.length === 0) {
      throw new Error('No messages provided for Google AI');
    }

    const lastMessage = history[history.length - 1];
    const previousHistory = history.slice(0, -1);

    const chat = model.startChat({
      history: previousHistory,
      systemInstruction: systemInstructionText,
    });

    const result = await chat.sendMessage(lastMessage.parts[0].text);
    const responseText = result.response.text();

    // Map Gemini response to OpenAI ChatCompletion format
    return {
      id: `google-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gemini-1.5-flash',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: responseText,
            refusal: null,
          },
          finish_reason: 'stop',
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: 0, // Not easily available without tokenizer
        completion_tokens: 0,
        total_tokens: 0,
      },
    } as OpenAI.Chat.Completions.ChatCompletion;
  }

  // ============================================
  // ADVANCED AI FEATURES - GAMMA LEVEL
  // ============================================

  /**
   * Generate an image using DALL-E 3 with fallback to Pollinations (Free)
   */
  /**
   * Generate an image with priority-based fallback mechanism
   * Priority: Pollinations -> Hugging Face -> Replicate -> DALL-E
   */
  async generateImage(
    prompt: string,
    style: 'vivid' | 'natural' = 'vivid',
    size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024',
    // Optional: force a specific provider, otherwise follows strict priority
    preferredProvider?: ImageProvider,
  ): Promise<ImageGenerationResult> {
    const providers: ImageProvider[] = [
      'pollinations',
      'huggingface',
      'replicate',
      'dall-e-3',
    ];

    // If a specific provider is requested, try that first, then fall back to others in order
    const orderedProviders = preferredProvider
      ? [preferredProvider, ...providers.filter((p) => p !== preferredProvider)]
      : providers;

    let lastError: unknown;

    for (const provider of orderedProviders) {
      try {
        switch (provider) {
          case 'pollinations':
            return await this.generateImagePollinations(prompt);
          case 'huggingface':
            if (!this.configService.get('HUGGINGFACE_API_KEY')) continue;
            return await this.generateImageHuggingFace(prompt);
          case 'replicate':
            if (!this.configService.get('REPLICATE_API_TOKEN')) continue;
            return await this.generateImageReplicate(prompt);
          case 'dall-e-3':
            if (!this.configService.get('OPENAI_API_KEY')) continue;
            return await this.generateImageDallE(
              prompt,
              style,
              size as OpenAI.ImageGenerateParams['size'],
            );
        }
      } catch (error) {
        this.logger.warn(
          `Image generation failed with ${provider}: ${
            (error as Error).message
          }`,
        );
        lastError = error;
        // Continue to next provider
      }
    }

    throw new InternalServerErrorException(
      `Failed to generate image with all providers. Last error: ${
        (lastError as Error)?.message
      }`,
    );
  }

  /**
   * Generate image using Pollinations.ai (Free, Fast, Flux Model)
   */
  /**
   * 1. Pollinations.ai (Free, Fast, Flux Model)
   */
  async generateImagePollinations(
    prompt: string,
  ): Promise<ImageGenerationResult> {
    try {
      // Enhance prompt for better results with Flux
      const enhancedPrompt = encodeURIComponent(
        `${prompt}, professional presentation 4k, atomic visual, minimalist, high quality`,
      );

      // Pollinations API URL (Flux model is significantly better for this use case)
      const seed = Math.floor(Math.random() * 1000000);
      const imageUrl = `https://image.pollinations.ai/prompt/${enhancedPrompt}?model=flux&width=1024&height=1024&nologo=true&seed=${seed}`;

      // Verify the URL works (head request)
      await axios.head(imageUrl);

      this.logger.log(
        `Generated image (Pollinations) for: ${prompt.substring(0, 30)}...`,
      );

      return {
        imageUrl,
        revisedPrompt: prompt,
        provider: 'pollinations',
      };
    } catch (error) {
      this.logger.error('Pollinations image generation failed', error);
      throw error;
    }
  }

  /**
   * 2. Hugging Face (Stable Diffusion XL)
   */
  async generateImageHuggingFace(
    prompt: string,
  ): Promise<ImageGenerationResult> {
    const response = await this.hf.textToImage({
      model: 'stabilityai/stable-diffusion-xl-base-1.0',
      inputs: `professional presentation visual, ${prompt}, 4k, high quality`,
      parameters: { negative_prompt: 'text, watermark, blurry, low quality' },
    });

    const buffer = await (response as unknown as Blob).arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64}`;

    this.logger.log(
      `Generated image (Hugging Face) for: ${prompt.substring(0, 30)}...`,
    );

    return {
      imageUrl,
      revisedPrompt: prompt,
      provider: 'huggingface',
    };
  }

  /**
   * 3. Replicate (Flux Pro or SDXL)
   */
  async generateImageReplicate(prompt: string): Promise<ImageGenerationResult> {
    const output = await this.replicate.run('black-forest-labs/flux-schnell', {
      input: {
        prompt: `professional presentation visual, ${prompt}, 4k, minimalist`,
        disable_safety_checker: true,
        aspect_ratio: '16:9',
      },
    });

    const imageUrl = Array.isArray(output)
      ? output[0]
      : (output as unknown as string);

    this.logger.log(
      `Generated image (Replicate) for: ${prompt.substring(0, 30)}...`,
    );

    return {
      imageUrl,
      revisedPrompt: prompt,
      provider: 'replicate',
    };
  }

  /**
   * 4. DALL-E 3 (OpenAI)
   */
  async generateImageDallE(
    prompt: string,
    style: 'vivid' | 'natural',
    size: OpenAI.ImageGenerateParams['size'],
  ): Promise<ImageGenerationResult> {
    const response = await this.openai.images.generate({
      model: 'dall-e-3',
      prompt: `Create a professional, clean presentation visual for: ${prompt}`,
      n: 1,
      size,
      style,
      quality: 'hd',
    });

    const imageData = response.data?.[0];
    if (!imageData?.url) throw new Error('No image URL returned from DALL-E');

    return {
      imageUrl: imageData.url,
      revisedPrompt: imageData.revised_prompt || prompt,
      provider: 'dall-e-3',
    };
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
      const response = await this.chatCompletion({
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
  recommendLayout(content: GeneratedBlock[], heading: string): LayoutType {
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
      const response = await this.chatCompletion({
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
      const response = await this.chatCompletion({
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
            section.layout = this.recommendLayout(
              section.blocks,
              section.heading,
            );
          }
        }
      }

      // Generate images if enabled
      if (generateImages || params.imageSource) {
        let imageMap: Map<number, ImageGenerationResult> = new Map();

        const source =
          params.imageSource || (generateImages ? 'ai' : undefined);

        if (source === 'ai') {
          imageMap = await this.generatePresentationImages(parsed.sections);
        } else if (source === 'stock') {
          imageMap = await this.generateStockImages(parsed.sections);
        }

        imageMap.forEach((image, index) => {
          if (parsed.sections[index]) {
            parsed.sections[index].blocks.unshift({
              type: 'image',
              content: image.imageUrl,
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
    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch {
      this.logger.error('Failed to parse advanced AI response', content);
      throw new BadRequestException(
        'AI generated invalid content. Please try again.',
      );
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('title' in parsed) ||
      !('sections' in parsed) ||
      !Array.isArray((parsed as Record<string, unknown>).sections)
    ) {
      throw new BadRequestException('Invalid presentation structure');
    }

    const typedParsed = parsed as {
      title: string;
      sections: unknown[];
      metadata?: unknown;
    };

    const sections: GeneratedSection[] = typedParsed.sections.map(
      (section: unknown) => {
        const s = section as Record<string, unknown>;
        return {
          heading: typeof s.heading === 'string' ? s.heading : 'Untitled',
          layout: (typeof s.layout === 'string'
            ? s.layout
            : 'title-content') as LayoutType,
          suggestedImage:
            typeof s.suggestedImage === 'string' ? s.suggestedImage : undefined,
          speakerNotes:
            typeof s.speakerNotes === 'string' ? s.speakerNotes : undefined,
          blocks: Array.isArray(s.blocks)
            ? s.blocks.map((block: unknown) => {
                const b = block as Record<string, unknown>;
                return {
                  type: typeof b.type === 'string' ? b.type : 'paragraph',
                  content: typeof b.content === 'string' ? b.content : '',
                  chartData: b.chartData as ChartData | undefined,
                  embedUrl:
                    typeof b.embedUrl === 'string' ? b.embedUrl : undefined,
                  embedType:
                    typeof b.embedType === 'string'
                      ? (b.embedType as GeneratedBlock['embedType'])
                      : undefined,
                };
              })
            : [],
        };
      },
    );

    const metadata = typedParsed.metadata as
      | Record<string, unknown>
      | undefined;

    return {
      title: typedParsed.title,
      sections,
      metadata: metadata
        ? {
            estimatedDuration:
              typeof metadata.estimatedDuration === 'number'
                ? metadata.estimatedDuration
                : sections.length * 2,
            keywords: Array.isArray(metadata.keywords)
              ? (metadata.keywords as string[])
              : [],
            summary:
              typeof metadata.summary === 'string' ? metadata.summary : '',
          }
        : {
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
  /**
   * Generate stock images (using LoremFlickr as placeholder service for now)
   */
  async generateStockImages(
    sections: GeneratedSection[],
  ): Promise<Map<number, ImageGenerationResult>> {
    const imageMap = new Map<number, ImageGenerationResult>();

    // Generate images for sections that have suggestedImage
    const imagePromises = sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.suggestedImage)
      .map(async ({ section, index }) => {
        try {
          // Extract keywords from the description to use for search
          const keywords = await this.extractKeywords(section.suggestedImage!);
          // Using LoremFlickr which supports keywords
          const imageUrl = `https://loremflickr.com/1024/768/${encodeURIComponent(keywords.replace(/[^a-zA-Z0-9]/g, ','))}`;

          imageMap.set(index, {
            imageUrl,
            revisedPrompt: section.suggestedImage!,
          });
        } catch (error) {
          this.logger.warn(
            `Failed to get stock image for section ${index}`,
            error,
          );
        }
      });

    await Promise.allSettled(imagePromises);
    return imageMap;
  }

  /**
   * Extract keywords from image description for stock search
   */
  async extractKeywords(description: string): Promise<string> {
    try {
      const response = await this.chatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'Extract 1-2 main visual keywords from the image description. Return only keywords separated by comma, no extra text.',
          },
          {
            role: 'user',
            content: description,
          },
        ],
        temperature: 0.3,
        max_tokens: 20,
      });

      return response.choices[0]?.message?.content || 'business,technology';
    } catch {
      return 'business,technology';
    }
  }

  // ============================================
  // ENHANCED FEATURES: CHARTS, EMOJIS, REAL-TIME DATA
  // ============================================

  /**
   * Generate chart data with real-time information
   */
  async generateChartWithRealData(
    chartTitle: string,
    topic: string,
    chartType: 'bar' | 'line' | 'pie' | 'doughnut' = 'bar',
  ): Promise<ChartData> {
    try {
      // First, get context for what data to search for
      const searchQuery = await this.getChartDataSearchQuery(chartTitle, topic);

      // Fetch real-time data
      const chartDataPoints = await this.realTimeDataService.extractChartData(
        searchQuery,
        5,
      );

      if (chartDataPoints.length < 3) {
        // Use fallback data if we couldn't extract enough
        return this.generateFallbackChartData(chartTitle, chartType);
      }

      // Format data for Chart.js
      const chartData: ChartData = {
        type: chartType,
        labels: chartDataPoints.map((d) => d.label),
        datasets: [
          {
            label: chartTitle,
            data: chartDataPoints.map((d) => d.value),
            backgroundColor: this.getChartColors(chartDataPoints.length),
            borderColor: '#1a73e8',
          },
        ],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top',
            },
            title: {
              display: true,
              text: chartTitle,
              font: {
                size: 16,
                weight: 'bold',
              },
            },
          },
        },
      };

      this.logger.log(`Generated chart with real-time data: ${chartTitle}`);
      return chartData;
    } catch (error) {
      this.logger.error(`Chart generation failed: ${(error as Error).message}`);
      return this.generateFallbackChartData(chartTitle, chartType);
    }
  }

  /**
   * Get search query for chart data
   */
  private async getChartDataSearchQuery(
    chartTitle: string,
    topic: string,
  ): Promise<string> {
    try {
      const response = await this.chatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Generate a search query to find numerical data and statistics. 
Return ONLY the search query text, nothing else.`,
          },
          {
            role: 'user',
            content: `Chart title: "${chartTitle}"\nTopic: "${topic}"\n\nGenerate a search query to find relevant numerical data.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 50,
      });

      const query = response.choices[0]?.message?.content?.trim();
      return query || `${topic} statistics data`;
    } catch {
      return `${topic} statistics data`;
    }
  }

  /**
   * Generate fallback chart data when real data isn't available
   */
  private generateFallbackChartData(
    title: string,
    chartType: 'bar' | 'line' | 'pie' | 'doughnut',
  ): ChartData {
    const labels = ['Q1', 'Q2', 'Q3', 'Q4'];
    const data = [65, 78, 82, 91];

    return {
      type: chartType,
      labels,
      datasets: [
        {
          label: title,
          data,
          backgroundColor: this.getChartColors(labels.length),
          borderColor: '#1a73e8',
        },
      ],
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    };
  }

  /**
   * Get color palette for charts
   */
  private getChartColors(count: number): string[] {
    const colors = [
      '#1a73e8', // Blue
      '#34a853', // Green
      '#fbbc04', // Yellow
      '#ea4335', // Red
      '#9334e6', // Purple
      '#00acc1', // Cyan
      '#ff6f00', // Orange
      '#7cb342', // Light Green
    ];

    return colors.slice(0, count);
  }

  /**
   * Generate enhanced presentation with charts, emojis, and rich content
   */
  async generateEnhancedPresentation(
    params: GenerationParams & {
      includeCharts?: boolean;
      includeRealTimeData?: boolean;
      includeEmojis?: boolean;
    },
  ): Promise<GeneratedPresentation> {
    const {
      topic,
      tone = 'professional',
      audience = 'general',
      length = 5,
      includeCharts = true,
      includeRealTimeData = true,
      includeEmojis = true,
    } = params;

    try {
      const systemPrompt = `You are an expert presentation designer. Create presentations with:
- Rich, detailed content (6-10 blocks per slide)
- Emojis for visual appeal ${includeEmojis ? '✓' : ''}
- Charts and data visualizations ${includeCharts ? '📊' : ''}
- Varied text styles with different colors
- Card-style blocks for key information
- Professional, engaging design

CRITICAL: Return ONLY valid JSON, no markdown formatting.`;

      const userPrompt = `Create a comprehensive presentation about: "${topic}"

Specifications:
- Audience: ${audience}
- Tone: ${tone}
- Slides: ${length}
- Include charts: ${includeCharts}
- Real-time data: ${includeRealTimeData}
- Emojis: ${includeEmojis}

For each slide, include:
1. Heading with emoji
2. Multiple detailed paragraphs
3. Bullet or numbered lists with emojis
4. Card-style callouts for key points
5. Charts where data would be valuable
6. Suggested logos/icons

Use varied text colors:
- Headings: #1a73e8
- Paragraphs: #5f6368
- Lists: #202124
- Highlights: #ea4335
- Callouts: #34a853

Return JSON structure:
{
  "title": "Title with emoji 📊",
  "sections": [
    {
      "heading": "Slide heading 🎯",
      "layout": "rich-content",
      "blocks": [
        {"type": "heading", "content": "...", "style": {"color": "#1a73e8", "fontSize": "32px"}},
        {"type": "paragraph", "content": "...", "style": {"color": "#5f6368", "cardStyle": true}},
        {"type": "bullet-list", "items": ["Point 1 ✓", "Point 2 ⚡"], "style": {"color": "#202124"}},
        {"type": "chart", "chartType": "bar", "title": "Chart Title", "dataQuery": "search query", "useRealTimeData": ${includeRealTimeData}}
      ],
      "speakerNotes": "Speaker notes..."
    }
  ]
}`;

      const response = await this.chatCompletion({
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
        throw new InternalServerErrorException('No content generated');
      }

      const parsed = JSON.parse(content);

      // Process charts if included
      if (includeCharts && includeRealTimeData) {
        await this.enrichPresentationWithCharts(parsed, topic);
      }

      return this.parseAndValidateResponse(JSON.stringify(parsed));
    } catch (error) {
      this.logger.error('Enhanced presentation generation failed', error);
      throw new InternalServerErrorException('Failed to generate presentation');
    }
  }

  /**
   * Enrich presentation with real-time chart data
   */
  private async enrichPresentationWithCharts(
    presentation: Record<string, unknown>,
    topic: string,
  ): Promise<void> {
    if (!presentation.sections || !Array.isArray(presentation.sections)) {
      return;
    }

    for (const section of presentation.sections) {
      if (!section.blocks || !Array.isArray(section.blocks)) {
        continue;
      }

      for (const block of section.blocks) {
        if (
          block.type === 'chart' &&
          block.useRealTimeData &&
          block.dataQuery
        ) {
          try {
            const chartData = await this.generateChartWithRealData(
              block.title || 'Data Chart',
              block.dataQuery || topic,
              block.chartType || 'bar',
            );
            block.chartData = chartData;
          } catch (error) {
            this.logger.warn(
              `Failed to enrich chart: ${(error as Error).message}`,
            );
          }
        }
      }
    }
  }

  /**
   * Add emojis to text content
   */
  async addEmojisToContent(
    text: string,
    context: string = '',
  ): Promise<string> {
    try {
      const response = await this.chatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'Add relevant emojis to the text to make it more engaging. Keep the same meaning, just add emojis. Return only the enhanced text.',
          },
          {
            role: 'user',
            content: `Text: ${text}\nContext: ${context}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      });

      return response.choices[0]?.message?.content?.trim() || text;
    } catch {
      return text;
    }
  }
}
