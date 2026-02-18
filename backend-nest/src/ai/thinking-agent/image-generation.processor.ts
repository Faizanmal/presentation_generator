import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { AIService } from '../ai.service';

export interface ImageGenerationJobData {
  blockId: string;
  projectId: string; // For context/auth if needed later
  prompt: string;
  style: 'vivid' | 'natural';
}

@Processor('image-generation', {
  concurrency: Number.parseInt(
    process.env.IMAGE_GENERATION_CONCURRENCY || '3',
    10,
  ),
})
export class ImageGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageGenerationProcessor.name);
  private readonly db: PrismaClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {
    super();
    this.db = this.prisma as unknown as PrismaClient;
  }

  async process(job: Job<ImageGenerationJobData>) {
    const { blockId, prompt, style } = job.data;
    this.logger.log(`Processing image generation for block ${blockId}`);

    try {
      // 1. Generate Image
      const result = await this.aiService.generateImage(prompt, style);

      // 2. Update Block
      await this.db.block.update({
        where: { id: blockId },
        data: {
          content: {
            url: result.imageUrl,
            alt: result.revisedPrompt,
            status: 'completed',
          },
        },
      });

      this.logger.log(`Image generated and block ${blockId} updated`);
    } catch (error) {
      this.logger.error(`Failed to generate image for block ${blockId}`, error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      // Mark block as failed
      await this.db.block.update({
        where: { id: blockId },
        data: {
          content: {
            status: 'failed',
            error: errorMessage,
          },
        },
      });
      throw error;
    }
  }
}
