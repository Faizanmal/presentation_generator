import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * AI Cost Optimizer Service
 * Handles cost tracking, model selection, and cost-based optimizations
 */

export interface CostMetrics {
  provider: string;
  model: string;
  tokens: number;
  estimatedCost: number;
  timestamp: Date;
  userId?: string;
  operation: string;
}

export interface ModelCostConfig {
  provider: string;
  model: string;
  costPerToken: number;
  speed: 'fast' | 'medium' | 'slow';
  quality: 'low' | 'medium' | 'high';
}

@Injectable()
export class AICostOptimizerService {
  private readonly logger = new Logger(AICostOptimizerService.name);

  /** Track costs per user */
  private dailyCosts = new Map<string, number>();
  private monthlyCosts = new Map<string, number>();

  /** Request deduplication cache */
  private readonly requestDedup = new Map<string, Promise<any>>();
  private readonly dedupTimestamps = new Map<string, number>();

  /** Model cost configurations */
  private readonly modelCosts: ModelCostConfig[] = [
    // Ollama - Completely Free
    {
      provider: 'ollama',
      model: 'llama2',
      costPerToken: 0,
      speed: 'medium',
      quality: 'medium',
    },
    {
      provider: 'ollama',
      model: 'llama3',
      costPerToken: 0,
      speed: 'medium',
      quality: 'high',
    },

    // Groq - Very cheap and fast
    {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      costPerToken: 0.000001,
      speed: 'fast',
      quality: 'high',
    },
    {
      provider: 'groq',
      model: 'mixtral-8x7b-32768',
      costPerToken: 0.0000005,
      speed: 'fast',
      quality: 'medium',
    },

    // Google AI - Balanced
    {
      provider: 'google',
      model: 'gemini-pro',
      costPerToken: 0.000002,
      speed: 'medium',
      quality: 'high',
    },
    {
      provider: 'google',
      model: 'gemini-1.5-flash',
      costPerToken: 0.0000005,
      speed: 'fast',
      quality: 'medium',
    },

    // OpenAI - Expensive but high quality
    {
      provider: 'openai',
      model: 'gpt-4o-mini',
      costPerToken: 0.00001,
      speed: 'medium',
      quality: 'high',
    },
    {
      provider: 'openai',
      model: 'gpt-4o',
      costPerToken: 0.00003,
      speed: 'slow',
      quality: 'high',
    },
    {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      costPerToken: 0.000002,
      speed: 'fast',
      quality: 'medium',
    },
  ];

  constructor(private readonly configService: ConfigService) {
    // Start cleanup interval for deduplication cache
    setInterval(() => this.cleanupDedupCache(), 60000); // Every minute

    // Reset daily costs at midnight
    this.scheduleDailyCostReset();
  }

  /**
   * Select the most cost-effective model based on user tier and operation
   */
  selectModelByCost(
    userTier: 'free' | 'pro' | 'enterprise',
    operation: 'generation' | 'enhancement' | 'analysis' | 'chat' | 'image',
  ): { provider: string; model: string; costPerToken: number } {
    const strategy = this.configService.get<string>(
      'AI_MODEL_SELECTION_STRATEGY',
      'cost-optimized',
    );

    // Get tier-specific model override
    const tierModelOverride = this.getTierModelOverride(userTier);
    if (tierModelOverride) {
      return tierModelOverride;
    }

    // Select based on strategy
    switch (strategy) {
      case 'cost-optimized':
        return this.selectCostOptimizedModel(userTier, operation);
      case 'quality-optimized':
        return this.selectQualityOptimizedModel(operation);
      case 'balanced':
        return this.selectBalancedModel(userTier, operation);
      default:
        return this.selectCostOptimizedModel(userTier, operation);
    }
  }

  /**
   * Cost-optimized model selection (prefer free/cheap)
   */
  private selectCostOptimizedModel(
    userTier: 'free' | 'pro' | 'enterprise',
    operation: string,
  ): ModelCostConfig {
    // Free tier always uses Ollama (free)
    if (userTier === 'free') {
      return this.modelCosts.find(
        (m) => m.provider === 'ollama' && m.model === 'llama2',
      )!;
    }

    // Pro tier prefers Groq (cheap and fast)
    if (userTier === 'pro') {
      // For complex operations, use better Groq model
      if (operation === 'generation' || operation === 'analysis') {
        return this.modelCosts.find(
          (m) => m.provider === 'groq' && m.model === 'llama-3.3-70b-versatile',
        )!;
      }
      // For simple operations, use cheaper Groq model
      return this.modelCosts.find(
        (m) => m.provider === 'groq' && m.model === 'mixtral-8x7b-32768',
      )!;
    }

    // Enterprise can use OpenAI but prefer cheaper models for simple tasks
    if (operation === 'chat' || operation === 'enhancement') {
      return this.modelCosts.find(
        (m) => m.provider === 'openai' && m.model === 'gpt-4o-mini',
      )!;
    }

    return this.modelCosts.find(
      (m) => m.provider === 'openai' && m.model === 'gpt-4o',
    )!;
  }

  /**
   * Quality-optimized model selection (prefer best quality)
   */
  private selectQualityOptimizedModel(_operation: string): ModelCostConfig {
    // Always use highest quality
    return this.modelCosts.find(
      (m) => m.provider === 'openai' && m.model === 'gpt-4o',
    )!;
  }

  /**
   * Balanced model selection
   */
  private selectBalancedModel(
    userTier: 'free' | 'pro' | 'enterprise',
    operation: string,
  ): ModelCostConfig {
    if (userTier === 'free') {
      // Free: use Ollama
      return this.modelCosts.find(
        (m) => m.provider === 'ollama' && m.model === 'llama2',
      )!;
    }

    if (userTier === 'pro') {
      // Pro: use Google AI (good balance)
      return this.modelCosts.find(
        (m) => m.provider === 'google' && m.model === 'gemini-pro',
      )!;
    }

    // Enterprise: use OpenAI but choose model by operation complexity
    if (operation === 'generation' || operation === 'analysis') {
      return this.modelCosts.find(
        (m) => m.provider === 'openai' && m.model === 'gpt-4o',
      )!;
    }

    return this.modelCosts.find(
      (m) => m.provider === 'openai' && m.model === 'gpt-4o-mini',
    )!;
  }

  /**
   * Get tier-specific model override from config
   */
  private getTierModelOverride(userTier: string): ModelCostConfig | null {
    const configKey = `${userTier.toUpperCase()}_TIER_MODEL`;
    const modelName = this.configService.get<string>(configKey);

    if (!modelName) return null;

    return this.modelCosts.find((m) => m.model === modelName) || null;
  }

  /**
   * Track AI cost for a request
   */
  trackCost(metrics: CostMetrics): void {
    const { userId, estimatedCost, provider, model, operation } = metrics;

    // Log cost
    if (this.configService.get<boolean>('COST_MONITORING_ENABLED', true)) {
      this.logger.log(
        `AI Cost: ${provider}/${model} - ${operation} - ${metrics.tokens} tokens - $${estimatedCost.toFixed(4)}`,
      );
    }

    // Update user costs
    if (userId) {
      const dailyKey = `${userId}-${this.getDayKey()}`;
      const monthlyKey = `${userId}-${this.getMonthKey()}`;

      this.dailyCosts.set(
        dailyKey,
        (this.dailyCosts.get(dailyKey) || 0) + estimatedCost,
      );
      this.monthlyCosts.set(
        monthlyKey,
        (this.monthlyCosts.get(monthlyKey) || 0) + estimatedCost,
      );

      // Check if user exceeded limits
      this.checkCostLimits(userId, dailyKey, monthlyKey, estimatedCost);
    }

    // Alert on high-cost requests
    const threshold = this.configService.get<number>(
      'AI_COST_ALERT_THRESHOLD',
      0.1,
    );
    if (estimatedCost > threshold) {
      this.alertHighCost(provider, model, operation, estimatedCost);
    }
  }

  /**
   * Calculate estimated cost for a request
   */
  calculateCost(provider: string, model: string, tokens: number): number {
    const modelConfig = this.modelCosts.find(
      (m) => m.provider === provider && m.model === model,
    );

    if (!modelConfig) {
      this.logger.warn(
        `Unknown model cost for ${provider}/${model}, estimating $0.00001/token`,
      );
      return tokens * 0.00001;
    }

    return tokens * modelConfig.costPerToken;
  }

  /**
   * Check if user can afford the operation
   */
  canAffordOperation(
    userId: string,
    estimatedTokens: number,
    provider: string,
    model: string,
  ): boolean {
    const estimatedCost = this.calculateCost(provider, model, estimatedTokens);

    const dailyKey = `${userId}-${this.getDayKey()}`;
    const monthlyKey = `${userId}-${this.getMonthKey()}`;

    const dailySpent = this.dailyCosts.get(dailyKey) || 0;
    const monthlySpent = this.monthlyCosts.get(monthlyKey) || 0;

    const dailyLimit = this.configService.get<number>(
      'MAX_COST_PER_USER_PER_DAY',
      1.0,
    );
    const monthlyLimit = this.configService.get<number>(
      'MAX_COST_PER_USER_PER_MONTH',
      10.0,
    );

    return (
      dailySpent + estimatedCost <= dailyLimit &&
      monthlySpent + estimatedCost <= monthlyLimit
    );
  }

  /**
   * Get user's current cost usage
   */
  getUserCostUsage(userId: string): {
    daily: number;
    monthly: number;
    dailyLimit: number;
    monthlyLimit: number;
  } {
    const dailyKey = `${userId}-${this.getDayKey()}`;
    const monthlyKey = `${userId}-${this.getMonthKey()}`;

    return {
      daily: this.dailyCosts.get(dailyKey) || 0,
      monthly: this.monthlyCosts.get(monthlyKey) || 0,
      dailyLimit: this.configService.get<number>(
        'MAX_COST_PER_USER_PER_DAY',
        1.0,
      ),
      monthlyLimit: this.configService.get<number>(
        'MAX_COST_PER_USER_PER_MONTH',
        10.0,
      ),
    };
  }

  /**
   * Deduplicate concurrent identical requests
   */
  async dedupedRequest<T>(
    key: string,
    requestFn: () => Promise<T>,
  ): Promise<T> {
    if (!this.configService.get<boolean>('AI_REQUEST_DEDUP_ENABLED', true)) {
      return requestFn();
    }

    // Check if identical request is in flight
    if (this.requestDedup.has(key)) {
      this.logger.log(`Deduplicating request: ${key}`);
      return this.requestDedup.get(key)!;
    }

    // Execute and cache the promise
    const promise = requestFn().finally(() => {
      // Keep in cache for TTL period for potential future duplicates
      const ttl =
        this.configService.get<number>('AI_REQUEST_DEDUP_TTL', 300) * 1000;
      setTimeout(() => {
        this.requestDedup.delete(key);
        this.dedupTimestamps.delete(key);
      }, ttl);
    });

    this.requestDedup.set(key, promise);
    this.dedupTimestamps.set(key, Date.now());

    return promise;
  }

  /**
   * Check if user can use an expensive feature
   */
  canUseExpensiveFeature(
    userTier: 'free' | 'pro' | 'enterprise',
    feature: 'dall-e' | 'tts-hd' | 'advanced-analysis' | 'video-export',
  ): boolean {
    const restrictions: Record<string, string[]> = {
      free: ['dall-e', 'tts-hd', 'advanced-analysis', 'video-export'],
      pro: ['tts-hd', 'video-export'],
      enterprise: [], // No restrictions
    };

    return !restrictions[userTier]?.includes(feature);
  }

  /**
   * Cleanup deduplication cache
   */
  private cleanupDedupCache(): void {
    const ttl =
      this.configService.get<number>('AI_REQUEST_DEDUP_TTL', 300) * 1000;
    const now = Date.now();

    for (const [key, timestamp] of this.dedupTimestamps.entries()) {
      if (now - timestamp > ttl) {
        this.requestDedup.delete(key);
        this.dedupTimestamps.delete(key);
      }
    }
  }

  /**
   * Check cost limits and alert if exceeded
   */
  private checkCostLimits(
    userId: string,
    dailyKey: string,
    monthlyKey: string,
    _newCost: number,
  ): void {
    const dailySpent = this.dailyCosts.get(dailyKey) || 0;
    const monthlySpent = this.monthlyCosts.get(monthlyKey) || 0;

    const dailyLimit = this.configService.get<number>(
      'MAX_COST_PER_USER_PER_DAY',
      1.0,
    );
    const monthlyLimit = this.configService.get<number>(
      'MAX_COST_PER_USER_PER_MONTH',
      10.0,
    );

    if (dailySpent > dailyLimit * 0.9) {
      this.logger.warn(
        `User ${userId} approaching daily cost limit: $${dailySpent.toFixed(2)}/$${dailyLimit}`,
      );
    }

    if (monthlySpent > monthlyLimit * 0.9) {
      this.logger.warn(
        `User ${userId} approaching monthly cost limit: $${monthlySpent.toFixed(2)}/$${monthlyLimit}`,
      );
    }
  }

  /**
   * Alert on high-cost request
   */
  private alertHighCost(
    provider: string,
    model: string,
    operation: string,
    cost: number,
  ): void {
    this.logger.warn(
      `⚠️ HIGH COST ALERT: ${provider}/${model} - ${operation} - $${cost.toFixed(4)}`,
    );

    // TODO: Send email alert if configured
    const alertEmail = this.configService.get<string>('COST_ALERT_EMAIL');
    if (alertEmail) {
      // Implementation for sending alert email
    }
  }

  /**
   * Get day key for daily tracking
   */
  private getDayKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }

  /**
   * Get month key for monthly tracking
   */
  private getMonthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}`;
  }

  /**
   * Schedule daily cost reset at midnight
   */
  private scheduleDailyCostReset(): void {
    const now = new Date();
    const tomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      this.resetDailyCosts();
      // Reschedule for next day
      setInterval(() => this.resetDailyCosts(), 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  /**
   * Reset daily costs
   */
  private resetDailyCosts(): void {
    const today = this.getDayKey();
    for (const [key] of this.dailyCosts.entries()) {
      if (!key.endsWith(today)) {
        this.dailyCosts.delete(key);
      }
    }
    this.logger.log('Daily AI costs reset');
  }
}
