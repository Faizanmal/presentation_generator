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
  BadRequestException,
} from '@nestjs/common';
import type { Response, Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IntegrationsService } from './integrations.service';
import { ConfigService } from '@nestjs/config';
import { Feature } from '../common/decorators/feature.decorator';

type IntegrationProvider =
  | 'ZOOM'
  | 'SLACK'
  | 'TEAMS'
  | 'GOOGLE_DRIVE'
  | 'FIGMA'
  | 'NOTION'
  | 'DROPBOX';

type AuthRequest = ExpressRequest & { user: { id: string } };

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly configService: ConfigService,
  ) { }

  // ============================================
  // INTEGRATION MANAGEMENT
  // ============================================

  /**
   * Get all connected integrations for current user
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserIntegrations(@Request() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.integrationsService.getUserIntegrations(userId);
  }

  /**
   * Get OAuth URL to connect an integration
   */
  @Get(':provider/auth')
  @UseGuards(JwtAuthGuard)
  getAuthUrl(
    @Param('provider') provider: IntegrationProvider,
    @Request() req: AuthRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    const url = this.integrationsService.getAuthUrl(provider, userId);
    return { url };
  }

  /**
   * Disconnect an integration
   */
  @Delete(':provider')
  @UseGuards(JwtAuthGuard)
  async disconnectIntegration(
    @Param('provider') provider: IntegrationProvider,
    @Request() req: AuthRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.integrationsService.disconnectIntegration(userId, provider);
  }

  // ============================================
  // OAUTH CALLBACKS (Public - no JWT guard)
  // ============================================

  @Get('zoom/callback')
  @Feature('integrations')
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
    @Request() req: AuthRequest,
    @Body() body: { projectId: string; topic: string; startTime?: string },
  ) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.integrationsService.createZoomMeeting(
      userId,
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
  async getSlackChannels(
    @Request() req: AuthRequest,
  ): Promise<Array<{ id: string; name: string; isPrivate: boolean }>> {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    const channelsRaw = (await this.integrationsService.getSlackChannels(
      userId,
    )) as unknown;
    if (!Array.isArray(channelsRaw)) return [];
    const channels = channelsRaw as unknown[];

    const normalized = channels
      .map((c) => {
        if (!c || typeof c !== 'object') return null;
        const obj = c as Record<string, unknown>;
        const idRaw = obj.id ?? obj['channel'] ?? obj['channel_id'];
        const nameRaw = obj.name ?? obj['title'] ?? obj['display_name'];
        const isPrivate = obj.is_private ?? obj.isPrivate ?? false;

        const id =
          typeof idRaw === 'string' || typeof idRaw === 'number'
            ? String(idRaw)
            : '';
        const name =
          typeof nameRaw === 'string' || typeof nameRaw === 'number'
            ? String(nameRaw)
            : '';
        return {
          id: String(id ?? ''),
          name: String(name ?? ''),
          isPrivate: Boolean(isPrivate),
        };
      })
      .filter(
        (ch): ch is { id: string; name: string; isPrivate: boolean } =>
          !!ch && ch.id !== '',
      );

    return normalized;
  }

  @Post('slack/message')
  @UseGuards(JwtAuthGuard)
  async sendSlackMessage(
    @Request() req: AuthRequest,
    @Body() body: { channel: string; message: string; presentationUrl: string },
  ) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.integrationsService.sendSlackMessage(
      userId,
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
    @Request() req: AuthRequest,
    @Body() body: { pageId: string },
  ) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.integrationsService.importFromNotion(userId, body.pageId);
  }

  // ============================================
  // FIGMA ACTIONS
  // ============================================

  @Get('figma/file/:fileKey')
  @UseGuards(JwtAuthGuard)
  async getFigmaFile(
    @Request() req: AuthRequest,
    @Param('fileKey') fileKey: string,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.integrationsService.getFigmaFile(userId, fileKey);
  }

  @Post('figma/export')
  @UseGuards(JwtAuthGuard)
  async exportFigmaFrames(
    @Request() req: AuthRequest,
    @Body() body: { fileKey: string; nodeIds: string[] },
  ): Promise<Record<string, string>> {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    const images = await this.integrationsService.exportFigmaFrames(
      userId,
      body.fileKey,
      body.nodeIds,
    );

    if (!images || typeof images !== 'object') return {};
    const result: Record<string, string> = {};
    Object.keys(images).forEach((k) => {
      const v = (images as Record<string, unknown>)[k];
      if (typeof v === 'string') result[k] = v;
    });
    return result;
  }
}
