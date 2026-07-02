/**
 * Generation Queue Processor
 *
 * BullMQ worker that processes presentation generation jobs asynchronously.
 * Enables background generation with progress tracking via Redis.
 */
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GenerationPipelineService } from '../agents/generation-pipeline.service';
import type { GenerationRequest } from '@shared/presentation-dsl';

export const GENERATION_QUEUE = 'presentation-generation';

export interface GenerationJobData {
  request: GenerationRequest;
  userId: string;
  projectId?: string;
}

export interface GenerationJobResult {
  documentId: string;
  qualityScore: number;
  totalSlides: number;
  totalDurationMs: number;
}

@Processor(GENERATION_QUEUE, {
  concurrency: 2,
  limiter: { max: 5, duration: 60000 }, // Max 5 jobs per minute
})
export class GenerationQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationQueueProcessor.name);

  constructor(private readonly pipeline: GenerationPipelineService) {
    super();
  }

  async process(job: Job<GenerationJobData>): Promise<GenerationJobResult> {
    const { request, userId } = job.data;

    this.logger.log(
      `📋 Processing generation job ${job.id} for user ${userId}: "${request.topic}"`,
    );

    try {
      await job.updateProgress(5);

      const result = await this.pipeline.generate(request);

      await job.updateProgress(100);

      this.logger.log(
        `✅ Job ${job.id} complete — ${result.document.metadata.totalSlides} slides, quality: ${result.qa.overallScore}`,
      );

      return {
        documentId: result.document.id,
        qualityScore: result.qa.overallScore,
        totalSlides: result.document.metadata.totalSlides,
        totalDurationMs: result.totalDurationMs,
      };
    } catch (error) {
      this.logger.error(`❌ Job ${job.id} failed: ${(error as Error).message}`);
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<GenerationJobData>) {
    this.logger.log(`✅ Generation job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<GenerationJobData>, error: Error) {
    this.logger.error(`❌ Generation job ${job?.id} failed: ${error.message}`);
  }
}
