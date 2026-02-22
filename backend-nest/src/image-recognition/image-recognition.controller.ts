import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImageRecognitionService } from './image-recognition.service';

class GenerateEmbeddingDto {
  uploadId!: string;
  imageUrl!: string;
}

class TrackUsageDto {
  uploadId!: string;
  projectId!: string;
  slideId?: string;
  blockId?: string;
  usageType?: 'content' | 'background' | 'thumbnail';
}

class PredictImagesDto {
  title?: string;
  description?: string;
  tone?: string;
  audience?: string;
  existingTags?: string[];
  limit?: number;
}

class FindSimilarDto {
  uploadId!: string;
  limit?: number;
  minSimilarity?: number;
}

class BatchEmbeddingsDto {
  uploadIds!: string[];
}

@Controller('image-recognition')
@UseGuards(JwtAuthGuard)
export class ImageRecognitionController {
  constructor(
    private readonly imageRecognitionService: ImageRecognitionService,
  ) {}

  /**
   * Generate embedding for an image
   * POST /api/image-recognition/embedding
   */
  @Post('embedding')
  @HttpCode(HttpStatus.OK)
  generateEmbedding(
    @Request() _req: { user: { id: string } },
    @Body() dto: GenerateEmbeddingDto,
  ) {
    return this.imageRecognitionService.generateImageEmbedding(
      dto.uploadId,
      dto.imageUrl,
    );
  }

  /**
   * Batch generate embeddings for multiple images
   * POST /api/image-recognition/embeddings/batch
   */
  @Post('embeddings/batch')
  @HttpCode(HttpStatus.ACCEPTED)
  batchGenerateEmbeddings(
    @Request() _req: { user: { id: string } },
    @Body() dto: BatchEmbeddingsDto,
  ) {
    if (!dto.uploadIds || dto.uploadIds.length === 0) {
      throw new BadRequestException('uploadIds array is required');
    }

    if (dto.uploadIds.length > 100) {
      throw new BadRequestException('Maximum 100 images per batch');
    }

    // Run in background
    void this.imageRecognitionService
      .batchGenerateEmbeddings(dto.uploadIds)
      .catch((error: unknown) => {
        console.error('Batch embedding generation failed:', error);
      });

    return {
      message: 'Batch embedding generation started',
      count: dto.uploadIds.length,
    };
  }

  /**
   * Find similar images
   * POST /api/image-recognition/similar
   */
  @Post('similar')
  @HttpCode(HttpStatus.OK)
  findSimilarImages(
    @Request() _req: { user: { id: string } },
    @Body() dto: FindSimilarDto,
  ) {
    const limit = dto.limit || 10;
    const minSimilarity = dto.minSimilarity || 0.7;

    return this.imageRecognitionService.findSimilarImages(
      dto.uploadId,
      limit,
      minSimilarity,
    );
  }

  /**
   * Track image usage in a presentation
   * POST /api/image-recognition/track-usage
   */
  @Post('track-usage')
  @HttpCode(HttpStatus.CREATED)
  async trackUsage(
    @Request() _req: { user: { id: string } },
    @Body() dto: TrackUsageDto,
  ) {
    await this.imageRecognitionService.trackImageUsage(
      dto.uploadId,
      dto.projectId,
      dto.slideId,
      dto.blockId,
      dto.usageType,
    );

    return { success: true };
  }

  /**
   * Remove image usage tracking
   * DELETE /api/image-recognition/usage/:usageId
   */
  @Delete('usage/:usageId')
  @HttpCode(HttpStatus.OK)
  async removeUsage(
    @Request() _req: { user: { id: string } },
    @Param('usageId') usageId: string,
  ) {
    await this.imageRecognitionService.removeImageUsage(usageId);
    return { success: true };
  }

  /**
   * Get images used in a specific presentation
   * GET /api/image-recognition/presentation/:projectId/images
   */
  @Get('presentation/:projectId/images')
  @HttpCode(HttpStatus.OK)
  getImagesInPresentation(
    @Request() _req: { user: { id: string } },
    @Param('projectId') projectId: string,
  ) {
    return this.imageRecognitionService.getImagesInPresentation(projectId);
  }

  /**
   * Find presentations using a specific image
   * GET /api/image-recognition/image/:uploadId/presentations
   */
  @Get('image/:uploadId/presentations')
  @HttpCode(HttpStatus.OK)
  findPresentationsUsingImage(
    @Request() _req: { user: { id: string } },
    @Param('uploadId') uploadId: string,
  ) {
    return this.imageRecognitionService.findPresentationsUsingImage(uploadId);
  }

  /**
   * Get user's image usage analytics
   * GET /api/image-recognition/analytics
   */
  @Get('analytics')
  @HttpCode(HttpStatus.OK)
  getUserAnalytics(@Request() req: { user: { id: string } }) {
    return this.imageRecognitionService.getUserImageAnalytics(req.user.id);
  }

  /**
   * Predict/recommend images for a presentation
   * POST /api/image-recognition/predict
   */
  @Post('predict')
  @HttpCode(HttpStatus.OK)
  predictImages(
    @Request() _req: { user: { id: string } },
    @Body() dto: PredictImagesDto,
  ) {
    const limit = dto.limit || 10;

    return this.imageRecognitionService.predictImagesForPresentation(
      req.user.id,
      {
        title: dto.title,
        description: dto.description,
        tone: dto.tone,
        audience: dto.audience,
        existingTags: dto.existingTags,
      },
      limit,
    );
  }

  /**
   * Describe an image using AI
   * POST /api/image-recognition/describe
   */
  @Post('describe')
  @HttpCode(HttpStatus.OK)
  async describeImage(
    @Request() _req: { user: { id: string } },
    @Body() body: { imageUrl: string },
  ) {
    if (!body.imageUrl) {
      throw new BadRequestException('imageUrl is required');
    }

    const description = await this.imageRecognitionService.describeImage(
      body.imageUrl,
    );

    return { description };
  }
}
