import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { AIService } from '../ai.service';

export interface ImageGenerationJobData {
  blockId: string;
  projectId: string; // For context/auth if needed later
  prompt: string;
  style: string;
}

@Processor('image-generation', {
  concurrency: Number.parseInt(
    process.env.IMAGE_GENERATION_CONCURRENCY || '3',
    10,
  ),
})
export class ImageGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageGenerationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {
    super();
  }

  async process(job: Job<ImageGenerationJobData>) {
    const { blockId, prompt, style } = job.data;
    this.logger.log(`Processing image generation for block ${blockId}`);

    try {
      // 1. Generate Image
      const result = await this.aiService.generateImage(prompt, style as any);

      // 2. Update Block
      await this.prisma.block.update({
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
      // Mark block as failed
      await this.prisma.block.update({
        where: { id: blockId },
        data: {
          content: {
            status: 'failed',
            error: error.message,
          },
        },
      });
      throw error;
    }
  }
}
