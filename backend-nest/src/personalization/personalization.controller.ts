import {
  Controller,
  Get,
  Post,
  Patch,
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
import {
  PersonalizationService,
  PersonalizationPreferences,
} from './personalization.service';

@Controller('personalization')
@UseGuards(JwtAuthGuard)
export class PersonalizationController {
  constructor(
    private readonly personalizationService: PersonalizationService,
  ) {}

  // ============================================
  // BRAND PROFILE
  // ============================================

  private normalizeProfile(profile: any, userId: string) {
    if (!profile) return null;
    const palette = (profile.colorPalette as { primary?: string; secondary?: string; accent?: string }) || {};
    return {
      id: profile.id,
      userId: profile.userId || userId,
      name: profile.companyName || profile.name || 'Default Brand',
      logo: profile.logoUrl || profile.logo,
      primaryColor: palette.primary || profile.primaryColor || '#3b82f6',
      secondaryColor: palette.secondary || profile.secondaryColor || '#64748b',
      accentColor: palette.accent || profile.accentColor || '#10b981',
      headingFont: profile.headingFont || 'Inter',
      bodyFont: profile.bodyFont || 'Inter',
      voiceTone: profile.brandVoice || profile.voiceTone || 'professional',
      industry: profile.industry || 'Technology',
      isDefault: true,
      createdAt: profile.createdAt ? new Date(profile.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: profile.updatedAt ? new Date(profile.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  @Get('brand')
  async getBrandProfile(@Request() req: { user: { id: string } }) {
    return this.personalizationService.getBrandProfile(req.user.id);
  }

  @Get('brand-profiles')
  async getBrandProfiles(@Request() req: { user: { id: string } }) {
    const profile = await this.personalizationService.getBrandProfile(req.user.id);
    if (!profile) return [];
    const normalized = this.normalizeProfile(profile, req.user.id);
    return normalized ? [normalized] : [];
  }

  @Get('brand-profiles/:id')
  async getBrandProfileById(
    @Request() req: { user: { id: string } },
    @Param('id') _id: string,
  ) {
    const profile = await this.personalizationService.getBrandProfile(req.user.id);
    if (!profile) return null;
    return this.normalizeProfile(profile, req.user.id);
  }

  @Post('brand-profiles')
  async createBrandProfile(
    @Request() req: { user: { id: string } },
    @Body() body: any,
  ) {
    const palette = {
      primary: body.primaryColor || '#3b82f6',
      secondary: body.secondaryColor || '#64748b',
      accent: body.accentColor || '#10b981',
    };
    const created = await this.personalizationService.upsertBrandProfile(req.user.id, {
      companyName: body.name || body.companyName || 'My Brand',
      brandVoice: body.voiceTone || body.brandVoice || 'professional',
      industry: body.industry,
      colorPalette: palette,
    });
    return this.normalizeProfile(created, req.user.id);
  }

  @Patch('brand-profiles/:id')
  async updateBrandProfileById(
    @Request() req: { user: { id: string } },
    @Param('id') _id: string,
    @Body() body: any,
  ) {
    const palette = {
      primary: body.primaryColor || '#3b82f6',
      secondary: body.secondaryColor || '#64748b',
      accent: body.accentColor || '#10b981',
    };
    const updated = await this.personalizationService.upsertBrandProfile(req.user.id, {
      companyName: body.name || body.companyName || 'My Brand',
      brandVoice: body.voiceTone || body.brandVoice || 'professional',
      industry: body.industry,
      colorPalette: palette,
    });
    return this.normalizeProfile(updated, req.user.id);
  }

  @Delete('brand-profiles/:id')
  async deleteBrandProfileById(
    @Request() _req: { user: { id: string } },
    @Param('id') _id: string,
  ) {
    return { success: true };
  }

  @Post('brand')
  async updateBrandProfile(
    @Request() req: { user: { id: string } },
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
    @Request() req: { user: { id: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.personalizationService.uploadBrandLogo(req.user.id, file);
  }

  // ============================================
  // TRAINING DOCUMENTS
  // ============================================

  @Get('documents')
  async getTrainingDocuments(@Request() req: { user: { id: string } }) {
    return this.personalizationService.getTrainingDocuments(req.user.id);
  }

  @Post('documents')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Request() req: { user: { id: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.personalizationService.uploadTrainingDocument(
      req.user.id,
      file,
    );
  }

  @Delete('documents/:id')
  async deleteDocument(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.personalizationService.deleteTrainingDocument(id, req.user.id);
  }

  // ============================================
  // AI SETTINGS
  // ============================================

  @Get('settings')
  async getPersonalizationSettings(@Request() req: { user: { id: string } }) {
    return this.personalizationService.getPersonalizationSettings(req.user.id);
  }

  @Post('settings')
  async savePersonalizationSettings(
    @Request() req: { user: { id: string } },
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
    @Request() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Body()
    body: {
      preferences?: PersonalizationPreferences;
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
  async generateBrandTheme(@Request() req: { user: { id: string } }) {
    return this.personalizationService.generateBrandTheme(req.user.id);
  }

  // ============================================
  // PERSONALIZED PROMPT
  // ============================================

  @Get('prompt')
  async getPersonalizedPrompt(@Request() req: { user: { id: string } }) {
    const prompt = await this.personalizationService.buildPersonalizedPrompt(
      req.user.id,
    );
    return { prompt };
  }

  @Post('search')
  async searchRelevantContent(
    @Request() req: { user: { id: string } },
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
