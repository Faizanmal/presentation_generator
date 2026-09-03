import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AIService } from './ai.service';
import { GenerateProjectDto } from '../projects/dto/generate-project.dto';
import { ProjectsService } from '../projects/projects.service';
import { ConcurrencyConfig } from '../common/config/concurrency.config';

@Processor('generation', {
  concurrency: ConcurrencyConfig.aiGeneration.concurrency,
  limiter: ConcurrencyConfig.aiGeneration.limiter,
})
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);

  constructor(
    private readonly aiService: AIService,
    private readonly projectsService: ProjectsService,
  ) {
    super();
  }

  async process(job: Job<{ userId: string; dto: GenerateProjectDto }>) {
    this.logger.log(
      `Processing generation job ${job.id} for user ${job.data.userId}`,
    );

    try {
      const { userId, dto } = job.data;

      // Call the original logic (refactored to be callable directly)
      const project = await this.projectsService.processGeneration(userId, dto);

      this.logger.log(`Generation job ${job.id} completed successfully`);
      return project;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Generation job ${job.id} failed: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Generation job ${job.id} failed: Unknown error`);
      }
      throw error;
    }
  }
}
