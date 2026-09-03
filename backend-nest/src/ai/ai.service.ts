import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LayoutType } from '@shared/index';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { RealTimeDataService } from './realtime-data.service';
import { HfInference, InferenceClient } from '@huggingface/inference';
import Replicate from 'replicate';
import { Ollama } from 'ollama';
import axios from 'axios';
import { ImageSuggestion } from './thinking-agent/thinking-agent.types';
import { AICostOptimizerService } from './ai-cost-optimizer.service';
import {
  isBannedFiller,
  looksLikeMockStatistic,
  recipeForSlideIndex,
} from './slide-recipes';

// Types for AI generation
type DesignStyle = 'editorial' | 'executive' | 'bold' | 'manifesto';
export interface GenerationParams {
  topic: string;
  tone?: string;
  audience?: string;
  length?: number;
  type?: string;
  designStyle?: DesignStyle | (string & {});
  generateImages?: boolean;
  imageSource?: 'ai' | 'stock';
  qualityMode?: boolean;
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
  themeId?: string;
}

export interface GeneratedBlock {
  type: string;
  content: string;
  items?: string[];
  value?: string;
  label?: string;
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

export interface GeneratedSection {
  heading: string;
  blocks: GeneratedBlock[];
  layout: LayoutType;
  kicker?: string;
  recipe?: string;
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
  aiModel?: string;
  aiProvider?: string;
}

export type ImageProvider =
  | 'nvidia'
  | 'gemini'
  | 'stability'
  | 'pollinations'
  | 'huggingface'
  | 'replicate'
  | 'dall-e-3';

/** Groq retired llama-3.3-70b-versatile for free/developer keys on 2026-08-16. */
const GROQ_CHAT_MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b'] as const;
/** Free Groq on_demand TPM. A request's prompt + max_tokens must stay under this. */
const GROQ_TPM_LIMIT = 8000;
const GOOGLE_CHAT_MODELS = [
  'gemini-3.6-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
] as const;
const NVIDIA_CHAT_MODELS = [
  'qwen/qwen3.5-122b-a10b',
  'meta/llama-3.1-70b-instruct',
] as const;

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

export interface LLMGenerationStat {
  providerModel: string;
  count: number;
  totalTokens: number;
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private openai!: OpenAI;
  private groq: OpenAI | null = null;
  private google: GoogleGenerativeAI | null = null;
  private readonly db: PrismaClient;
  private hf: HfInference;
  private replicate: Replicate;
  // Ollama client instance, used for local model testing
  private ollama: Ollama | null = null;
  private nvidia: OpenAI | null = null;

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
    this.db = this.prisma;
    const features = this.configService.get<{ openAI?: boolean }>('features');
    const openAiKeyRaw = this.configService.get<string>('OPENAI_API_KEY');
    const openAiKey =
      typeof openAiKeyRaw === 'string' ? openAiKeyRaw.trim() : undefined;

    const isOpenAiKeyConfigured = !this.isPlaceholderSecret(openAiKey);

    if (features?.openAI === false) {
      this.logger.log(
        'OpenAI support disabled via feature flag; AIService will not initialize client',
      );
      // leave this.openai uninitialized (undefined) â€“ calls should check
    } else if (!isOpenAiKeyConfigured) {
      this.logger.debug(
        'OpenAI API key is not configured or is using the placeholder value; OpenAI support will be disabled.',
      );
      // leave this.openai uninitialized; this avoids invalid key errors
    } else {
      this.openai = new OpenAI({ apiKey: openAiKey, timeout: 30000 }); // 30 second timeout
    }

    const groqApiKey = this.configService.get<string>('GROQ_API_KEY');
    if (groqApiKey) {
      this.groq = new OpenAI({
        apiKey: groqApiKey,
        baseURL: 'https://api.groq.com/openai/v1',
        timeout: 30000, // 30 second timeout
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

    const nvidiaApiKey = this.configService.get<string>('NVIDIA_API_KEY');
    if (nvidiaApiKey) {
      this.nvidia = new OpenAI({
        apiKey: nvidiaApiKey,
        baseURL: 'https://integrate.api.nvidia.com/v1',
      });
    }

    // Clear caches on startup to clean up results that might have missing model/provider fields
    this.generationCache.clear();
    this.semanticCache.clear();

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
  ): Promise<OpenAI.Chat.Completions.ChatCompletion & { provider: string }> {
    const chatParams =
      options as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

    // 0. Try Ollama first for testing/cost optimization (if available)
    if (this.ollama) {
      try {
        const response = await this.retryOperation(
          () => this.callOllama(options),
          'Ollama',
          1, // Try once
          1000,
        );
        return { ...response, provider: 'Ollama' };
      } catch (error) {
        this.logger.warn(
          `Ollama failed: ${(error as Error).message}. Falling back to cloud providers.`,
        );
      }
    }

    // 1. Try NVIDIA AI - First priority as requested
    if (this.nvidia) {
      for (const nvidiaModel of NVIDIA_CHAT_MODELS) {
        try {
          const nvidiaOptions = {
            ...chatParams,
            model: nvidiaModel,
            chat_template_kwargs: options.chat_template_kwargs || {
              enable_thinking: true,
            },
          } as OpenAI.Chat.Completions.ChatCompletionCreateParams & {
            chat_template_kwargs?: Record<string, unknown>;
          };

          const response = (await this.retryOperation(
            () => this.nvidia!.chat.completions.create(nvidiaOptions),
            'NVIDIA',
            2,
            1000,
          )) as OpenAI.Chat.Completions.ChatCompletion;
          return { ...response, provider: 'NVIDIA' };
        } catch (error) {
          this.logger.warn(
            `NVIDIA AI (${nvidiaModel}) failed: ${(error as Error).message}.`,
          );
        }
      }
    }

    // 2. Try Groq (if available) - Faster and cheaper
    if (this.groq) {
      for (const groqModel of GROQ_CHAT_MODELS) {
        try {
          const groqOptions = {
            ...this.fitGroqTokenBudget(chatParams),
            model: groqModel,
          } satisfies OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

          const response = (await this.retryOperation(
            () => this.groq!.chat.completions.create(groqOptions),
            'Groq',
            2,
            1000,
          )) as OpenAI.Chat.Completions.ChatCompletion;
          return { ...response, provider: 'Groq' };
        } catch (error) {
          this.logger.warn(
            `Groq AI (${groqModel}) failed after retries: ${(error as Error).message}.`,
          );
        }
      }
    }

    // 3. Try Google next (if available) - Good balance of speed/quality
    if (this.google) {
      for (const googleModel of GOOGLE_CHAT_MODELS) {
        try {
          const response = await this.retryOperation(
            () => this.callGoogleAI(options, googleModel),
            'Google AI',
            2,
            1000,
          );
          return { ...response, provider: 'Google' };
        } catch (error) {
          this.logger.warn(
            `Google AI (${googleModel}) failed after retries: ${(error as Error).message}.`,
          );
        }
      }
    }

    // 4. Fallback to OpenAI - More reliable but slower/expensive
    if (!this.openai) {
      throw new BadRequestException(
        'All AI providers failed. Set a valid GROQ_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or OPENAI_API_KEY.',
      );
    }
    const response = (await this.retryOperation(
      () => this.openai.chat.completions.create(chatParams),
      'OpenAI',
      3, // Retry up to 3 times
      1000, // Start with 1s delay
    )) as OpenAI.Chat.Completions.ChatCompletion;
    return { ...response, provider: 'OpenAI' };
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
        this.logger.error(
          `Cost-optimized completion failed: ${(error as Error).message}`,
        );
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
      length = 10,
      type = 'presentation',
      designStyle = 'editorial',
    } = params;

    // Try semantic cache first
    const queryText = `${topic} ${tone} ${audience} ${length} ${type} ${designStyle}`;
    const cacheKey =
      `${topic}-${tone}-${audience}-${length}-${type}-${designStyle}`.toLowerCase();

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

    // Fetch live search data only when providers return real results.
    // Mock fallbacks must never be treated as facts.
    let realtimeContext = '';
    try {
      this.logger.log(
        `Fetching real-time statistical data for topic: ${topic}`,
      );
      const searchResult = await this.realTimeDataService.search(
        `${topic} current statistics percentages numbers data metrics`,
        4,
      );
      const snippets = (searchResult?.results || [])
        .map((r) => r.snippet)
        .filter(
          (snippet) =>
            Boolean(snippet) &&
            !looksLikeMockStatistic(snippet) &&
            !snippet.includes('example.com') &&
            !snippet.includes('sample result'),
        );
      if (snippets.length > 0) {
        realtimeContext = snippets.join('\n---\n');
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
      designStyle,
    );

    try {
      const useTwoPass = length >= 8;
      let outlineContext = '';

      if (useTwoPass) {
        try {
          const outlineResponse = await this.chatCompletion({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content:
                  'Return ONLY valid JSON. Design a presentation outline, not full copy.',
              },
              {
                role: 'user',
                content: this.buildOutlinePrompt(
                  topic,
                  tone,
                  audience,
                  length,
                  designStyle,
                ),
              },
            ],
            temperature: 0.6,
            max_tokens: 2000,
            response_format: { type: 'json_object' },
          });
          outlineContext = outlineResponse.choices[0]?.message?.content || '';
        } catch (outlineError) {
          this.logger.warn(
            'Outline pass skipped; generating full deck in one shot',
            outlineError,
          );
        }
      }

      const contentPrompt = outlineContext
        ? `${userPrompt}\n\nAPPROVED OUTLINE (expand each slide; do not drop slides):\n${outlineContext}`
        : userPrompt;

      const response = await this.chatCompletion({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contentPrompt },
        ],
        temperature: 0.7,
        max_tokens: 8000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new InternalServerErrorException('No content generated from AI');
      }

      // Parse and validate the response
      const parsed = this.sanitizeGeneratedPresentation(
        this.parseAndValidateResponse(content),
        length,
      );
      parsed.aiModel = response.model || 'Unknown';
      parsed.aiProvider = response.provider || 'Unknown';

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
        response.model,
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

    return `You are a world-class ${isPresentation ? 'presentation' : 'document'} designer in the league of Gamma and Apple keynotes.

Create designed slides, not documents. Each slide has one visual job and one message.

NON-NEGOTIABLE RULES:
1. Return ONLY valid JSON. No markdown or commentary.
2. Headlines are 6-8 words, specific, and curious. Never restate the topic as a label.
3. Name real companies, products, laws, or studies when the topic supports it. Vague claims are banned.
4. Statistics must be specific and attributable. If you do not have a real number, OMIT the statistic. Never invent figures. Never use $1.2B, 15%, or 2.5M as placeholders.
5. Banned phrases: "in today's world", "it's important to note", "unlock potential", "innovative solutions", "why this matters now: clear outcome", "key takeaway: focus on one decisive insight".
6. Use 4-8 purposeful blocks per slide. Include a topical kicker (2-4 word eyebrow) on most slides. Never use editorial, executive, bold, or manifesto as kicker or heading text.
7. Vary layouts. Never repeat the same layout more than twice in a row.
8. Suggested images must be cinematic and specific (subject, setting, lighting), not generic stock phrases.
9. Typed visual blocks: statistic (value + label), comparison (items array), timeline (items array), card, call-to-action. Do NOT encode layouts as pipe-separated strings.

JSON STRUCTURE:
{
  "title": "Compelling presentation title",
  "sections": [
    {
      "heading": "6-8 word headline",
      "kicker": "SHORT EYEBROW LABEL",
      "layout": "title-hero",
      "suggestedImage": "Cinematic visual: subject, setting, lighting",
      "speakerNotes": "2-3 concise presenter notes",
      "blocks": [
        { "type": "kicker", "content": "THE FOUNDATION" },
        { "type": "paragraph", "content": "One tight supporting paragraph with a named example." },
        { "type": "statistic", "content": "95%+", "value": "95%+", "label": "Radiology detection accuracy" },
        { "type": "comparison", "content": "Healthcare vs Finance vs Commerce", "items": ["Healthcare: named proof", "Finance: named proof", "E-commerce: named proof"] },
        { "type": "timeline", "content": "Decade path", "items": ["2025-2026: claim", "2027-2028: claim"] },
        { "type": "card", "content": "Card title — one sentence of proof" },
        { "type": "call-to-action", "content": "Start a 30-day pilot this week" },
        { "type": "quote", "content": "Short attributed insight" },
        { "type": "bullet", "content": "Action-oriented point with a named example" }
      ]
    }
  ],
  "metadata": {
    "estimatedDuration": 15,
    "keywords": ["keyword1", "keyword2"],
    "summary": "Brief summary"
  }
}

AVAILABLE LAYOUTS:
- "title-hero"
- "title-subtitle"
- "title-content"
- "two-column"
- "three-column"
- "image-left"
- "image-right"
- "image-full"
- "comparison"
- "timeline"
- "quote-highlight"
- "stats-grid"
- "chart-focus"
- "bento-grid"

${
  isPresentation
    ? `PRESENTATION ARC:
- Slide 1: title-hero. Split energy: punchy headline + one supporting line.
- Early: credibility with named examples or real stats (stats-grid / three-column).
- Middle: proof (comparison or three-column), story (image-right), path (timeline).
- Close: quote-highlight or bento-grid CTA with 3 concrete next actions.
- Use at most one quote-highlight unless the topic is narrative-heavy.`
    : 'DOCUMENT GUIDANCE: preserve hierarchy, keep paragraphs tighter than report prose, and use data visuals only when they clarify the argument.'
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
    designStyle: string = 'editorial',
  ): string {
    const emojiGuidance =
      tone === 'creative' || tone === 'casual'
        ? 'Use at most one tasteful emoji in occasional headings or callouts.'
        : 'Do not use emojis.';

    let prompt = `Create a polished ${type} about: "${topic}"

SPECIFICATIONS:
- Tone: ${tone}
- Target audience: ${audience}
- Number of sections/slides: ${length}
- Visual priority: strong hierarchy, deliberate whitespace, and a clear focal point per slide
- Emoji guidance: ${emojiGuidance}
- Design style: ${designStyle}
`;

    const designStyleGuide: Record<
      'editorial' | 'executive' | 'bold' | 'manifesto',
      string
    > = {
      editorial:
        'Use refined editorial pacing: elegant whitespace, restrained accents, thoughtful typography contrast, and image-led storytelling.',
      executive:
        'Use executive briefing style: clean, data-forward slides, minimal decoration, decisive headings, and high-clarity chart/callout moments.',
      bold: 'Use high-impact modern style: strong contrast, punchy callouts, decisive section breaks, and vivid but disciplined visual accents.',
      manifesto:
        'Use manifesto style: ultra-clear statements, high contrast, minimal text per slide, dramatic quote/callout moments, and cinematic visual direction.',
    };

    const guideString =
      designStyleGuide[designStyle as keyof typeof designStyleGuide] ||
      `Follow this custom design style direction: ${designStyle}`;

    if (realtimeContext) {
      prompt += `
REAL-WORLD DATA (use only these numbers; if a claim is not here, write it without a number):
'''
${realtimeContext}
'''
`;
    } else {
      prompt += `
NO VERIFIED STATISTICS WERE PROVIDED. Do not invent market size, growth rate, or user counts. Prefer named qualitative examples over fake numbers.
`;
    }

    prompt += `
  DECK REQUIREMENTS:

  1. Opening slide:
    - Use "title-hero"
    - One punchy headline, one supporting line, cinematic suggestedImage

  2. Evidence slide:
    - Use "stats-grid" or "three-column" only with real numbers or named proof points
    - If numbers are not reliable, use named examples instead of a chart

  3. Middle slides:
    - Mix "image-right", "comparison", "timeline", "three-column"
    - One idea per slide. Cards and comparisons use items arrays, never pipe "|" strings

  4. Final slide:
    - Use "quote-highlight" or "bento-grid"
    - End with 3 concrete actions the audience can take this week

  VISUAL EXCELLENCE REQUIREMENTS:
  - Follow this style direction: ${guideString}
  - Never repeat the same layout more than twice consecutively
  - Each slide should have 4-8 blocks and a kicker where it helps hierarchy
  - Kickers are topical eyebrows like "THE SHIFT" or "IN PRACTICE", never the design-style name
  - Do not duplicate section.kicker as a type:"kicker" block
  - Use statistics only when specific and credible
  - SuggestedImage on hero, proof, timeline, and close slides
  - Avoid generic filler such as "innovative solutions" or "unlock potential"

Metadata: estimated duration ${length * 2}-${length * 3} minutes, keywords, summary

CRITICAL: Return ONLY valid JSON - no markdown, no explanations. Start with { and end with }.`;
    return prompt;
  }

  private buildOutlinePrompt(
    topic: string,
    tone: string,
    audience: string,
    length: number,
    designStyle: string,
  ): string {
    return `Create a ${length}-slide outline for "${topic}".
Audience: ${audience}. Tone: ${tone}. Style: ${designStyle}.

Return JSON:
{
  "title": "string",
  "narrativeArc": "one sentence",
  "slides": [
    {
      "heading": "6-8 word headline",
      "kicker": "EYEBROW",
      "layout": "title-hero|three-column|stats-grid|comparison|timeline|image-right|quote-highlight|bento-grid",
      "keyPoints": ["named example or proof point"],
      "suggestedImage": "cinematic visual direction"
    }
  ]
}

Slide 1 must be title-hero. Include at least one comparison, one timeline, and one stats-grid or three-column. Close with a CTA slide.`;
  }

  private sanitizeGeneratedPresentation(
    presentation: GeneratedPresentation,
    targetLength: number,
  ): GeneratedPresentation {
    const sections = presentation.sections.map((section, index) => {
      const recipe = recipeForSlideIndex(index, presentation.sections.length);
      const blocks = section.blocks.filter((block) => {
        const haystack = [block.content, block.label, ...(block.items || [])]
          .filter(Boolean)
          .join(' ');
        if (!haystack.trim()) return false;
        if (isBannedFiller(haystack)) return false;
        if (looksLikeMockStatistic(haystack)) return false;
        return true;
      });

      return {
        ...section,
        kicker: section.kicker || undefined,
        layout: section.layout || recipe.layout,
        recipe: recipe.id,
        blocks,
        suggestedImage:
          section.suggestedImage ||
          (recipe.wantsImage
            ? `Cinematic 16:9 photograph for: ${section.heading}`
            : section.suggestedImage),
      };
    });

    return {
      ...presentation,
      sections:
        targetLength > 0
          ? sections.slice(0, Math.max(targetLength, 3))
          : sections,
    };
  }

  /**
   * Parse and validate the AI response
   */
  private parseAndValidateResponse(content: string): GeneratedPresentation {
    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON from mixed content (AI sometimes includes thinking text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
          this.logger.warn('Extracted JSON from mixed AI response');
        } catch {
          this.logger.error(
            'Failed to parse extracted JSON from AI response',
            content,
          );
          throw new BadRequestException(
            'AI generated invalid content. Please try again.',
          );
        }
      } else {
        this.logger.error(
          'Failed to parse AI response as JSON - no JSON found',
          content,
        );
        throw new BadRequestException(
          'AI generated invalid content. Please try again.',
        );
      }
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
        kicker?: unknown;
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
        blocks = typedSection.blocks
          .map((block: unknown) => this.normalizeGeneratedBlock(block))
          .filter((block): block is GeneratedBlock => block !== null);
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
        kicker:
          typeof typedSection.kicker === 'string'
            ? typedSection.kicker
            : undefined,
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
      'title-hero',
      'title-subtitle',
      'title-content',
      'two-column',
      'two-column-image',
      'three-column',
      'image-left',
      'image-right',
      'image-full',
      'comparison',
      'timeline',
      'quote-highlight',
      'stats-grid',
      'chart-focus',
      'bento-grid',
      'gallery',
      'agenda',
      'content',
    ];
    return validLayouts.includes(layout as LayoutType);
  }

  private normalizeGeneratedBlock(raw: unknown): GeneratedBlock | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const b = raw as {
      type?: unknown;
      content?: unknown;
      items?: unknown;
      value?: unknown;
      label?: unknown;
      chartData?: unknown;
      embedUrl?: unknown;
    };
    if (typeof b.type !== 'string' || !b.type.trim()) return null;

    let content = '';
    let items: string[] | undefined;
    let value: string | undefined;
    let label: string | undefined;

    if (typeof b.content === 'string') {
      content = b.content;
    } else if (b.content && typeof b.content === 'object') {
      const nested = b.content as Record<string, unknown>;
      if (typeof nested.text === 'string') content = nested.text;
      else if (typeof nested.value === 'string') content = nested.value;
      if (Array.isArray(nested.items)) {
        items = nested.items.map((item) =>
          typeof item === 'string'
            ? item
            : String(
                (item as Record<string, unknown>)?.text ||
                  (item as Record<string, unknown>)?.value ||
                  item,
              ),
        );
      }
      if (typeof nested.value === 'string') value = nested.value;
      if (typeof nested.label === 'string') label = nested.label;
    }

    if (Array.isArray(b.items)) {
      items = b.items.map((item) =>
        typeof item === 'string'
          ? item
          : String(
              (item as Record<string, unknown>)?.text ||
                (item as Record<string, unknown>)?.value ||
                item,
            ),
      );
    }
    if (typeof b.value === 'string') value = b.value;
    if (typeof b.label === 'string') label = b.label;

    if (!content && value) content = value;
    if (!content && items?.length) content = items.join('\n');
    if (!content.trim() && !items?.length && !value) return null;

    const type = b.type.toLowerCase().replace(/_/g, '-');
    const mappedType =
      type === 'timeline-item'
        ? 'timeline'
        : type === 'comparison-item'
          ? 'comparison'
          : type === 'stats-grid'
            ? 'statistic'
            : type;

    return {
      type: mappedType,
      content: content.trim(),
      items,
      value,
      label,
      chartData: b.chartData as GeneratedBlock['chartData'],
      embedUrl: typeof b.embedUrl === 'string' ? b.embedUrl : undefined,
    };
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
    model: string,
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
          },
          tokens,
          model,
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

  private fitGroqTokenBudget(
    params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  ): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
    const promptTokens = Math.ceil(JSON.stringify(params.messages).length / 4);
    const reserve = 256;
    const maxOut = Math.max(256, GROQ_TPM_LIMIT - promptTokens - reserve);
    const requested = params.max_tokens ?? 2000;
    if (requested <= maxOut) {
      return params;
    }
    this.logger.warn(
      `Capping Groq max_tokens from ${requested} to ${maxOut} to stay under the ${GROQ_TPM_LIMIT} TPM limit.`,
    );
    return { ...params, max_tokens: maxOut };
  }

  private async callGoogleAI(
    options: Record<string, unknown>,
    modelName: string = GOOGLE_CHAT_MODELS[0],
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const generationConfig: Record<string, unknown> = {};
    const responseFormat = options.response_format as
      | { type?: string }
      | undefined;
    if (responseFormat?.type === 'json_object') {
      generationConfig.responseMimeType = 'application/json';
    }

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

    // Gemini's REST schema requires Content, not a bare string.
    const model = this.google!.getGenerativeModel({
      model: modelName,
      generationConfig,
      ...(systemInstructionText
        ? {
            systemInstruction: {
              role: 'user',
              parts: [{ text: systemInstructionText }],
            },
          }
        : {}),
    });

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
      model: modelName,
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
    };
  }

  // ============================================
  // ADVANCED AI FEATURES - GAMMA LEVEL
  // ============================================

  /**
   * Generate an image with priority-based fallback.
   * NVIDIA FLUX → Gemini Imagen → Stability AI → Pollinations → Hugging Face → Replicate → DALL-E.
   */
  async generateImage(
    prompt: string,
    style: 'vivid' | 'natural' = 'vivid',
    size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024',
    preferredProvider?: ImageProvider,
    referenceImageUrl?: string,
  ): Promise<ImageGenerationResult> {
    const providers: ImageProvider[] = [
      'nvidia',
      'gemini',
      'stability',
      'pollinations',
      'huggingface',
      'replicate',
      'dall-e-3',
    ];

    const orderedProviders = preferredProvider
      ? [preferredProvider, ...providers.filter((p) => p !== preferredProvider)]
      : providers;

    let lastError: unknown;

    for (const provider of orderedProviders) {
      try {
        switch (provider) {
          case 'nvidia':
            if (!this.getConfiguredKey('NVIDIA_API_KEY')) continue;
            return await this.generateImageNvidia(
              prompt,
              size,
              referenceImageUrl,
            );
          case 'gemini':
            if (!this.getConfiguredKey('GOOGLE_GENERATIVE_AI_API_KEY'))
              continue;
            return await this.generateImageGemini(prompt, size);
          case 'stability':
            if (!this.getConfiguredKey('STABILITY_API_KEY')) continue;
            return await this.generateImageStability(prompt, size);
          case 'pollinations':
            return await this.generateImagePollinations(prompt);
          case 'huggingface':
            if (!this.getConfiguredKey('HUGGINGFACE_API_KEY')) continue;
            return await this.generateImageHuggingFace(prompt);
          case 'replicate':
            if (!this.getConfiguredKey('REPLICATE_API_TOKEN')) continue;
            return await this.generateImageReplicate(prompt, referenceImageUrl);
          case 'dall-e-3':
            if (!this.getConfiguredKey('OPENAI_API_KEY')) continue;
            return await this.generateImageDallE(prompt, style, size);
        }
      } catch (error) {
        this.logger.warn(
          `Image generation failed with ${provider}: ${
            (error as Error).message
          }`,
        );
        lastError = error;
      }
    }

    throw new InternalServerErrorException(
      `Failed to generate image with all providers. Last error: ${
        (lastError as Error)?.message
      }`,
    );
  }

  private isPlaceholderSecret(value?: string): boolean {
    if (!value) return true;
    const trimmed = value.trim();
    if (!trimmed) return true;
    const lower = trimmed.toLowerCase();
    return (
      lower.startsWith('your-') ||
      lower.includes('your-actual') ||
      lower.includes('placeholder')
    );
  }

  private getConfiguredKey(name: string): string {
    const value = this.configService.get<string>(name) || '';
    if (this.isPlaceholderSecret(value)) {
      return '';
    }
    return value.trim();
  }

  private asDataImageUrl(raw: string, mime = 'image/png'): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith('data:image/')) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `data:${mime};base64,${trimmed}`;
  }

  private extractGeneratedImageUrl(payload: unknown): string {
    const rec = (payload || {}) as Record<string, unknown>;
    if (typeof rec.image === 'string' && rec.image.length > 8) {
      return this.asDataImageUrl(rec.image);
    }
    if (typeof rec.b64_json === 'string') {
      return this.asDataImageUrl(rec.b64_json);
    }
    const artifacts = rec.artifacts;
    if (Array.isArray(artifacts) && artifacts[0]) {
      const art = artifacts[0] as Record<string, unknown>;
      const b64 = art.base64 || art.b64_json;
      if (typeof b64 === 'string') return this.asDataImageUrl(b64);
    }
    const data = rec.data;
    if (Array.isArray(data) && data[0]) {
      const first = data[0] as Record<string, unknown>;
      if (typeof first.b64_json === 'string') {
        return this.asDataImageUrl(first.b64_json);
      }
      if (typeof first.url === 'string') return first.url;
    }
    const predictions = rec.predictions;
    if (Array.isArray(predictions) && predictions[0]) {
      const pred = predictions[0] as Record<string, unknown>;
      if (typeof pred.bytesBase64Encoded === 'string') {
        return this.asDataImageUrl(
          pred.bytesBase64Encoded,
          typeof pred.mimeType === 'string' ? pred.mimeType : 'image/png',
        );
      }
    }
    const candidates = rec.candidates;
    if (Array.isArray(candidates) && candidates[0]) {
      const parts =
        (
          (candidates[0] as Record<string, unknown>).content as Record<
            string,
            unknown
          >
        )?.parts || [];
      if (Array.isArray(parts)) {
        for (const part of parts) {
          const inline = (part as Record<string, unknown>).inlineData as
            | Record<string, unknown>
            | undefined;
          if (inline && typeof inline.data === 'string') {
            return this.asDataImageUrl(
              inline.data,
              typeof inline.mimeType === 'string'
                ? inline.mimeType
                : 'image/png',
            );
          }
        }
      }
    }
    throw new Error('Image API response did not include image data');
  }

  private async urlToDataUri(url: string): Promise<string> {
    if (url.startsWith('data:image/')) return url;
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 15_000,
    });
    const mime =
      String(response.headers['content-type'] || 'image/png').split(';')[0] ||
      'image/png';
    return `data:${mime};base64,${Buffer.from(response.data).toString('base64')}`;
  }

  /**
   * NVIDIA FLUX: Kontext-dev when a reference image exists, otherwise flux.1-dev.
   */
  async generateImageNvidia(
    prompt: string,
    size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024',
    referenceImageUrl?: string,
  ): Promise<ImageGenerationResult> {
    const apiKey = this.getConfiguredKey('NVIDIA_API_KEY');
    if (!apiKey) {
      throw new Error('NVIDIA_API_KEY is not configured');
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    const enhancedPrompt = `Professional 16:9 presentation photograph, cinematic lighting, no text overlay. ${prompt}`;
    const seed = Math.floor(Math.random() * 1_000_000);

    if (referenceImageUrl) {
      try {
        const image = await this.urlToDataUri(referenceImageUrl);
        const response = await axios.post(
          'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev',
          {
            prompt: enhancedPrompt,
            image,
            aspect_ratio: 'match_input_image',
            steps: 30,
            cfg_scale: 3.5,
            seed,
          },
          { headers, timeout: 90_000 },
        );
        if (response.status !== 200) {
          throw new Error(
            `NVIDIA Kontext failed with status ${response.status}`,
          );
        }
        return {
          imageUrl: this.extractGeneratedImageUrl(response.data),
          revisedPrompt: prompt,
          provider: 'nvidia',
        };
      } catch (error) {
        this.logger.warn(
          `NVIDIA Kontext-dev failed, trying flux.1-dev: ${(error as Error).message}`,
        );
      }
    }

    const [width, height] =
      size === '1792x1024'
        ? [1344, 768]
        : size === '1024x1792'
          ? [768, 1344]
          : [1024, 1024];

    const response = await axios.post(
      'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev',
      {
        prompt: enhancedPrompt,
        mode: 'base',
        cfg_scale: 3.5,
        width,
        height,
        seed,
        steps: 30,
        samples: 1,
      },
      { headers, timeout: 90_000 },
    );
    if (response.status !== 200) {
      throw new Error(`NVIDIA FLUX failed with status ${response.status}`);
    }

    this.logger.log(
      `Generated image (NVIDIA FLUX) for: ${prompt.substring(0, 30)}...`,
    );
    return {
      imageUrl: this.extractGeneratedImageUrl(response.data),
      revisedPrompt: prompt,
      provider: 'nvidia',
    };
  }

  /**
   * Gemini Imagen, then native Gemini image models.
   */
  async generateImageGemini(
    prompt: string,
    size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024',
  ): Promise<ImageGenerationResult> {
    const apiKey = this.getConfiguredKey('GOOGLE_GENERATIVE_AI_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not configured');
    }

    const enhancedPrompt = `Professional cinematic 16:9 presentation photograph, no text in the image. ${prompt}`;
    const aspectRatio =
      size === '1024x1792' ? '9:16' : size === '1024x1024' ? '1:1' : '16:9';

    try {
      const imagen = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
        {
          instances: [{ prompt: enhancedPrompt }],
          parameters: { sampleCount: 1, aspectRatio },
        },
        { timeout: 60_000 },
      );
      return {
        imageUrl: this.extractGeneratedImageUrl(imagen.data),
        revisedPrompt: prompt,
        provider: 'gemini',
      };
    } catch (imagenError) {
      this.logger.warn(
        `Gemini Imagen failed, trying Gemini image model: ${
          (imagenError as Error).message
        }`,
      );
    }

    const geminiModels = [
      'gemini-2.5-flash-image',
      'gemini-2.0-flash-preview-image-generation',
    ];
    let lastError: unknown;
    for (const model of geminiModels) {
      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            contents: [{ parts: [{ text: enhancedPrompt }] }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
          },
          { timeout: 60_000 },
        );
        return {
          imageUrl: this.extractGeneratedImageUrl(response.data),
          revisedPrompt: prompt,
          provider: 'gemini',
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(
      `Gemini image generation failed: ${(lastError as Error)?.message}`,
    );
  }

  /**
   * Stability AI Core, then SDXL.
   */
  async generateImageStability(
    prompt: string,
    size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024',
  ): Promise<ImageGenerationResult> {
    const apiKey = this.getConfiguredKey('STABILITY_API_KEY');
    if (!apiKey) {
      throw new Error('STABILITY_API_KEY is not configured');
    }

    const enhancedPrompt = `Professional cinematic presentation photograph, no text overlay. ${prompt}`;
    const aspectRatio =
      size === '1024x1792' ? '9:16' : size === '1024x1024' ? '1:1' : '16:9';

    try {
      const form = new FormData();
      form.append('prompt', enhancedPrompt);
      form.append('output_format', 'png');
      form.append('aspect_ratio', aspectRatio);
      const core = await axios.post(
        'https://api.stability.ai/v2beta/stable-image/generate/core',
        form,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          timeout: 60_000,
        },
      );
      return {
        imageUrl: this.extractGeneratedImageUrl(core.data),
        revisedPrompt: prompt,
        provider: 'stability',
      };
    } catch (coreError) {
      this.logger.warn(
        `Stability Core failed, trying SDXL: ${(coreError as Error).message}`,
      );
    }

    const [width, height] =
      size === '1024x1792'
        ? [768, 1344]
        : size === '1792x1024'
          ? [1344, 768]
          : [1024, 1024];
    const sdxl = await axios.post(
      'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
      {
        text_prompts: [{ text: enhancedPrompt, weight: 1 }],
        cfg_scale: 7,
        width,
        height,
        steps: 30,
        samples: 1,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 60_000,
      },
    );

    return {
      imageUrl: this.extractGeneratedImageUrl(sdxl.data),
      revisedPrompt: prompt,
      provider: 'stability',
    };
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
  async generateImageReplicate(
    prompt: string,
    referenceImageUrl?: string,
  ): Promise<ImageGenerationResult> {
    const input: Record<string, unknown> = {
      prompt: `professional presentation visual, ${prompt}, 4k, minimalist`,
      disable_safety_checker: true,
      aspect_ratio: '16:9',
    };

    if (referenceImageUrl) {
      input.image_prompt = referenceImageUrl;
    }

    const output = await this.replicate.run('black-forest-labs/flux-schnell', {
      input,
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
    styleSeed?: string,
    referenceImageUrl?: string,
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
            const finalPrompt = styleSeed
              ? `${prompt}. Art style requirements: ${styleSeed}. Do not include text. Maintain consistent lighting.`
              : prompt;

            const preferredProvider = referenceImageUrl ? 'nvidia' : undefined;
            const result = await this.generateImage(
              finalPrompt,
              'vivid',
              '1024x1024',
              preferredProvider,
              referenceImageUrl,
            );
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
      content.some(
        (b) =>
          b.type === 'statistic' ||
          Boolean(b.value) ||
          b.content.match(/\d+%|\$[\d,]+|\d+\s*(million|billion|thousand|k)/i),
      );

    // Priority-based layout selection
    if (hasChart) return 'chart-focus';
    if (hasTimeline || content.some((b) => b.type === 'timeline'))
      return 'timeline';
    if (hasComparison || content.some((b) => b.type === 'comparison'))
      return 'comparison';
    if (
      hasStats &&
      (bulletCount >= 3 || content.some((b) => b.type === 'statistic'))
    )
      return 'stats-grid';
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
      parsed.aiModel = response.model || 'Unknown';
      parsed.aiProvider = response.provider || 'Unknown';

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

        let styleSeed: string | undefined = undefined;
        let referenceImageUrl: string | undefined = undefined;

        if (params.themeId) {
          try {
            const theme = await this.db.theme.findUnique({
              where: { id: params.themeId },
            });
            if (theme) {
              styleSeed = theme.styleSeed || undefined;
              referenceImageUrl = theme.customReferenceImageUrl || undefined;
            }
          } catch (e) {
            this.logger.warn('Failed to fetch theme for style seed', e);
          }
        }

        if (source === 'ai') {
          imageMap = await this.generatePresentationImages(
            parsed.sections,
            styleSeed,
            referenceImageUrl,
          );
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
        response.model,
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

    return `You are an elite ${isPresentation ? 'presentation' : 'document'} designer.
Create compelling, visually-oriented content with smart layout suggestions and disciplined hierarchy.

IMPORTANT RULES:
1. Return ONLY valid JSON
2. Use storytelling techniques: hook, problem, solution, evidence, call-to-action
3. Suggest layouts that match the content, not novelty for novelty's sake
4. Include image descriptions only when a visual adds value
5. Add speaker notes for key slides
6. Avoid decorative excess; keep slides focused and readable
7. Never invent numerical data or use placeholder values

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
      "layout": "title-content|two-column|image-left|image-right|comparison|timeline|quote-highlight|stats-grid|chart-focus|title-subtitle|image-full",
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
- title-subtitle: Title plus one strong supporting statement
- title-content: Standard content slide
- two-column: Side-by-side comparison or dual content
- image-left/image-right: Content with featured image
- image-full: Full-bleed image with minimal overlay copy
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
    const emojiGuidance =
      tone === 'creative' || tone === 'casual'
        ? 'Use minimal emojis only when they reinforce the message.'
        : 'Do not use emojis.';

    return `Create a distinctive ${type} about: "${topic}"

SPECIFICATIONS:
- Tone: ${tone}
- Target audience: ${audience}
- Number of sections: ${length}
- Emoji guidance: ${emojiGuidance}

STRUCTURE REQUIREMENTS:
1. Start with a hook/attention-grabbing slide
2. Present the problem or opportunity
3. Provide solution/main content (2-3 slides)
4. Include evidence/data (with chart if applicable)
5. End with clear call-to-action and summary

QUALITY REQUIREMENTS:
- Each slide should have a clear purpose
- Use data and statistics only when they are credible and relevant
- Suggest images for visual impact when they strengthen the story
- Include speaker notes for complex slides
- Vary layouts for visual interest without making the deck feel random
- Keep block count disciplined; prefer 3-6 blocks per slide
- Avoid generic business filler and repeated phrasing

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
  generateStockImages(
    // Similar to the method above, we only care about the suggestedImage value
    // so we allow the broader union.  We also optionally accept a `heading`
    // property used when falling back to Picsum seed generation.
    sections: {
      suggestedImage?: GeneratedSection['suggestedImage'];
      heading?: string;
    }[],
  ): Promise<Map<number, ImageGenerationResult>> {
    const imageMap = new Map<number, ImageGenerationResult>();

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

    for (const { section, index } of sectionsWithImages) {
      try {
        const description = promptFromSuggestion(section.suggestedImage);
        const seed =
          (section.heading || description || `section-${index}`)
            .replace(/[^a-zA-Z0-9]/g, '')
            .substring(0, 24) || `slide${index}`;
        const imageUrl = `https://picsum.photos/seed/${seed}/1600/900`;
        imageMap.set(index, {
          imageUrl,
          revisedPrompt: description || section.heading || `slide ${index}`,
          provider: 'pollinations',
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
    }

    return Promise.resolve(imageMap);
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
    - Strong visual hierarchy and one clear focal point per slide
    - Disciplined block counts (3-6 blocks per slide)
    - Charts and data visualizations only when they genuinely improve understanding ${includeCharts ? 'and reliable data is available' : ''}
    - Cohesive, professional design with measured contrast
    - Optional expressive elements used sparingly ${includeEmojis ? 'for creative tones only' : ''}

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
1. A clear headline and supporting structure
2. Concise paragraphs or lists, not text walls
3. One strong proof point or callout when appropriate
4. Charts only where data adds meaning
5. Suggested imagery only where it improves the slide

Use restrained color contrast and consistent hierarchy.

Return JSON structure:
{
  "title": "Presentation title",
  "sections": [
    {
      "heading": "Slide heading",
      "layout": "title-content",
      "blocks": [
        {"type": "subheading", "content": "..."},
        {"type": "paragraph", "content": "..."},
        {"type": "bullet", "content": "..."},
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
  /**
   * Get statistics on AI generation by provider and model
   */
  async getLLMGenerationStats(): Promise<LLMGenerationStat[]> {
    const generations = await this.prisma.aIGeneration.groupBy({
      by: ['model'],
      _count: {
        _all: true,
      },
      _sum: {
        tokens: true,
      },
    });

    return generations.map((g) => ({
      providerModel: g.model,
      count: g._count._all,
      totalTokens: g._sum.tokens || 0,
    }));
  }
}
