/**
 * Base Agent — Abstract class for all AI agents in the pipeline.
 * Provides: prompt execution, retry logic, structured output parsing, token tracking.
 */
import { Logger } from '@nestjs/common';
import { AIService } from '../ai.service';

export interface AgentResult<T> {
  data: T;
  tokensUsed: number;
  durationMs: number;
  retries: number;
  model: string;
  provider: string;
}

export abstract class BaseAgent<TInput, TOutput> {
  protected abstract readonly agentName: string;
  protected abstract readonly systemPrompt: string;
  protected readonly logger: Logger;

  constructor(protected readonly aiService: AIService) {
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * Build the user prompt from input. Subclasses implement this.
   */
  protected abstract buildPrompt(input: TInput): string;

  /**
   * Validate and parse the raw AI response into the expected output type.
   */
  protected abstract parseOutput(raw: string, input: TInput): TOutput;

  /**
   * Execute the agent with retry and structured output parsing.
   */
  async execute(input: TInput, maxRetries = 2): Promise<AgentResult<TOutput>> {
    const startTime = Date.now();
    let retries = 0;
    let lastError: Error | null = null;

    while (retries <= maxRetries) {
      try {
        const userPrompt = this.buildPrompt(input);

        this.logger.log(
          `🤖 [${this.agentName}] Executing (attempt ${retries + 1}/${maxRetries + 1})`,
        );

        const response = await this.aiService.chatCompletion({
          messages: [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content || '';
        const tokensUsed = response.usage?.total_tokens || 0;

        const parsed = this.parseOutput(content, input);

        this.logger.log(
          `✅ [${this.agentName}] Complete — ${tokensUsed} tokens, ${Date.now() - startTime}ms`,
        );

        return {
          data: parsed,
          tokensUsed,
          durationMs: Date.now() - startTime,
          retries,
          model: response.model,
          provider: (response as { provider?: string }).provider || 'unknown',
        };
      } catch (error) {
        lastError = error as Error;
        retries++;
        this.logger.warn(
          `⚠️ [${this.agentName}] Attempt ${retries} failed: ${lastError.message}`,
        );
        if (retries <= maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * retries));
        }
      }
    }

    throw new Error(
      `[${this.agentName}] Failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Safely parse JSON from AI response, handling markdown code blocks.
   */
  protected safeJsonParse<T>(raw: string): T {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    return JSON.parse(cleaned) as T;
  }
}
