import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AIService } from './ai.service';
import { GenerateProjectDto } from '../projects/dto/generate-project.dto';
import { ProjectsService } from '../projects/projects.service';

@Processor('generation')
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
      // Since ProjectsService.generate was synchronous before, we need to extract the core logic
      // Ideally, we move the core generation logic to AIService or a separate helper
      // For now, I'll update ProjectsService to expose a method 'processGeneration'

      await this.projectsService.processGeneration(userId, dto);

      this.logger.log(`Generation job ${job.id} completed successfully`);
      return { success: true };
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
