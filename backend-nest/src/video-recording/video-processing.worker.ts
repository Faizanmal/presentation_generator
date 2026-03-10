import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  VideoRecordingService,
  VideoExportOptions,
} from './video-recording.service';
import { PrismaService } from '../prisma/prisma.service';

interface ProcessRecordingJob {
  sessionId: string;
  userId: string;
  exportOptions: VideoExportOptions;
}

interface ExportPresentationJob {
  jobId: string;
  projectId: string;
  userId: string;
  options: VideoExportOptions;
  slideTimings?: number[];
  narrationAudioUrl?: string;
}

@Processor('video-processing')
export class VideoProcessingWorker extends WorkerHost {
  private readonly logger = new Logger(VideoProcessingWorker.name);

  constructor(
    private readonly videoRecordingService: VideoRecordingService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(
    job: Job<ProcessRecordingJob | ExportPresentationJob>,
  ): Promise<string> {
    this.logger.log(`Processing job ${job.id}: ${job.name}`);

    try {
      switch (job.name) {
        case 'process-recording':
          return await this.processRecording(job.data as ProcessRecordingJob);
        case 'export-presentation':
          return await this.exportPresentation(
            job.data as ExportPresentationJob,
          );
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Job ${job.id} failed:`, error);
      throw error;
    }
  }

  private async processRecording(data: ProcessRecordingJob): Promise<string> {
    const { sessionId, exportOptions } = data;

    this.logger.log(`Processing recording: ${sessionId}`);

    // Process the recorded chunks into final video
    const videoUrl = await this.videoRecordingService.processRecording(
      sessionId,
      exportOptions,
    );

    // Notify user (via email or WebSocket)
    // TODO: Implement notification

    return videoUrl;
  }

  private async exportPresentation(
    data: ExportPresentationJob,
  ): Promise<string> {
    const { jobId, projectId, options, slideTimings } = data;

    this.logger.log(`Exporting presentation: ${projectId}`);

    // Update job status
    await this.prisma.videoExportJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', startedAt: new Date() },
    });

    try {
      // Get project slides
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          slides: {
            orderBy: { order: 'asc' },
            include: { blocks: true },
          },
        },
      });

      if (!project) {
        throw new Error('Project not found');
      }

      // Calculate durations
      const defaultDuration = 5; // 5 seconds per slide
      const durations =
        slideTimings || project.slides.map(() => defaultDuration);
      const totalDuration = durations.reduce((sum, d) => sum + d, 0);

      // Here we would:
      // 1. Render each slide to images/video frames
      // 2. Concatenate with transitions
      // 3. Add narration audio if provided
      // 4. Add background music if requested
      // 5. Add intro/outro if requested
      // 6. Export to final format

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Generate output URL
      const outputUrl = `https://storage.example.com/videos/${projectId}/export_${Date.now()}.${options.format}`;

      // Update job as completed
      await this.prisma.videoExportJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          outputUrl,
          duration: totalDuration,
        },
      });

      return outputUrl;
    } catch (error) {
      // Update job as failed
      await this.prisma.videoExportJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          error: error.message,
        },
      });

      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number) {
    this.logger.log(`Job ${job.id} progress: ${progress}%`);
  }
}
