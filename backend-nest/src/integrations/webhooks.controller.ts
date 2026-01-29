import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WebhooksService, WEBHOOK_EVENTS } from './webhooks.service';

interface CreateWebhookDto {
  url: string;
  events: string[];
  secret?: string;
}

interface UpdateWebhookDto {
  url?: string;
  events?: string[];
  active?: boolean;
}

@Controller('integrations/webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * Get all supported webhook events
   */
  @Get('events')
  getEvents() {
    return {
      events: WEBHOOK_EVENTS,
    };
  }

  /**
   * Get all webhooks for the current user
   */
  @Get()
  async getWebhooks(@CurrentUser() user: { id: string }) {
    return this.webhooksService.getWebhooks(user.id);
  }

  /**
   * Get a specific webhook
   */
  @Get(':id')
  async getWebhook(
    @CurrentUser() user: { id: string },
    @Param('id') webhookId: string,
  ) {
    return this.webhooksService.getWebhook(user.id, webhookId);
  }

  /**
   * Create a new webhook
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createWebhook(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhooksService.createWebhook(
      user.id,
      dto.url,
      dto.events,
      dto.secret,
    );
  }

  /**
   * Update a webhook
   */
  @Patch(':id')
  async updateWebhook(
    @CurrentUser() user: { id: string },
    @Param('id') webhookId: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooksService.updateWebhook(user.id, webhookId, dto);
  }

  /**
   * Delete a webhook
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWebhook(
    @CurrentUser() user: { id: string },
    @Param('id') webhookId: string,
  ) {
    await this.webhooksService.deleteWebhook(user.id, webhookId);
  }

  /**
   * Test a webhook by sending a test payload
   */
  @Post(':id/test')
  async testWebhook(
    @CurrentUser() user: { id: string },
    @Param('id') webhookId: string,
  ) {
    return this.webhooksService.testWebhook(user.id, webhookId);
  }

  /**
   * Get webhook delivery logs
   */
  @Get(':id/logs')
  async getWebhookLogs(
    @CurrentUser() user: { id: string },
    @Param('id') webhookId: string,
    @Query('limit') limit?: string,
  ) {
    return this.webhooksService.getWebhookLogs(
      user.id,
      webhookId,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
