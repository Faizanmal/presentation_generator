import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SocialSharingService } from './social-sharing.service';
import type { EmbedConfig } from './social-sharing.service';
import { Request } from 'express';
import type { Response } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string };
}

@ApiTags('social-sharing')
@Controller('api/social')
export class SocialSharingController {
  constructor(private readonly socialSharingService: SocialSharingService) {}

  // ============================================
  // LINKEDIN ENDPOINTS
  // ============================================

  @Get('linkedin/auth')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get LinkedIn OAuth URL' })
  getLinkedInAuthUrl(@Req() req: AuthenticatedRequest) {
    return { url: this.socialSharingService.getLinkedInAuthUrl(req.user.id) };
  }

  @Get('linkedin/callback')
  @ApiOperation({ summary: 'LinkedIn OAuth callback' })
  async linkedInCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      await this.socialSharingService.exchangeLinkedInCode(code, state);
      res.redirect('/settings/integrations?connected=linkedin');
    } catch (error) {
      res.redirect(
        `/settings/integrations?error=${encodeURIComponent(error.message)}`,
      );
    }
  }

  @Post('linkedin/share/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Share presentation to LinkedIn' })
  @ApiBody({
    schema: {
      properties: {
        message: { type: 'string' },
        includePreview: { type: 'boolean' },
      },
    },
  })
  async shareToLinkedIn(
    @Param('projectId') projectId: string,
    @Body() body: { message?: string; includePreview?: boolean },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.socialSharingService.shareToLinkedIn(
      req.user.id,
      projectId,
      body,
    );
  }

  // ============================================
  // TWITTER ENDPOINTS
  // ============================================

  @Get('twitter/auth')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Twitter OAuth URL' })
  getTwitterAuthUrl(@Req() req: AuthenticatedRequest) {
    return { url: this.socialSharingService.getTwitterAuthUrl(req.user.id) };
  }

  @Post('twitter/share/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Share presentation to Twitter/X' })
  @ApiBody({
    schema: {
      properties: {
        message: { type: 'string' },
        includeImage: { type: 'boolean' },
      },
    },
  })
  async shareToTwitter(
    @Param('projectId') projectId: string,
    @Body() body: { message?: string; includeImage?: boolean },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.socialSharingService.shareToTwitter(
      req.user.id,
      projectId,
      body,
    );
  }

  // ============================================
  // YOUTUBE ENDPOINTS
  // ============================================

  @Get('youtube/auth')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get YouTube OAuth URL' })
  getYouTubeAuthUrl(@Req() req: AuthenticatedRequest) {
    return { url: this.socialSharingService.getYouTubeAuthUrl(req.user.id) };
  }

  @Post('youtube/upload/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload presentation video to YouTube' })
  async uploadToYouTube(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      videoBase64: string;
      title?: string;
      description?: string;
      tags?: string[];
      privacy?: 'public' | 'private' | 'unlisted';
    },
    @Req() req: AuthenticatedRequest,
  ) {
    const videoBuffer = Buffer.from(body.videoBase64, 'base64');
    return this.socialSharingService.uploadToYouTube(
      req.user.id,
      projectId,
      videoBuffer,
      {
        title: body.title,
        description: body.description,
        tags: body.tags,
        privacy: body.privacy,
      },
    );
  }

  // ============================================
  // EMBED & QUICK SHARE
  // ============================================

  @Get('embed/:projectId')
  @ApiOperation({ summary: 'Generate embed code for a presentation' })
  generateEmbedCode(
    @Param('projectId') projectId: string,
    @Query() config: Partial<EmbedConfig>,
  ) {
    return this.socialSharingService.generateEmbedCode(projectId, config);
  }

  @Get('preview/:projectId')
  @ApiOperation({ summary: 'Get social preview metadata (Open Graph)' })
  async getSocialPreview(@Param('projectId') projectId: string) {
    return this.socialSharingService.generateSocialPreview(projectId);
  }

  @Get('quick-links/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get quick share links for all platforms' })
  async getQuickShareLinks(
    @Param('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.socialSharingService.getQuickShareLinks(projectId, req.user.id);
  }

  @Post('short-link/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a short shareable link' })
  async createShortLink(
    @Param('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const shortLink = await this.socialSharingService.createShortLink(
      projectId,
      req.user.id,
    );
    return { shortLink };
  }

  // ============================================
  // ANALYTICS
  // ============================================

  @Get('analytics/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get sharing analytics for a project' })
  async getShareAnalytics(
    @Param('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.socialSharingService.getShareAnalytics(projectId, req.user.id);
  }
}
