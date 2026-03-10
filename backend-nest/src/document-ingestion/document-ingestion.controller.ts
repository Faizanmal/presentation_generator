import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DocumentIngestionService } from './document-ingestion.service';

interface IngestionOptionsDto {
  slideCount?: string;
  style?: 'executive' | 'detailed' | 'visual' | 'minimal';
  audienceType?: 'executives' | 'technical' | 'sales' | 'general';
  includeDataSlides?: string;
  language?: string;
}

@Controller('document-ingestion')
@UseGuards(JwtAuthGuard)
export class DocumentIngestionController {
  private readonly logger = new Logger(DocumentIngestionController.name);

  constructor(private readonly ingestionService: DocumentIngestionService) {}

  /**
   * POST /api/document-ingestion/upload
   * Upload a document (PDF, DOCX, TXT, MD, HTML) and get AI-structured slides
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 25 * 1024 * 1024, // 25MB max
      },
    }),
  )
  async uploadAndIngest(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
    @Body() options: IngestionOptionsDto,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    this.logger.log(
      `User ${user.id} uploading document: ${file.originalname} (${file.mimetype})`,
    );

    const result = await this.ingestionService.ingestDocument(
      file.buffer,
      file.originalname,
      file.mimetype,
      {
        slideCount: options.slideCount
          ? parseInt(options.slideCount, 10)
          : undefined,
        style: options.style,
        audienceType: options.audienceType,
        includeDataSlides: options.includeDataSlides === 'true',
        language: options.language,
      },
    );

    return {
      success: true,
      ...result,
    };
  }

  /**
   * POST /api/document-ingestion/preview
   * Quick extraction preview (no slide generation)
   */
  @Post('preview')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 25 * 1024 * 1024,
      },
    }),
  )
  async previewExtraction(
    @CurrentUser() _user: { id: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    // We use a simplified extraction to give a quick preview
    const result = await this.ingestionService.ingestDocument(
      file.buffer,
      file.originalname,
      file.mimetype,
      { slideCount: 3, style: 'minimal' },
    );

    return {
      success: true,
      filename: result.originalFilename,
      textLength: result.extractedTextLength,
      suggestedTitle: result.suggestedTitle,
      summary: result.summary,
      previewSlideCount: result.slides.length,
    };
  }
}
