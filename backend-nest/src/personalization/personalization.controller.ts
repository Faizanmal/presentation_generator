import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PersonalizationService } from './personalization.service';

@Controller('personalization')
@UseGuards(JwtAuthGuard)
export class PersonalizationController {
  constructor(
    private readonly personalizationService: PersonalizationService,
  ) {}

  // ============================================
  // BRAND PROFILE
  // ============================================

  @Get('brand')
  async getBrandProfile(@Request() req: any) {
    return this.personalizationService.getBrandProfile(req.user.id);
  }

  @Post('brand')
  async updateBrandProfile(
    @Request() req: any,
    @Body()
    body: {
      companyName?: string;
      brandVoice?: string;
      industry?: string;
      targetAudience?: string;
      keywords?: string[];
      colorPalette?: { primary: string; secondary: string; accent: string };
    },
  ) {
    return this.personalizationService.upsertBrandProfile(req.user.id, body);
  }

  @Post('brand/logo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.personalizationService.uploadBrandLogo(req.user.id, file);
  }

  // ============================================
  // TRAINING DOCUMENTS
  // ============================================

  @Get('documents')
  async getTrainingDocuments(@Request() req: any) {
    return this.personalizationService.getTrainingDocuments(req.user.id);
  }

  @Post('documents')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.personalizationService.uploadTrainingDocument(
      req.user.id,
      file,
    );
  }

  @Delete('documents/:id')
  async deleteDocument(@Request() req: any, @Param('id') id: string) {
    return this.personalizationService.deleteTrainingDocument(id, req.user.id);
  }

  // ============================================
  // AI SETTINGS
  // ============================================

  @Get('settings')
  async getPersonalizationSettings(@Request() req: any) {
    return this.personalizationService.getPersonalizationSettings(req.user.id);
  }

  @Post('settings')
  async savePersonalizationSettings(
    @Request() req: any,
    @Body()
    body: {
      preferences?: {
        defaultTone?: string;
        defaultAudience?: string;
        preferredLength?: number;
        stylePreferences?: {
          useEmoji?: boolean;
          formalLevel?: 'casual' | 'professional' | 'formal';
          bulletStyle?: 'short' | 'detailed';
        };
      };
      promptTemplate?: string;
      examples?: Array<{ input: string; output: string }>;
    },
  ) {
    return this.personalizationService.savePersonalizationSettings(
      req.user.id,
      body.preferences || {},
      body.promptTemplate,
      body.examples,
    );
  }

  @Post('projects/:projectId/settings')
  async saveProjectSettings(
    @Request() req: any,
    @Param('projectId') projectId: string,
    @Body()
    body: {
      preferences?: any;
      promptTemplate?: string;
    },
  ) {
    return this.personalizationService.saveProjectPersonalization(
      req.user.id,
      projectId,
      body.preferences || {},
      body.promptTemplate,
    );
  }

  // ============================================
  // BRAND THEME
  // ============================================

  @Get('brand/theme')
  async generateBrandTheme(@Request() req: any) {
    return this.personalizationService.generateBrandTheme(req.user.id);
  }

  // ============================================
  // PERSONALIZED PROMPT
  // ============================================

  @Get('prompt')
  async getPersonalizedPrompt(
    @Request() req: any,
    @Param('projectId') projectId?: string,
  ) {
    const prompt = await this.personalizationService.buildPersonalizedPrompt(
      req.user.id,
      projectId,
    );
    return { prompt };
  }

  @Post('search')
  async searchRelevantContent(
    @Request() req: any,
    @Body() body: { query: string; limit?: number },
  ) {
    const results = await this.personalizationService.findRelevantContent(
      req.user.id,
      body.query,
      body.limit,
    );
    return { results };
  }
}
