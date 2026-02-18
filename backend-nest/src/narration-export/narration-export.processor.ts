import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NarrationExportService } from './narration-export.service';

@Processor('narration', { concurrency: 2 })
export class NarrationExportProcessor extends WorkerHost {
  private readonly logger = new Logger(NarrationExportProcessor.name);

  constructor(private readonly narrationService: NarrationExportService) {
    super();
  }

  async process(
    job: Job<{
      narrationProjectId: string;
      slides: Array<{ id: string; blocks?: { content: unknown }[] }>;
      voice: string;
      speed: number;
    }>,
  ) {
    const { narrationProjectId, slides, voice, speed } = job.data;
    this.logger.log(
      `Processing narration job ${job.id} (project=${narrationProjectId})`,
    );

    await this.narrationService.processNarration(
      narrationProjectId,
      slides,
      voice as any,
      speed,
    );

    return { success: true };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Narration job ${job?.id} failed: ${error?.message}`);
  }
}
