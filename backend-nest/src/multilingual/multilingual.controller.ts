import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MultilingualService, LanguageCode } from './multilingual.service';

// DTOs
class InitializeProjectDto {
  primaryLanguage: LanguageCode;
}

class TranslateProjectDto {
  targetLanguage: LanguageCode;
}

class TranslateSlideDto {
  targetLanguage: LanguageCode;
}

class UpdateTranslationDto {
  translatedContent: any;
}

class DetectLanguageDto {
  text: string;
}

@Controller('multilingual')
export class MultilingualController {
  constructor(private readonly multilingualService: MultilingualService) {}

  @Get('languages')
  getSupportedLanguages() {
    return this.multilingualService.getSupportedLanguages();
  }

  @Post(':projectId/initialize')
  @UseGuards(JwtAuthGuard)
  async initializeProject(
    @Param('projectId') projectId: string,
    @Body() dto: InitializeProjectDto,
    @Request() req: any,
  ) {
    return this.multilingualService.initializeProject(
      projectId,
      req.user.id,
      dto.primaryLanguage,
    );
  }

  @Post(':projectId/translate')
  @UseGuards(JwtAuthGuard)
  async translateProject(
    @Param('projectId') projectId: string,
    @Body() dto: TranslateProjectDto,
    @Request() req: any,
  ) {
    return this.multilingualService.translateProject(
      projectId,
      req.user.id,
      dto.targetLanguage,
    );
  }

  @Post(':projectId/slides/:slideId/translate')
  @UseGuards(JwtAuthGuard)
  async translateSlide(
    @Param('projectId') projectId: string,
    @Param('slideId') slideId: string,
    @Body() dto: TranslateSlideDto,
    @Request() req: any,
  ) {
    return this.multilingualService.translateSlide(
      projectId,
      slideId,
      req.user.id,
      dto.targetLanguage,
    );
  }

  @Get(':projectId/view/:language')
  async getProjectInLanguage(
    @Param('projectId') projectId: string,
    @Param('language') language: LanguageCode,
  ) {
    return this.multilingualService.getProjectInLanguage(projectId, language);
  }

  @Patch(':projectId/slides/:slideId/blocks/:blockId/translation/:language')
  @UseGuards(JwtAuthGuard)
  async updateBlockTranslation(
    @Param('projectId') projectId: string,
    @Param('slideId') slideId: string,
    @Param('blockId') blockId: string,
    @Param('language') language: LanguageCode,
    @Body() dto: UpdateTranslationDto,
    @Request() req: any,
  ) {
    return this.multilingualService.updateBlockTranslation(
      projectId,
      slideId,
      blockId,
      language,
      dto.translatedContent,
      req.user.id,
    );
  }

  @Get('jobs/:jobId')
  @UseGuards(JwtAuthGuard)
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.multilingualService.getJobStatus(jobId);
  }

  @Get(':projectId/progress')
  @UseGuards(JwtAuthGuard)
  async getTranslationProgress(@Param('projectId') projectId: string) {
    return this.multilingualService.getTranslationProgress(projectId);
  }

  @Post('detect-language')
  async detectLanguage(@Body() dto: DetectLanguageDto) {
    return this.multilingualService.detectLanguage(dto.text);
  }
}
