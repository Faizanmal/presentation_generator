import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  ImageAcquisitionService,
  ImageAcquisitionOptions,
  AcquiredImage,
} from './image-acquisition.service';
import { PrismaService } from '../prisma/prisma.service';

export interface AcquireImageJobData {
  projectId: string;
  slideId?: string;
  userId: string;
  options: ImageAcquisitionOptions;
  autoAdd?: boolean; // Automatically add to slide
}

export interface BulkAcquireJobData {
  projectId: string;
  userId: string;
  topic: string;
  count: number;
  autoCreateSlides?: boolean;
}

@Processor('image-acquisition', {
  concurrency: 3, // Process 3 image acquisitions concurrently
})
export class ImageAcquisitionProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageAcquisitionProcessor.name);

  constructor(
    private readonly imageAcquisitionService: ImageAcquisitionService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(
    job: Job<AcquireImageJobData | BulkAcquireJobData>,
  ): Promise<unknown> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    switch (job.name) {
      case 'acquire-single':
        return this.processSingleAcquisition(job as Job<AcquireImageJobData>);
      case 'acquire-bulk':
        return this.processBulkAcquisition(job as Job<BulkAcquireJobData>);
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  /**
   * Process single image acquisition
   */
  private async processSingleAcquisition(
    job: Job<AcquireImageJobData>,
  ): Promise<AcquiredImage> {
    const { projectId, slideId, userId, options, autoAdd } = job.data;

    try {
      // Update progress
      await job.updateProgress(10);

      // Acquire the image
      const image = await this.imageAcquisitionService.acquireImage(options);
      await job.updateProgress(70);

      // Save to database
      const savedImage = await this.saveImageToDatabase(
        image,
        projectId,
        userId,
      );
      await job.updateProgress(90);

      // Optionally add to slide
      if (autoAdd && slideId) {
        await this.addImageToSlide(savedImage.id, slideId);
      }

      await job.updateProgress(100);

      this.logger.log(
        `Successfully acquired image ${savedImage.id} for project ${projectId}`,
      );
      return image;
    } catch (error) {
      this.logger.error(
        `Failed to acquire image for project ${projectId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Process bulk image acquisition
   */
  private async processBulkAcquisition(
    job: Job<BulkAcquireJobData>,
  ): Promise<AcquiredImage[]> {
    const { projectId, userId, topic, count, autoCreateSlides } = job.data;

    try {
      await job.updateProgress(10);

      // Acquire multiple images
      const images = await this.imageAcquisitionService.acquireForTopic(
        topic,
        count,
      );
      await job.updateProgress(60);

      // Save all images to database
      const savedImages: { id: string }[] = [];
      for (let i = 0; i < images.length; i++) {
        const savedImage = await this.saveImageToDatabase(
          images[i],
          projectId,
          userId,
        );
        savedImages.push(savedImage);

        // Optionally create slides
        if (autoCreateSlides) {
          await this.createSlideWithImage(
            projectId,
            savedImage.id,
            images[i].description || '',
          );
        }

        await job.updateProgress(60 + (40 * (i + 1)) / images.length);
      }

      this.logger.log(
        `Successfully acquired ${savedImages.length} images for project ${projectId}`,
      );
      return images;
    } catch (error) {
      this.logger.error(
        `Failed bulk acquisition for project ${projectId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Save acquired image to database
   */
  private async saveImageToDatabase(
    image: AcquiredImage,
    projectId: string,
    userId: string,
  ) {
    return this.prisma.upload.create({
      data: {
        filename: image.localPath.split('/').pop() || 'unknown',
        source: image.source,
        mimeType: 'image/jpeg',
        size: 0, // Will be updated by file size check
        url: image.localPath,
        userId,
        projectId,
        metadata: {
          originalName: `${image.source}-${image.id}`,
          source: image.source,
          sourceUrl: image.url,
          width: image.width,
          height: image.height,
          description: image.description,
          author: image.author,
          authorUrl: image.authorUrl,
          license: image.license,
          downloadedAt: image.downloadedAt,
          ...image.metadata,
        },
      },
    });
  }

  /**
   * Add image to existing slide
   */
  private async addImageToSlide(uploadId: string, slideId: string) {
    // Find the slide
    const slide = await this.prisma.slide.findUnique({
      where: { id: slideId },
      include: { blocks: true },
    });

    if (!slide) {
      throw new Error(`Slide ${slideId} not found`);
    }

    // Create an image block
    await this.prisma.block.create({
      data: {
        blockType: 'IMAGE',
        content: {
          uploadId,
          alt: 'Acquired image',
        },
        style: {
          position: 'relative',
          width: '100%',
          height: 'auto',
        },
        order: slide.blocks.length,
        slideId,
        projectId: slide.projectId,
      } as any,
    });
  }

  /**
   * Create new slide with image
   */
  private async createSlideWithImage(
    projectId: string,
    uploadId: string,
    description: string,
  ) {
    // Get project to determine slide order
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { slides: true },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Create slide
    const slide = await this.prisma.slide.create({
      data: {
        title: description || 'Acquired Image',
        order: project.slides.length,
        projectId,
        layout: 'image-focus',
      },
    } as any);

    // Add image block to slide
    await this.addImageToSlide(uploadId, slide.id);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed:`, error);
  }
}
