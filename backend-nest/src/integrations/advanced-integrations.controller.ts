import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdvancedIntegrationsService } from './advanced-integrations.service';

class RegisterWebhookDto {
  url: string;
  events: string[];
}

@Controller('integrations')
export class AdvancedIntegrationsController {
  constructor(
    private readonly advancedIntegrationsService: AdvancedIntegrationsService,
    private readonly configService: ConfigService,
  ) {}

  // ============================================
  // CANVA ENDPOINTS
  // ============================================

  @Get('canva/auth')
  @UseGuards(JwtAuthGuard)
  getCanvaAuthUrl(@Request() req: { user: { id: string } }) {
    return {
      url: this.advancedIntegrationsService.getCanvaAuthUrl(req.user.id),
    };
  }

  @Get('canva/callback')
  async canvaCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.advancedIntegrationsService.exchangeCanvaCode(code, state);
    res.redirect(
      `${this.configService.get('FRONTEND_URL')}/settings/integrations?success=canva`,
    );
  }

  @Get('canva/designs')
  @UseGuards(JwtAuthGuard)
  async getCanvaDesigns(@Request() req: { user: { id: string } }) {
    return this.advancedIntegrationsService.getCanvaDesigns(req.user.id);
  }

  @Post('canva/import')
  @UseGuards(JwtAuthGuard)
  async importCanvaDesign(
    @Request() req: { user: { id: string } },
    @Body() body: { designId: string },
  ) {
    return this.advancedIntegrationsService.importCanvaDesign(
      req.user.id,
      body.designId,
    );
  }

  // ============================================
  // MIRO ENDPOINTS
  // ============================================

  @Get('miro/auth')
  @UseGuards(JwtAuthGuard)
  getMiroAuthUrl(@Request() req: { user: { id: string } }) {
    return {
      url: this.advancedIntegrationsService.getMiroAuthUrl(req.user.id),
    };
  }

  @Get('miro/callback')
  async miroCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.advancedIntegrationsService.exchangeMiroCode(code, state);
    res.redirect(
      `${this.configService.get('FRONTEND_URL')}/settings/integrations?success=miro`,
    );
  }

  @Get('miro/boards')
  @UseGuards(JwtAuthGuard)
  async getMiroBoards(@Request() req: { user: { id: string } }) {
    return this.advancedIntegrationsService.getMiroBoards(req.user.id);
  }

  @Post('miro/import')
  @UseGuards(JwtAuthGuard)
  async importMiroBoard(
    @Request() req: { user: { id: string } },
    @Body() body: { boardId: string },
  ) {
    return this.advancedIntegrationsService.importMiroBoard(
      req.user.id,
      body.boardId,
    );
  }

  @Post('miro/export')
  @UseGuards(JwtAuthGuard)
  async exportToMiro(
    @Request() req: { user: { id: string } },
    @Body() body: { projectId: string },
  ) {
    return this.advancedIntegrationsService.exportToMiro(
      req.user.id,
      body.projectId,
    );
  }

  // ============================================
  // WEBHOOK ENDPOINTS
  // ============================================

  @Get('webhooks')
  @UseGuards(JwtAuthGuard)
  async listWebhooks(@Request() req: { user: { id: string } }) {
    return this.advancedIntegrationsService.listWebhooks(req.user.id);
  }

  @Post('webhooks')
  @UseGuards(JwtAuthGuard)
  async registerWebhook(
    @Request() req: { user: { id: string } },
    @Body() dto: RegisterWebhookDto,
  ) {
    return this.advancedIntegrationsService.registerWebhook(
      req.user.id,
      dto.url,
      dto.events,
    );
  }

  @Delete('webhooks/:id')
  @UseGuards(JwtAuthGuard)
  async deleteWebhook(
    @Request() req: { user: { id: string } },
    @Param('id') webhookId: string,
  ) {
    const deleted = await this.advancedIntegrationsService.deleteWebhook(
      req.user.id,
      webhookId,
    );
    return { deleted };
  }

  @Get('webhooks/events')
  @UseGuards(JwtAuthGuard)
  getSupportedEvents() {
    return {
      events: this.advancedIntegrationsService.getSupportedEvents(),
    };
  }
}
