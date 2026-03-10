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
import { HfInference, InferenceClient } from '@huggingface/inference';
import Replicate from 'replicate';
import { Ollama } from 'ollama';
import axios from 'axios';
import { ImageSuggestion } from './thinking-agent/thinking-agent.types';
import { AICostOptimizerService } from './ai-cost-optimizer.service';

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
  templateType?:
    | 'pitch-deck'
    | 'training'
    | 'report'
    | 'sales'
    | 'product-launch'
    | 'case-study'
    | 'keynote';
  templateStructure?: string[];
  contextData?: string;
}

export interface GeneratedBlock {
  type: string;
  content: string;
  chartData?: ChartData;
  embedUrl?: string;
  embedType?: 'youtube' | 'vimeo' | 'figma' | 'miro' | 'custom';
}

export interface ChartData {
  // allow the same chart types as the thinking-agent typings (including
  // `area`) so that generated sections can be passed through without
  // requiring an explicit conversion.
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'scatter' | 'area';
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
  | 'title-subtitle'
  | 'title-content'
  | 'two-column'
  | 'three-column'
  | 'image-left'
  | 'image-right'
  | 'image-full'
  | 'comparison'
  | 'timeline'
  | 'quote-highlight'
  | 'stats-grid'
  | 'chart-focus'
  | 'gallery'
  | 'agenda';

export interface GeneratedSection {
  heading: string;
  blocks: GeneratedBlock[];
  layout: LayoutType;
  // The AI endpoints historically returned a simple string prompt, but the
  // thinking-agent subsystem works with a richer `ImageSuggestion` type that
  // includes style/placement info.  The methods below just care about the
  // prompt, so we accept either form (and also keep the loose object type used
  // elsewhere for backward compatibility).
  suggestedImage?:
    | string
    | ImageSuggestion
    | {
        prompt: string;
        [key: string]: unknown;
      };
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
  // Ollama client instance, used for local model testing
  private ollama: Ollama | null = null;

  /** In-memory cache for generated presentations (TTL: 1h, max 100 entries) */
  private readonly generationCache = new Map<
    string,
    { result: GeneratedPresentation; timestamp: number; hits: number }
  >();
  private static readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  private static readonly CACHE_MAX_SIZE = 100;
  private cacheCleanupTimer: ReturnType<typeof setInterval> | null = null;

  /** Semantic cache for similar queries (using embeddings) */
  private readonly semanticCache = new Map<
    string,
    { embedding: number[]; result: GeneratedPresentation; timestamp: number }
  >();
  private static readonly SEMANTIC_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours
  private static readonly SEMANTIC_SIMILARITY_THRESHOLD = 0.92; // High similarity required

  /** Rate limiting and circuit breaker */
  private readonly apiCallTimes = new Map<string, number[]>();
  private readonly circuitBreakers = new Map<
    string,
    { failures: number; openUntil: number }
  >();
  private static readonly MAX_CALLS_PER_MINUTE = 60;
  private static readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private static readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly realTimeDataService: RealTimeDataService,
    private readonly costOptimizer: AICostOptimizerService,
  ) {
    this.db = this.prisma as unknown as PrismaClient;
    const features = this.configService.get<{ openAI?: boolean }>('features');
    if (features?.openAI === false) {
      this.logger.log(
        'OpenAI support disabled via feature flag; AIService will not initialize client',
      );
      // leave this.openai uninitialized (undefined) – calls should check
    } else {
      this.openai = new OpenAI({
        apiKey: this.configService.get<string>('OPENAI_API_KEY'),
      });
    }

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

    this.hf = new InferenceClient(
      this.configService.get<string>('HUGGINGFACE_API_KEY'),
    );
    this.replicate = new Replicate({
      auth: this.configService.get<string>('REPLICATE_API_TOKEN'),
    });

    // Initialize Ollama for local testing
    const ollamaBaseUrl = this.configService.get<string>('OLLAMA_BASE_URL');
    if (ollamaBaseUrl) {
      // Ollama default export is just an instance, so we need the named class
      // in order to construct a client with a custom host/url.
      this.ollama = new Ollama({ host: ollamaBaseUrl });
    }

    // Periodic cache cleanup every 10 minutes
    this.cacheCleanupTimer = setInterval(
      () => this.evictStaleCache(),
      10 * 60 * 1000,
    );
  }

  /**
   * Clean up module resources
   */
  onModuleDestroy() {
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
      this.cacheCleanupTimer = null;
    }
  }

  /**
   * Ensure that the OpenAI client is available. Throws a BadRequestException if
   * the feature flag has disabled OpenAI or if the service wasn't initialized
   * due to a missing API key.
   */
  private ensureOpenAI(): OpenAI {
    if (!this.openai) {
      throw new BadRequestException('OpenAI support is disabled');
    }
    return this.openai;
  }

  /**
   * Evict stale and excess entries from the generation cache.
   * - Removes entries older than CACHE_TTL_MS
   * - If still over CACHE_MAX_SIZE, removes least-recently-hit entries
   */
  private evictStaleCache(): void {
    const now = Date.now();

    // Remove expired entries
    for (const [key, entry] of this.generationCache) {
      if (now - entry.timestamp > AIService.CACHE_TTL_MS) {
        this.generationCache.delete(key);
      }
    }

    // If still over max size, evict lowest-hit entries
    if (this.generationCache.size > AIService.CACHE_MAX_SIZE) {
      const entries = [...this.generationCache.entries()].sort(
        (a, b) => a[1].hits - b[1].hits,
      );
      const toRemove = entries.slice(
        0,
        this.generationCache.size - AIService.CACHE_MAX_SIZE,
      );
      for (const [key] of toRemove) {
        this.generationCache.delete(key);
      }
    }
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

  /**
   * Call Ollama API and map response to OpenAI format
   */
  private async callOllama(
    options: Record<string, unknown>,
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    if (!this.ollama) {
      throw new Error('Ollama not initialized');
    }

    const messages =
      options.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    const model =
      (options.model as string) ||
      this.configService.get<string>('OLLAMA_MODEL') ||
      'llama2';

    // Convert messages to Ollama format
    const prompt = messages
      .map((m) => {
        let contentStr = '';
        if (typeof m.content === 'string') {
          contentStr = m.content;
        } else if (Array.isArray(m.content)) {
          contentStr = m.content
            .filter((c) => c.type === 'text')
            .map((c) => String((c as { text?: string }).text || ''))
            .join(' ');
        }

        if (m.role === 'system') return `System: ${contentStr}`;
        if (m.role === 'user') return `User: ${contentStr}`;
        if (m.role === 'assistant') return `Assistant: ${contentStr}`;
        return contentStr;
      })
      .join('\n\n');

    // If response_format is json_object, add instruction
    const responseFormat = options.response_format as
      | { type: string }
      | undefined;
    const finalPrompt =
      responseFormat?.type === 'json_object'
        ? `${prompt}\n\nRespond with valid JSON only.`
        : prompt;

    const response = await this.ollama.generate({
      model,
      prompt: finalPrompt,
      stream: false,
    });

    // Map to OpenAI format
    const result: OpenAI.Chat.Completions.ChatCompletion = {
      id: `ollama-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: response.response,
            refusal: null, // required by newer OpenAI types
          },
          finish_reason: 'stop',
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: prompt.length / 4, // rough estimate
        completion_tokens: response.response.length / 4,
        total_tokens: (prompt.length + response.response.length) / 4,
      },
    };
    return result;
  }

  public async chatCompletion(
    options: Record<string, unknown>,
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const chatParams =
      options as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

    // 0. Try Ollama first for testing/cost optimization (if available)
    if (this.ollama) {
      try {
        return await this.retryOperation(
          () => this.callOllama(options),
          'Ollama',
          1, // Try once
          1000,
        );
      } catch (error) {
        this.logger.warn(
          `Ollama failed: ${(error as Error).message}. Falling back to cloud providers.`,
        );
      }
    }

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
    if (!this.openai) {
      throw new BadRequestException('OpenAI support is disabled');
    }
    return (await this.retryOperation(
      () => this.openai.chat.completions.create(chatParams),
      'OpenAI',
      3, // Retry up to 3 times
      1000, // Start with 1s delay
    )) as OpenAI.Chat.Completions.ChatCompletion;
  }

  /**
   * Cost-optimized chat completion with deduplication and tracking
   */
  public async costOptimizedChatCompletion(params: {
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    temperature?: number;
    max_tokens?: number;
    userTier?: 'free' | 'pro' | 'enterprise';
    userId?: string;
    operation?: 'generation' | 'enhancement' | 'analysis' | 'chat';
  }): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const {
      messages,
      temperature = 0.7,
      max_tokens = 2000,
      userTier = 'free',
      userId,
      operation = 'generation',
    } = params;

    // Generate deduplication key
    const dedupKey = JSON.stringify({ messages, temperature, max_tokens });

    // Use request deduplication to prevent duplicate requests
    return this.costOptimizer.dedupedRequest(dedupKey, async () => {
      // Select cost-optimized model based on user tier
      const modelConfig = this.costOptimizer.selectModelByCost(
        userTier,
        operation,
      );

      this.logger.log(
        `Using ${modelConfig.provider}/${modelConfig.model} for ${userTier} tier ${operation}`,
      );

      // Estimate tokens (rough estimate: ~4 chars per token)
      const estimatedTokens = Math.ceil(
        (JSON.stringify(messages).length + max_tokens) / 4,
      );

      // Check if user can afford this operation
      if (
        userId &&
        !this.costOptimizer.canAffordOperation(
          userId,
          estimatedTokens,
          modelConfig.provider,
          modelConfig.model,
        )
      ) {
        throw new BadRequestException(
          'Daily or monthly cost limit exceeded. Please upgrade your plan or wait until the next period.',
        );
      }

      // Make the API call using the selected provider/model
      let response: OpenAI.Chat.Completions.ChatCompletion;
      const startTime = Date.now();

      try {
        response = await this.chatCompletion({
          model: modelConfig.model,
          messages,
          temperature,
          max_tokens,
        });
      } catch (error) {
        this.logger.error(`Cost-optimized completion failed: ${error.message}`);
        throw error;
      }

      const duration = Date.now() - startTime;

      // Track actual cost
      const actualTokens = response.usage?.total_tokens || estimatedTokens;
      const actualCost = this.costOptimizer.calculateCost(
        modelConfig.provider,
        modelConfig.model,
        actualTokens,
      );

      this.costOptimizer.trackCost({
        provider: modelConfig.provider,
        model: modelConfig.model,
        tokens: actualTokens,
        estimatedCost: actualCost,
        timestamp: new Date(),
        userId,
        operation,
      });

      this.logger.log(
        `Completed ${operation} in ${duration}ms - ${actualTokens} tokens - $${actualCost.toFixed(4)}`,
      );

      return response;
    });
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
        const mp3 = await this.ensureOpenAI().audio.speech.create({
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
        this.ensureOpenAI().audio.transcriptions.create({
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
        const response = await this.ensureOpenAI().embeddings.create({
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
   * Check circuit breaker status
   */
  private isCircuitOpen(provider: string): boolean {
    const breaker = this.circuitBreakers.get(provider);
    if (!breaker) return false;

    if (Date.now() < breaker.openUntil) {
      return true;
    }

    // Reset circuit breaker after timeout
    this.circuitBreakers.delete(provider);
    return false;
  }

  /**
   * Record API failure for circuit breaker
   */
  private recordFailure(provider: string): void {
    const breaker = this.circuitBreakers.get(provider) || {
      failures: 0,
      openUntil: 0,
    };
    breaker.failures++;

    if (breaker.failures >= AIService.CIRCUIT_BREAKER_THRESHOLD) {
      breaker.openUntil = Date.now() + AIService.CIRCUIT_BREAKER_TIMEOUT;
      this.logger.warn(
        `Circuit breaker opened for ${provider} until ${new Date(breaker.openUntil).toISOString()}`,
      );
    }

    this.circuitBreakers.set(provider, breaker);
  }

  /**
   * Reset circuit breaker on success
   */
  private recordSuccess(provider: string): void {
    this.circuitBreakers.delete(provider);
  }

  /**
   * Check if we can make an API call (rate limiting)
   */
  private canMakeApiCall(provider: string): boolean {
    const now = Date.now();
    const calls = this.apiCallTimes.get(provider) || [];

    // Remove calls older than 1 minute
    const recentCalls = calls.filter((time) => now - time < 60000);
    this.apiCallTimes.set(provider, recentCalls);

    return recentCalls.length < AIService.MAX_CALLS_PER_MINUTE;
  }

  /**
   * Record an API call for rate limiting
   */
  private recordApiCall(provider: string): void {
    const calls = this.apiCallTimes.get(provider) || [];
    calls.push(Date.now());
    this.apiCallTimes.set(provider, calls);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Check semantic cache for similar queries
   */
  private async checkSemanticCache(
    queryEmbedding: number[],
  ): Promise<GeneratedPresentation | null> {
    // method currently synchronous; keep async signature for future use
    await Promise.resolve();
    const now = Date.now();
    let bestMatch: {
      result: GeneratedPresentation;
      similarity: number;
    } | null = null;

    for (const [key, cached] of this.semanticCache.entries()) {
      // Skip expired entries
      if (now - cached.timestamp > AIService.SEMANTIC_CACHE_TTL) {
        this.semanticCache.delete(key);
        continue;
      }

      const similarity = this.cosineSimilarity(
        queryEmbedding,
        cached.embedding,
      );

      if (similarity > AIService.SEMANTIC_SIMILARITY_THRESHOLD) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { result: cached.result, similarity };
        }
      }
    }

    if (bestMatch) {
      this.logger.log(
        `Semantic cache hit with similarity: ${bestMatch.similarity.toFixed(4)}`,
      );
      return bestMatch.result;
    }

    return null;
  }

  /**
   * Generate a full presentation/document structure using AI with semantic caching
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

    // Try semantic cache first
    const queryText = `${topic} ${tone} ${audience} ${length} ${type}`;
    const cacheKey =
      `${topic}-${tone}-${audience}-${length}-${type}`.toLowerCase();

    // Check basic cache
    const cached = this.generationCache.get(cacheKey);
    if (cached) {
      cached.hits++;
      cached.timestamp = Date.now();
      this.logger.log(`Cache hit for: ${cacheKey}`);
      return cached.result;
    }

    // Check semantic cache
    try {
      const queryEmbedding = await this.generateEmbedding(queryText);
      const semanticResult = await this.checkSemanticCache(queryEmbedding);

      if (semanticResult) {
        // Cache in basic cache too
        this.generationCache.set(cacheKey, {
          result: semanticResult,
          timestamp: Date.now(),
          hits: 1,
        });
        return semanticResult;
      }
    } catch (error) {
      this.logger.warn(
        'Semantic cache check failed, proceeding with generation',
        error,
      );
    }

    const systemPrompt = this.buildSystemPrompt(type);

    // Fetch live search data for authentic chart building
    let realtimeContext = '';
    try {
      this.logger.log(
        `Fetching real-time statistical data for topic: ${topic}`,
      );
      const searchResult = await this.realTimeDataService.search(
        `${topic} current statistics percentages numbers data metrics`,
        4,
      );
      if (searchResult && searchResult.results.length > 0) {
        realtimeContext = searchResult.results
          .map((r) => r.snippet)
          .join('\n---\n');
      }
    } catch (err) {
      this.logger.warn(`Failed to fetch real-time data for ${topic}`, err);
    }

    const userPrompt = this.buildUserPrompt(
      topic,
      tone,
      audience,
      length,
      type,
      realtimeContext,
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

      // Post-process: Enhance sections with missing speaker notes or images
      await this.enrichPresentationContent(parsed);

      // Cache the enhanced result
      this.generationCache.set(cacheKey, {
        result: parsed,
        timestamp: Date.now(),
        hits: 1,
      });

      // Also cache in semantic cache
      try {
        const queryEmbedding = await this.generateEmbedding(queryText);
        this.semanticCache.set(cacheKey, {
          embedding: queryEmbedding,
          result: parsed,
          timestamp: Date.now(),
        });
      } catch (error) {
        this.logger.warn('Failed to cache in semantic cache', error);
      }

      // Log the generation for analytics
      await this.logGeneration(
        params,
        parsed,
        response.usage?.total_tokens || 0,
      );

      this.logger.log(
        `Generated ${type} with ${parsed.sections.length} sections, ${parsed.sections.filter((s) => s.suggestedImage).length} images, ${parsed.sections.filter((s) => s.speakerNotes).length} speaker notes`,
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

    return `You are a WORLD-CLASS ${isPresentation ? 'presentation' : 'document'} designer who creates visually stunning, award-winning content.

Your task is to generate a TOP-NOTCH, VISUALLY STUNNING ${isPresentation ? 'presentation' : 'document'} with rich, diverse visual elements. Think of it as designing a premium pitch deck for a Fortune 500 company.

CRITICAL DESIGN RULES:
1. Return ONLY valid JSON - no markdown, no explanations
2. Create content that is VISUALLY DIVERSE - never repeat the same block pattern twice
3. Use emojis strategically to add visual interest (at least 1-2 per section heading) 🎯 🚀 💡 📊 ✨ ⚡
4. Include data-driven elements: charts with REAL, AUTHENTIC statistics, stats grids with fact-checked numbers
5. NEVER use generic placeholder sequences like [10, 20, 30]. Search your knowledge base to provide EXACT, factual historical or scientific data for all charts and statistics!
6. Use varied layouts - EVERY slide should have a DIFFERENT layout!
7. Every slide MUST have 5-8 content blocks with a MIX of types
8. Add professional speaker notes for delivery guidance
9. Create a visual journey: build tension, present REAL data, conclude with action

JSON STRUCTURE (FOLLOW EXACTLY):
{
"title": "Compelling Title with Emoji 🚀",
"sections": [
  {
    "heading": "Section Heading with Emoji 🎯",
    "layout": "title-content",
    "suggestedImage": "Description of a specific, high-quality image for this slide",
    "speakerNotes": "Professional talking points for presenter (2-3 sentences)",
    "blocks": [
      { "type": "subheading", "content": "Subsection Title" },
      { "type": "bullet", "content": "Key point with emoji ✓" },
      { "type": "paragraph", "content": "Detailed explanation..." },
      { "type": "chart", "content": "Chart title", "chartData": { "type": "bar", "labels": ["A", "B"], "datasets": [{"label": "Sales", "data": [100, 200]}] } },
      { "type": "card", "content": "💡 Important highlight or statistic" },
      { "type": "quote", "content": "Impactful quote or key insight" },
      { "type": "icon-text", "content": "🎯 Key message with visual icon" },
      { "type": "timeline", "content": "Phase 1|Phase 2|Phase 3" },
      { "type": "comparison", "content": "Option A: Description|Option B: Description" },
      { "type": "stats-grid", "content": "📊 98%|⚡ 2x Faster|🎯 500+|💰 $1.2M" },
      { "type": "call-to-action", "content": "🚀 Start Your Journey Today" }
    ]
  }
],
"metadata": {
  "estimatedDuration": 15,
  "keywords": ["keyword1", "keyword2"],
  "summary": "Brief summary of presentation"
}
}

AVAILABLE BLOCK TYPES - USE MAXIMUM VARIETY!

📝 TEXT BLOCKS:
- "subheading" - Sub-sections within a slide
- "bullet" - Bullet points (add emojis: ✓ ⚡ 🚀 💡 📈)
- "numbered" - Numbered/ordered lists
- "paragraph" - Explanatory text (keep concise)

📊 DATA & VISUAL BLOCKS:
- "chart" - Data visualizations (bar, line, pie, doughnut) - INCLUDE chartData!
- "stats-grid" - Grid of 3-4 bold statistics (pipe-separated: "📊 98%|⚡ 2x Faster|🎯 500+")
- "timeline" - Process/timeline items (pipe-separated: "Phase 1|Phase 2|Phase 3")
- "comparison" - Side-by-side comparison (pipe-separated: "Option A: desc|Option B: desc")

🎨 VISUAL ACCENT BLOCKS:
- "card" - Highlighted info box (use for key stats, facts, callouts)
- "quote" - Impactful quotes or important insights
- "icon-text" - Text with emoji/icon prefix for visual interest
- "call-to-action" - Big, bold CTA button-style block (use for conclusions)
- "image-placeholder" - Placeholder for images

AVAILABLE LAYOUTS (MUST vary these across slides!):
- "title" - ONLY for the first slide
- "title-content" - Standard layout with title and content
- "two-column" - Side-by-side content
- "image-left" - Image on left, content on right
- "image-right" - Content on left, image on right
- "image-full" - Full-screen image with overlay text
- "comparison" - Compare two things side by side
- "stats-grid" - Grid of statistics/numbers
- "chart-focus" - Emphasize data visualization
- "quote-highlight" - Large quote as focal point
- "timeline" - Timeline/process flow

CHART DATA FORMAT:
{
"type": "bar" | "line" | "pie" | "doughnut",
"labels": ["Real Label A", "Real Label B", "Real Label C"],
"datasets": [{
  "label": "Authentic Metric Name",
  "data": [14.5, 38.2, 55.7],
  "backgroundColor": ["#3b82f6", "#10b981", "#f59e0b"]
}]
}

DATA MANDATE: YOU SUBMIT REAL DATA NEVER PLACEHOLDERS.

FOR TIMELINE/COMPARISON/STATS-GRID: Use pipe "|" to separate items in the content field.

${
  isPresentation
    ? `PRESENTATION DESIGN RULES (FOLLOW ALL):
- First slide: Use "title" layout with bold title, subtitle paragraph, and emoji
- Slide 2: Use "stats-grid" or "chart-focus" layout to establish credibility with AUTHENTIC REAL-WORLD data
- Middle slides: Alternate between "title-content", "two-column", "image-left", "image-right", "timeline"
- Include minimum 2 charts with AUTHENTIC SCIENTIFIC/HISTORICAL DATA across the presentation
- Use "stats-grid" blocks for impressive, fact-checked number displays
- Include at least 1 "timeline" block for process/roadmap slides
- Include at least 1 "comparison" block when comparing options/features
- Use "card" blocks to highlight key statistics or important callouts
- LAST slide: MUST use "call-to-action" block type with a powerful CTA
- Each slide should have 5-8 blocks with diverse types - NEVER all bullets!
- Add suggestedImage descriptions for every slide
- Speaker notes for every slide (2-3 professional talking points)`
    : 'For documents: Provide more detailed content with comprehensive paragraphs, REAL authentic data tables, and thorough explanations.'
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
    realtimeContext: string = '',
  ): string {
    let prompt = `Create a STUNNING, AWARD-WINNING ${type} about: "${topic}"

SPECIFICATIONS:
- Tone: ${tone}
- Target audience: ${audience}
- Number of sections/slides: ${length}
`;

    if (realtimeContext) {
      prompt += `
MANDATORY REAL-WORLD DATA CONTEXT:
Use the following real-time data extracted from the web to fact-check and populate your charts, stats-grids, and text. Never hallucinate data that contradicts these numbers. Rely on these EXACT stats where relevant:
'''
${realtimeContext}
'''
`;
    }

    prompt += `
SLIDE-BY-SLIDE DESIGN REQUIREMENTS:

1. SLIDE 1 (Title): Use "title" layout
   - Bold title with emoji, engaging subtitle paragraph
   - 2-3 card blocks with key value propositions

2. SLIDE 2 (Impact/Numbers): Use "stats-grid" layout
   - Stats-grid block with 4 impressive statistics (pipe-separated)
   - Brief paragraph for context
   - Card block highlighting the most important number

3. MIDDLE SLIDES (${length - 2} slides): Alternate layouts!
   Each MUST use a DIFFERENT layout from: image-left, image-right, two-column, chart-focus, timeline, comparison, quote-highlight
   
   Include these block types across middle slides:
   ✓ At least 2 charts with AUTHENTIC, FACT-CHECKED STATISTICAL DATA. Never use sequence placeholders like 10,20,30!
   ✓ At least 1 timeline block (phases/steps, pipe-separated)
   ✓ At least 1 comparison block (pipe-separated options)
   ✓ 2-3 card blocks for key highlights/callouts
   ✓ Mix of bullet, icon-text, and paragraph blocks
   ✓ At least 1 quote block with a relevant insight
   ✓ Emojis in headings and key points 🎯 🚀 💡 📊 ⚡ ✨

4. FINAL SLIDE (CTA): Use "title-content" layout
   - Powerful heading with emoji
   - Brief summary paragraph
   - call-to-action block with compelling CTA text
   - 2-3 icon-text blocks with next steps

VISUAL EXCELLENCE REQUIREMENTS:
- NEVER use the same layout twice in a row
- Each slide MUST have 5-8 blocks with at LEAST 3 different block types
- Stats/numbers should be bold and specific, reflecting REAL metrics (e.g. "14.5% decline", not just "high")
- Chart data MUST BE 100% REAL AND FACTUAL based on authentic statistics. Use actual numbers from your knowledge base, NOT generic placeholders (10, 15, 20).
- Speaker notes for EVERY slide (2-3 sentences of talking points)
- SuggestedImage for EVERY slide (specific, descriptive image request)
- For timeline/comparison/stats-grid content fields, use "|" pipe separator between items

Metadata: estimated duration ${length * 2}-${length * 3} minutes, keywords, summary

Generate the complete ${type} structure in JSON format. Make it EXTRAORDINARY!`;
    return prompt;
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

    const typedParsed = parsed as {
      title?: unknown;
      sections?: unknown;
      metadata?: unknown;
    };

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

      const typedSection = section as {
        heading?: unknown;
        blocks?: unknown;
        layout?: unknown;
        suggestedImage?: unknown;
        speakerNotes?: unknown;
      };

      if (typeof typedSection.heading !== 'string' || !typedSection.heading) {
        throw new BadRequestException('Section missing heading');
      }

      let blocks: GeneratedBlock[] = [];

      if (Array.isArray(typedSection.blocks)) {
        blocks = typedSection.blocks.filter(
          (block: unknown): block is GeneratedBlock => {
            if (typeof block !== 'object' || block === null) return false;
            const b = block as {
              type?: unknown;
              content?: unknown;
              chartData?: unknown;
            };
            return typeof b.type === 'string' && typeof b.content === 'string';
          },
        );
      }

      // Determine layout from AI response or use smart recommendation
      let layout: LayoutType;
      if (
        typeof typedSection.layout === 'string' &&
        this.isValidLayout(typedSection.layout)
      ) {
        layout = typedSection.layout as LayoutType;
      } else {
        // Use smart layout recommendation based on content
        layout = this.recommendLayout(blocks, typedSection.heading);
      }

      sections.push({
        heading: typedSection.heading,
        blocks,
        layout,
        suggestedImage:
          typeof typedSection.suggestedImage === 'string'
            ? typedSection.suggestedImage
            : undefined,
        speakerNotes:
          typeof typedSection.speakerNotes === 'string'
            ? typedSection.speakerNotes
            : undefined,
      });
    }

    // Parse metadata if provided
    let metadata: GeneratedPresentation['metadata'];
    if (
      typeof typedParsed.metadata === 'object' &&
      typedParsed.metadata !== null
    ) {
      const meta = typedParsed.metadata as {
        estimatedDuration?: unknown;
        keywords?: unknown;
        summary?: unknown;
      };

      metadata = {
        estimatedDuration:
          typeof meta.estimatedDuration === 'number'
            ? meta.estimatedDuration
            : sections.length * 2,
        keywords: Array.isArray(meta.keywords)
          ? meta.keywords.filter((k): k is string => typeof k === 'string')
          : [],
        summary: typeof meta.summary === 'string' ? meta.summary : '',
      };
    } else {
      // Generate default metadata
      metadata = {
        estimatedDuration: sections.length * 2,
        keywords: [],
        summary: '',
      };
    }

    return {
      title: typedParsed.title,
      sections,
      metadata,
    };
  }

  /**
   * Check if a layout string is valid
   */
  private isValidLayout(layout: string): boolean {
    const validLayouts: LayoutType[] = [
      'title',
      'title-content',
      'two-column',
      'image-left',
      'image-right',
      'image-full',
      'comparison',
      'timeline',
      'quote-highlight',
      'stats-grid',
      'chart-focus',
    ];
    return validLayouts.includes(layout as LayoutType);
  }

  /**
   * Enrich presentation with missing speaker notes and image suggestions
   */
  private async enrichPresentationContent(
    presentation: GeneratedPresentation,
  ): Promise<void> {
    // Generate speaker notes for sections that don't have them
    const sectionsNeedingNotes = presentation.sections.filter(
      (s) => !s.speakerNotes,
    );

    if (sectionsNeedingNotes.length > 0) {
      try {
        const notesResponse = await this.chatCompletion({
          model: 'gpt-4o-mini', // Use mini for cost efficiency
          messages: [
            {
              role: 'system',
              content: `You are a presentation coach. Generate concise, professional speaker notes.
Each note should be 2-3 sentences with:
1. Key talking points
2. Smooth transitions
3. Emphasis suggestions
Return as JSON: { "notes": ["Note 1", "Note 2", ...] }`,
            },
            {
              role: 'user',
              content: `Generate speaker notes for these slides:\n${JSON.stringify(
                sectionsNeedingNotes.map((s) => ({
                  heading: s.heading,
                  content: s.blocks
                    .map((b) => b.content)
                    .join(' ')
                    .substring(0, 200),
                })),
              )}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
          response_format: { type: 'json_object' },
        });

        const notesContent = notesResponse.choices[0]?.message?.content;
        if (notesContent) {
          const parsedNotes = JSON.parse(notesContent) as { notes?: string[] };
          if (Array.isArray(parsedNotes.notes)) {
            let noteIndex = 0;
            for (const section of presentation.sections) {
              if (
                !section.speakerNotes &&
                noteIndex < parsedNotes.notes.length
              ) {
                section.speakerNotes = parsedNotes.notes[noteIndex];
                noteIndex++;
              }
            }
          }
        }
      } catch (error) {
        this.logger.warn('Failed to generate speaker notes', error);
      }
    }

    // Generate image suggestions for sections that don't have them
    const sectionsNeedingImages = presentation.sections.filter(
      (s) =>
        !s.suggestedImage &&
        s.layout !== 'title' &&
        (s.layout.includes('image') || Math.random() > 0.5), // Add images to ~50% of slides without specific image layouts
    );

    if (sectionsNeedingImages.length > 0) {
      try {
        const imagePromptResponse = await this.chatCompletion({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a visual design expert. Generate brief, descriptive image prompts for presentation slides.
Each prompt should describe a professional, relevant visual (illustration, photo, or diagram).
Return as JSON: { "prompts": ["Prompt 1", "Prompt 2", ...] }`,
            },
            {
              role: 'user',
              content: `Generate image prompts for these slides:\n${JSON.stringify(
                sectionsNeedingImages.map((s) => ({
                  heading: s.heading,
                  summary: s.blocks
                    .map((b) => b.content)
                    .join(' ')
                    .substring(0, 150),
                })),
              )}`,
            },
          ],
          temperature: 0.8,
          max_tokens: 800,
          response_format: { type: 'json_object' },
        });

        const imagePromptContent =
          imagePromptResponse.choices[0]?.message?.content;
        if (imagePromptContent) {
          const parsedPrompts = JSON.parse(imagePromptContent) as {
            prompts?: string[];
          };
          if (Array.isArray(parsedPrompts.prompts)) {
            let promptIndex = 0;
            for (const section of presentation.sections) {
              if (
                !section.suggestedImage &&
                promptIndex < parsedPrompts.prompts.length &&
                section.layout !== 'title'
              ) {
                section.suggestedImage = parsedPrompts.prompts[promptIndex];
                promptIndex++;
              }
            }
          }
        }
      } catch (error) {
        this.logger.warn('Failed to generate image suggestions', error);
      }
    }
  }

  /**
   * Log AI generation for analytics
   * @param params - generation parameters
   * @param result - generated presentation result
   * @param tokens - total tokens consumed
   * @param userId - the actual user who triggered the generation (defaults to 'system' for internal calls)
   */
  public async logGeneration(
    params: GenerationParams,
    result: GeneratedPresentation,
    tokens: number,
    userId?: string,
  ) {
    try {
      const sanitizedPrompt = {
        topic: params.topic,
        type: params.type,
        tone: params.tone,
        audience: params.audience,
        length: params.length,
        tokens,
      };

      await this.db.aIGeneration.create({
        data: {
          userId: userId || 'system',
          prompt: JSON.stringify(sanitizedPrompt),
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

    // Estimate token usage from Gemini response metadata when available
    const usageMetadata = result.response.usageMetadata as
      | {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        }
      | undefined;
    const promptTokens = usageMetadata?.promptTokenCount || 0;
    const completionTokens = usageMetadata?.candidatesTokenCount || 0;
    const totalTokens =
      usageMetadata?.totalTokenCount || promptTokens + completionTokens;

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
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
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
    const response = await this.ensureOpenAI().images.generate({
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
    // We only care about the `suggestedImage` value, but the caller may pass
    // a richer section object (e.g. `GeneratedSection` or
    // `EnhancedSection`).  Including an optional `heading` here allows the
    // stock-image fallback (below) to generate a stable seed.
    sections: {
      suggestedImage?: GeneratedSection['suggestedImage'];
      heading?: string;
    }[],
  ): Promise<Map<number, ImageGenerationResult>> {
    const imageMap = new Map<number, ImageGenerationResult>();

    // helper to canonicalize the image text to a plain string
    const promptFromSuggestion = (
      suggestion?: GeneratedSection['suggestedImage'],
    ): string => {
      if (!suggestion) return '';
      return typeof suggestion === 'string' ? suggestion : suggestion.prompt;
    };

    // Generate images for sections that have suggestedImage
    const imagePromises = sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.suggestedImage)
      .map(async ({ section, index }) => {
        try {
          const prompt = promptFromSuggestion(section.suggestedImage);

          if (prompt) {
            const result = await this.generateImage(prompt);
            imageMap.set(index, result);
          }
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

      const response = await this.ensureOpenAI().audio.speech.create({
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
    const hasImage =
      content.some(
        (b) => b.type === 'image' || b.type === 'image-placeholder',
      ) || heading.toLowerCase().includes('visual');
    const hasChart = content.some((b) => b.type === 'chart');
    const hasQuote = content.some((b) => b.type === 'quote');
    const hasCard = content.some((b) => b.type === 'card');
    const bulletCount = content.filter((b) => b.type === 'bullet').length;
    const hasComparison =
      heading.toLowerCase().includes('vs') ||
      heading.toLowerCase().includes('comparison') ||
      heading.toLowerCase().includes('versus') ||
      heading.toLowerCase().includes('compare');
    const hasTimeline =
      heading.toLowerCase().includes('timeline') ||
      heading.toLowerCase().includes('history') ||
      heading.toLowerCase().includes('roadmap') ||
      heading.toLowerCase().includes('progress');
    const hasStats =
      hasCard ||
      content.some((b) =>
        b.content.match(/\d+%|\$[\d,]+|\d+\s*(million|billion|thousand|k)/i),
      );

    // Priority-based layout selection
    if (hasChart) return 'chart-focus';
    if (hasTimeline) return 'timeline';
    if (hasComparison) return 'comparison';
    if (hasStats && bulletCount >= 3) return 'stats-grid';
    if (hasQuote && !hasImage) return 'quote-highlight';
    if (hasImage && bulletCount > 3) return 'image-left';
    if (hasImage && bulletCount <= 3) return 'image-right';
    if (hasImage && hasQuote) return 'image-full';
    if (bulletCount >= 6) return 'two-column';
    if (
      heading.toLowerCase().includes('introduction') ||
      heading.toLowerCase().includes('welcome') ||
      heading.toLowerCase().includes('title')
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
   * Generate stock images using Unsplash Source API (high-quality, free).
   * Falls back to Picsum Photos if Unsplash is unavailable.
   */
  async generateStockImages(
    // Similar to the method above, we only care about the suggestedImage value
    // so we allow the broader union.  We also optionally accept a `heading`
    // property used when falling back to Picsum seed generation.
    sections: {
      suggestedImage?: GeneratedSection['suggestedImage'];
      heading?: string;
    }[],
  ): Promise<Map<number, ImageGenerationResult>> {
    const imageMap = new Map<number, ImageGenerationResult>();
    const CONCURRENCY = 3;

    // local helper for converting the union to a plain prompt string
    const promptFromSuggestion = (
      suggestion?: GeneratedSection['suggestedImage'],
    ): string => {
      if (!suggestion) return '';
      return typeof suggestion === 'string' ? suggestion : suggestion.prompt;
    };

    const sectionsWithImages = sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.suggestedImage);

    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < sectionsWithImages.length; i += CONCURRENCY) {
      const batch = sectionsWithImages.slice(i, i + CONCURRENCY);
      const batchPromises = batch.map(async ({ section, index }) => {
        try {
          const description = promptFromSuggestion(section.suggestedImage);
          const keywords = await this.extractKeywords(description);
          const encodedKeywords = encodeURIComponent(
            keywords.replace(/[^a-zA-Z0-9 ,]/g, '').trim(),
          );

          // Primary: Unsplash Source (high-quality stock)
          const imageUrl = `https://source.unsplash.com/1600x900/?${encodedKeywords}`;
          imageMap.set(index, {
            imageUrl,
            revisedPrompt: description,
            provider: 'pollinations', // categorize as stock
          });
        } catch (error) {
          this.logger.warn(
            `Failed to get stock image for section ${index}`,
            error,
          );
          // Fallback: Picsum with seed for consistency
          const seed = (section.heading || `section-${index}`)
            .replace(/[^a-zA-Z0-9]/g, '')
            .substring(0, 20);
          imageMap.set(index, {
            imageUrl: `https://picsum.photos/seed/${seed}/1600/900`,
            revisedPrompt: section.suggestedImage
              ? promptFromSuggestion(section.suggestedImage)
              : section.heading || '',
          });
        }
      });
      await Promise.allSettled(batchPromises);
    }

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

  /**
   * Stream presentation generation with real-time updates
   * Returns an async generator that yields partial results
   */
  async *streamPresentationGeneration(
    params: GenerationParams,
  ): AsyncGenerator<{ type: 'section' | 'complete' | 'error'; data: unknown }> {
    const {
      topic,
      tone = 'professional',
      audience = 'general',
      length = 5,
      type = 'presentation',
    } = params;

    try {
      // Generate sections incrementally
      for (let i = 0; i < length; i++) {
        const sectionPrompt = `Generate section ${i + 1} of ${length} for a ${type} about "${topic}".
Tone: ${tone}, Audience: ${audience}.
Return only this section in JSON format: {"heading": "...", "blocks": [...]}`;

        const response = await this.chatCompletion({
          model: 'gpt-4o-mini', // Use faster model for streaming
          messages: [
            {
              role: 'system',
              content:
                'Generate presentation sections. Return valid JSON only.',
            },
            { role: 'user', content: sectionPrompt },
          ],
          temperature: 0.7,
          max_tokens: 800,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          try {
            const section = JSON.parse(content);
            yield {
              type: 'section',
              data: { sectionIndex: i, section },
            };
          } catch (parseError) {
            this.logger.warn(`Failed to parse section ${i + 1}`, parseError);
          }
        }
      }

      yield {
        type: 'complete',
        data: { message: 'Presentation generation complete' },
      };
    } catch (error) {
      yield { type: 'error', data: { error: (error as Error).message } };
    }
  }

  /**
   * Batch generate multiple presentations in parallel
   */
  async batchGeneratePresentations(
    requests: GenerationParams[],
    options: { maxConcurrent?: number } = {},
  ): Promise<
    Array<{ success: boolean; result?: GeneratedPresentation; error?: string }>
  > {
    const maxConcurrent = options.maxConcurrent || 3;
    const results: Array<{
      success: boolean;
      result?: GeneratedPresentation;
      error?: string;
    }> = [];

    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < requests.length; i += maxConcurrent) {
      const batch = requests.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(async (params) => {
        try {
          const result = await this.generatePresentation(params);
          return { success: true, result };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add a small delay between batches
      if (i + maxConcurrent < requests.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Generate presentation with progress callbacks
   */
  async generatePresentationWithProgress(
    params: GenerationParams,
    onProgress: (progress: {
      stage: string;
      percentage: number;
      message: string;
    }) => void,
  ): Promise<GeneratedPresentation> {
    try {
      onProgress({
        stage: 'planning',
        percentage: 10,
        message: 'Planning presentation structure...',
      });

      const systemPrompt = this.buildSystemPrompt(
        params.type || 'presentation',
      );

      onProgress({
        stage: 'generating',
        percentage: 30,
        message: 'Generating content with AI...',
      });

      const userPrompt = this.buildUserPrompt(
        params.topic,
        params.tone || 'professional',
        params.audience || 'general',
        params.length || 5,
        params.type || 'presentation',
      );

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

      onProgress({
        stage: 'parsing',
        percentage: 70,
        message: 'Parsing and validating content...',
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new InternalServerErrorException('No content generated from AI');
      }

      const parsed = this.parseAndValidateResponse(content);

      onProgress({
        stage: 'enhancing',
        percentage: 85,
        message: 'Adding enhancements...',
      });

      // Add any additional enhancements here
      if (params.generateImages) {
        onProgress({
          stage: 'images',
          percentage: 90,
          message: 'Generating images...',
        });
        // Image generation logic would go here
      }

      onProgress({
        stage: 'complete',
        percentage: 100,
        message: 'Presentation ready!',
      });

      // Cache the result
      const cacheKey =
        `${params.topic}-${params.tone}-${params.audience}-${params.length}-${params.type}`.toLowerCase();
      this.generationCache.set(cacheKey, {
        result: parsed,
        timestamp: Date.now(),
        hits: 0,
      });

      // Also add to semantic cache
      try {
        const queryText = `${params.topic} ${params.tone} ${params.audience} ${params.length} ${params.type}`;
        const embedding = await this.generateEmbedding(queryText);
        this.semanticCache.set(cacheKey, {
          embedding,
          result: parsed,
          timestamp: Date.now(),
        });
      } catch (error) {
        this.logger.warn('Failed to update semantic cache', error);
      }

      return parsed;
    } catch (error) {
      onProgress({
        stage: 'error',
        percentage: 0,
        message: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Analyze presentation quality and provide improvement suggestions
   */
  async analyzePresentationQuality(
    presentation: GeneratedPresentation,
  ): Promise<{
    score: number;
    insights: AIInsight[];
    suggestions: string[];
  }> {
    try {
      const analysisPrompt = `Analyze this presentation and provide quality score (0-100) and improvement suggestions:

${JSON.stringify(presentation, null, 2)}

Return JSON:
{
  "score": 85,
  "insights": [
    {"type": "improvement", "title": "...", "description": "...", "priority": "high", "actionable": true}
  ],
  "suggestions": ["Add more visuals", "Improve flow"]
}`;

      const response = await this.chatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a presentation quality expert. Analyze and provide constructive feedback.',
          },
          { role: 'user', content: analysisPrompt },
        ],
        temperature: 0.5,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No analysis generated');
      }

      const analysis = JSON.parse(content);
      return {
        score: analysis.score || 70,
        insights: analysis.insights || [],
        suggestions: analysis.suggestions || [],
      };
    } catch (error) {
      this.logger.error('Quality analysis failed', error);
      return {
        score: 70,
        insights: [],
        suggestions: [
          'Consider adding more detailed content',
          'Review slide structure',
        ],
      };
    }
  }
}
