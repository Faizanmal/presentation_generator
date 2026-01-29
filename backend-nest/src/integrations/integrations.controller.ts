import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IntegrationsService } from './integrations.service';
import { ConfigService } from '@nestjs/config';

type IntegrationProvider =
  | 'ZOOM'
  | 'SLACK'
  | 'TEAMS'
  | 'GOOGLE_DRIVE'
  | 'FIGMA'
  | 'NOTION'
  | 'DROPBOX';

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly configService: ConfigService,
  ) {}

  // ============================================
  // INTEGRATION MANAGEMENT
  // ============================================

  /**
   * Get all connected integrations for current user
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserIntegrations(@Request() req: any) {
    return this.integrationsService.getUserIntegrations(req.user.id);
  }

  /**
   * Get OAuth URL to connect an integration
   */
  @Get(':provider/auth')
  @UseGuards(JwtAuthGuard)
  async getAuthUrl(
    @Param('provider') provider: IntegrationProvider,
    @Request() req: any,
  ) {
    const url = this.integrationsService.getAuthUrl(provider, req.user.id);
    return { url };
  }

  /**
   * Disconnect an integration
   */
  @Delete(':provider')
  @UseGuards(JwtAuthGuard)
  async disconnectIntegration(
    @Param('provider') provider: IntegrationProvider,
    @Request() req: any,
  ) {
    return this.integrationsService.disconnectIntegration(
      req.user.id,
      provider,
    );
  }

  // ============================================
  // OAUTH CALLBACKS (Public - no JWT guard)
  // ============================================

  @Get('zoom/callback')
  async zoomCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.integrationsService.handleOAuthCallback('ZOOM', { code, state });
    res.redirect(
      `${this.configService.get('FRONTEND_URL')}/settings/integrations?success=zoom`,
    );
  }

  @Get('slack/callback')
  async slackCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.integrationsService.handleOAuthCallback('SLACK', {
      code,
      state,
    });
    res.redirect(
      `${this.configService.get('FRONTEND_URL')}/settings/integrations?success=slack`,
    );
  }

  @Get('teams/callback')
  async teamsCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.integrationsService.handleOAuthCallback('TEAMS', {
      code,
      state,
    });
    res.redirect(
      `${this.configService.get('FRONTEND_URL')}/settings/integrations?success=teams`,
    );
  }

  @Get('google-drive/callback')
  async googleDriveCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.integrationsService.handleOAuthCallback('GOOGLE_DRIVE', {
      code,
      state,
    });
    res.redirect(
      `${this.configService.get('FRONTEND_URL')}/settings/integrations?success=google-drive`,
    );
  }

  @Get('figma/callback')
  async figmaCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.integrationsService.handleOAuthCallback('FIGMA', {
      code,
      state,
    });
    res.redirect(
      `${this.configService.get('FRONTEND_URL')}/settings/integrations?success=figma`,
    );
  }

  @Get('notion/callback')
  async notionCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.integrationsService.handleOAuthCallback('NOTION', {
      code,
      state,
    });
    res.redirect(
      `${this.configService.get('FRONTEND_URL')}/settings/integrations?success=notion`,
    );
  }

  // ============================================
  // ZOOM ACTIONS
  // ============================================

  @Post('zoom/meeting')
  @UseGuards(JwtAuthGuard)
  async createZoomMeeting(
    @Request() req: any,
    @Body() body: { projectId: string; topic: string; startTime?: string },
  ) {
    return this.integrationsService.createZoomMeeting(
      req.user.id,
      body.projectId,
      body.topic,
      body.startTime ? new Date(body.startTime) : undefined,
    );
  }

  // ============================================
  // SLACK ACTIONS
  // ============================================

  @Get('slack/channels')
  @UseGuards(JwtAuthGuard)
  async getSlackChannels(@Request() req: any) {
    return this.integrationsService.getSlackChannels(req.user.id);
  }

  @Post('slack/message')
  @UseGuards(JwtAuthGuard)
  async sendSlackMessage(
    @Request() req: any,
    @Body() body: { channel: string; message: string; presentationUrl: string },
  ) {
    return this.integrationsService.sendSlackMessage(
      req.user.id,
      body.channel,
      body.message,
      body.presentationUrl,
    );
  }

  // ============================================
  // NOTION ACTIONS
  // ============================================

  @Post('notion/import')
  @UseGuards(JwtAuthGuard)
  async importFromNotion(
    @Request() req: any,
    @Body() body: { pageId: string },
  ) {
    return this.integrationsService.importFromNotion(req.user.id, body.pageId);
  }

  // ============================================
  // FIGMA ACTIONS
  // ============================================

  @Get('figma/file/:fileKey')
  @UseGuards(JwtAuthGuard)
  async getFigmaFile(@Request() req: any, @Param('fileKey') fileKey: string) {
    return this.integrationsService.getFigmaFile(req.user.id, fileKey);
  }

  @Post('figma/export')
  @UseGuards(JwtAuthGuard)
  async exportFigmaFrames(
    @Request() req: any,
    @Body() body: { fileKey: string; nodeIds: string[] },
  ) {
    return this.integrationsService.exportFigmaFrames(
      req.user.id,
      body.fileKey,
      body.nodeIds,
    );
  }
}
