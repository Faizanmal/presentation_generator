import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ImageAcquisitionService,
  ImageSource,
  ImageAcquisitionOptions,
} from './image-acquisition.service';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import {
  AcquireImageJobData,
  BulkAcquireJobData,
} from './image-acquisition.processor';

class AcquireImageDto {
  source: ImageSource;
  query?: string;
  prompt?: string;
  url?: string;
  orientation?: 'landscape' | 'portrait' | 'square';
  color?: string;
  projectId: string;
  slideId?: string;
  autoAdd?: boolean;
}

class BulkAcquireDto {
  topic: string;
  count: number;
  projectId: string;
  autoCreateSlides?: boolean;
}

class SmartAcquireDto {
  query: string;
  projectId: string;
  slideId?: string;
  orientation?: 'landscape' | 'portrait' | 'square';
  autoAdd?: boolean;
}

@Controller('image-acquisition')
@UseGuards(JwtAuthGuard)
export class ImageAcquisitionController {
  private readonly logger = new Logger(ImageAcquisitionController.name);

  constructor(
    private readonly imageAcquisitionService: ImageAcquisitionService,
    @InjectQueue('image-acquisition') private readonly imageQueue: Queue,
  ) {}

  /**
   * Acquire single image (synchronous)
   */
  @Post('acquire')
  async acquireImage(@Request() req, @Body() dto: AcquireImageDto) {
    this.logger.log(
      `User ${req.user.userId} requesting image from ${dto.source}`,
    );

    try {
      const options: ImageAcquisitionOptions = {
        source: dto.source,
        query: dto.query,
        prompt: dto.prompt,
        url: dto.url,
        orientation: dto.orientation,
        color: dto.color,
      };

      const image = await this.imageAcquisitionService.acquireImage(options);

      return {
        success: true,
        image,
        message: 'Image acquired successfully',
      };
    } catch (error) {
      this.logger.error('Image acquisition failed:', error);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Acquire single image (asynchronous with job queue)
   */
  @Post('acquire-async')
  async acquireImageAsync(@Request() req, @Body() dto: AcquireImageDto) {
    this.logger.log(
      `User ${req.user.userId} queuing image acquisition from ${dto.source}`,
    );

    try {
      const jobData: AcquireImageJobData = {
        projectId: dto.projectId,
        slideId: dto.slideId,
        userId: req.user.userId,
        options: {
          source: dto.source,
          query: dto.query,
          prompt: dto.prompt,
          url: dto.url,
          orientation: dto.orientation,
          color: dto.color,
        },
        autoAdd: dto.autoAdd,
      };

      const job = await this.imageQueue.add('acquire-single', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      return {
        success: true,
        jobId: job.id,
        message: 'Image acquisition queued',
      };
    } catch (error) {
      this.logger.error('Failed to queue image acquisition:', error);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Smart acquire - tries multiple sources automatically
   */
  @Post('smart-acquire')
  async smartAcquire(@Request() req, @Body() dto: SmartAcquireDto) {
    this.logger.log(
      `User ${req.user.userId} requesting smart acquisition for: ${dto.query}`,
    );

    try {
      const image = await this.imageAcquisitionService.smartAcquire(dto.query, {
        orientation: dto.orientation,
      });

      return {
        success: true,
        image,
        message: 'Image acquired successfully',
      };
    } catch (error) {
      this.logger.error('Smart acquisition failed:', error);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Bulk acquire images for a topic
   */
  @Post('bulk-acquire')
  async bulkAcquire(@Request() req, @Body() dto: BulkAcquireDto) {
    this.logger.log(
      `User ${req.user.userId} requesting bulk acquisition: ${dto.count} images for "${dto.topic}"`,
    );

    if (dto.count > 20) {
      throw new BadRequestException('Maximum 20 images per request');
    }

    try {
      const jobData: BulkAcquireJobData = {
        projectId: dto.projectId,
        userId: req.user.userId,
        topic: dto.topic,
        count: dto.count,
        autoCreateSlides: dto.autoCreateSlides,
      };

      const job = await this.imageQueue.add('acquire-bulk', jobData, {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      });

      return {
        success: true,
        jobId: job.id,
        message: `Queued acquisition of ${dto.count} images`,
      };
    } catch (error) {
      this.logger.error('Bulk acquisition failed:', error);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Get job status
   */
  @Get('job/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    try {
      const job = await this.imageQueue.getJob(jobId);

      if (!job) {
        throw new BadRequestException('Job not found');
      }

      const state = await job.getState();
      const progress = job.progress || 0;
      const result = job.returnvalue;

      return {
        success: true,
        job: {
          id: job.id,
          state,
          progress,
          result,
          failedReason: job.failedReason,
          finishedOn: job.finishedOn,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get job status:', error);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Get available sources and their configuration status
   */
  @Get('sources')
  async getSources() {
    return {
      success: true,
      sources: [
        {
          id: 'ai',
          name: 'AI Generation (DALL-E)',
          available: !!process.env.OPENAI_API_KEY,
          requiresPrompt: true,
          maxCount: 1,
        },
        {
          id: 'unsplash',
          name: 'Unsplash',
          available: !!process.env.UNSPLASH_ACCESS_KEY,
          requiresQuery: true,
          license: 'Free to use',
        },
        {
          id: 'pexels',
          name: 'Pexels',
          available: !!process.env.PEXELS_API_KEY,
          requiresQuery: true,
          license: 'Free to use',
        },
        {
          id: 'pixabay',
          name: 'Pixabay',
          available: !!process.env.PIXABAY_API_KEY,
          requiresQuery: true,
          license: 'Free to use',
        },
        {
          id: 'url',
          name: 'Direct URL',
          available: true,
          requiresUrl: true,
          license: 'Unknown - verify before use',
        },
      ],
    };
  }

  /**
   * Test image acquisition endpoint
   */
  @Post('test')
  async testAcquisition(@Request() req, @Query('source') source: ImageSource) {
    this.logger.log(`Testing ${source} acquisition`);

    const testQueries: Record<ImageSource, ImageAcquisitionOptions> = {
      ai: { source: 'ai', prompt: 'A beautiful sunrise over mountains' },
      unsplash: { source: 'unsplash', query: 'business meeting' },
      pexels: { source: 'pexels', query: 'technology' },
      pixabay: { source: 'pixabay', query: 'nature' },
      url: {
        source: 'url',
        url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4',
      },
    };

    const options = testQueries[source];
    if (!options) {
      throw new BadRequestException('Invalid source');
    }

    try {
      const image = await this.imageAcquisitionService.acquireImage(options);
      return {
        success: true,
        image,
        message: `${source} is working correctly`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `${source} test failed`,
      };
    }
  }
}
