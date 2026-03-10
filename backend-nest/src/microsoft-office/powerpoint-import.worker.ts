import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  MicrosoftOfficeService,
  ImportOptions,
} from './microsoft-office.service';
import { PrismaService } from '../prisma/prisma.service';
import { BlockType } from '@prisma/client';

interface ImportPptxJob {
  jobId: string;
  userId: string;
  s3Key: string;
  options: ImportOptions;
}

@Processor('powerpoint-processing')
export class PowerPointImportWorker extends WorkerHost {
  private readonly logger = new Logger(PowerPointImportWorker.name);

  constructor(
    private readonly microsoftOfficeService: MicrosoftOfficeService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<ImportPptxJob>): Promise<string> {
    this.logger.log(`Processing job ${job.id}: ${job.name}`);

    try {
      switch (job.name) {
        case 'import-pptx':
          return await this.importPowerPoint(job.data);
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Job ${job.id} failed:`, error);
      throw error;
    }
  }

  private async importPowerPoint(data: ImportPptxJob): Promise<string> {
    const { jobId, userId, s3Key, options } = data;

    this.logger.log(`Importing PowerPoint: ${jobId}`);

    // Update job status
    await this.prisma.powerPointImportJob.update({
      where: { id: jobId },
      data: { status: 'processing', startedAt: new Date() },
    });

    try {
      // Parse the PowerPoint file
      const slides = await this.microsoftOfficeService.parsePowerPointFile(
        s3Key,
        options,
      );

      // Create a new project with the imported slides
      const importJob = await this.prisma.powerPointImportJob.findUnique({
        where: { id: jobId },
      });

      const projectTitle = importJob?.fileName
        ? importJob.fileName.replace(/\.(pptx?|PPTX?)$/, '')
        : 'Imported Presentation';

      const project = await this.prisma.project.create({
        data: {
          title: projectTitle,
          description: `Imported from ${importJob?.fileName || 'PowerPoint'}`,
          ownerId: userId,
          metadata: { importSource: 'powerpoint' },
        },
      });

      // Create slides
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];

        const createdSlide = await this.prisma.slide.create({
          data: {
            projectId: project.id,
            title: slide.title || `Slide ${i + 1}`,
            order: i,
            layout: slide.layout || 'default',
            speakerNotes: options.extractNotes ? slide.notes : undefined,
          },
        });

        // Create blocks for slide content
        for (let j = 0; j < slide.content.length; j++) {
          const content = slide.content[j];

          await this.prisma.block.create({
            data: {
              slideId: createdSlide.id,
              projectId: project.id,
              blockType: this.mapContentTypeToBlockType(content.type),
              content: content.data as object,
              order: j,
              style: content.style as object,
            },
          });
        }
      }

      // Update job as completed
      await this.prisma.powerPointImportJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          projectId: project.id,
          slideCount: slides.length,
        },
      });

      this.logger.log(`PowerPoint import completed: ${project.id}`);

      return project.id;
    } catch (error) {
      // Update job as failed
      await this.prisma.powerPointImportJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          error: error.message,
        },
      });

      throw error;
    }
  }

  private mapContentTypeToBlockType(type: string): BlockType {
    const typeMap: Record<string, BlockType> = {
      text: 'PARAGRAPH' as BlockType,
      image: 'IMAGE' as BlockType,
      shape: 'SHAPE' as BlockType,
      table: 'TABLE' as BlockType,
      chart: 'CHART' as BlockType,
    };
    return typeMap[type] || ('PARAGRAPH' as BlockType);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}
