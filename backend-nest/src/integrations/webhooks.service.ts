import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import axios from 'axios';
import {
  Webhook as PrismaWebhook,
  WebhookLog as PrismaWebhookLog,
  Prisma,
} from '@prisma/client';

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, any>;
  projectId?: string;
  userId?: string;
}

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: Date;
  lastTriggeredAt?: Date;
  failureCount: number;
}

// Supported webhook events
export const WEBHOOK_EVENTS = [
  'project.created',
  'project.updated',
  'project.deleted',
  'project.shared',
  'project.exported',
  'slide.created',
  'slide.updated',
  'slide.deleted',
  'collaborator.added',
  'collaborator.removed',
  'comment.created',
  'comment.resolved',
  'presentation.started',
  'presentation.ended',
  'ai.generation.completed',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // ms

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get all webhooks for a user
   */
  async getWebhooks(userId: string): Promise<WebhookConfig[]> {
    const webhooks = await this.prisma.webhook.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // avoid unbound-method issues by using an inline mapper
    return webhooks.map((w) => this.mapWebhook(w));
  }

  /**
   * Get a specific webhook
   */
  async getWebhook(userId: string, webhookId: string): Promise<WebhookConfig> {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, userId },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    return this.mapWebhook(webhook);
  }

  /**
   * Create a new webhook
   */
  async createWebhook(
    userId: string,
    url: string,
    events: string[],
    secret?: string,
  ): Promise<WebhookConfig> {
    // Validate URL
    try {
      new URL(url);
    } catch {
      throw new BadRequestException('Invalid webhook URL');
    }

    // Validate events
    const invalidEvents = events.filter(
      (e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent),
    );
    if (invalidEvents.length > 0) {
      throw new BadRequestException(
        `Invalid events: ${invalidEvents.join(', ')}`,
      );
    }

    // Generate secret if not provided
    const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

    const webhook = await this.prisma.webhook.create({
      data: {
        userId,
        url,
        events,
        secret: webhookSecret,
        active: true,
        failureCount: 0,
      },
    });

    this.logger.log(`Created webhook ${webhook.id} for user ${userId}`);

    return this.mapWebhook(webhook);
  }

  /**
   * Update a webhook
   */
  async updateWebhook(
    userId: string,
    webhookId: string,
    updates: {
      url?: string;
      events?: string[];
      active?: boolean;
    },
  ): Promise<WebhookConfig> {
    const existing = await this.prisma.webhook.findFirst({
      where: { id: webhookId, userId },
    });

    if (!existing) {
      throw new NotFoundException('Webhook not found');
    }

    // Validate URL if provided
    if (updates.url) {
      try {
        new URL(updates.url);
      } catch {
        throw new BadRequestException('Invalid webhook URL');
      }
    }

    // Validate events if provided
    if (updates.events) {
      const invalidEvents = updates.events.filter(
        (e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent),
      );
      if (invalidEvents.length > 0) {
        throw new BadRequestException(
          `Invalid events: ${invalidEvents.join(', ')}`,
        );
      }
    }

    const webhook = await this.prisma.webhook.update({
      where: { id: webhookId },
      data: updates,
    });

    return this.mapWebhook(webhook);
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(userId: string, webhookId: string): Promise<void> {
    const existing = await this.prisma.webhook.findFirst({
      where: { id: webhookId, userId },
    });

    if (!existing) {
      throw new NotFoundException('Webhook not found');
    }

    await this.prisma.webhook.delete({
      where: { id: webhookId },
    });

    this.logger.log(`Deleted webhook ${webhookId}`);
  }

  /**
   * Test a webhook by sending a test payload
   */
  async testWebhook(
    userId: string,
    webhookId: string,
  ): Promise<{
    success: boolean;
    statusCode?: number;
    response?: string;
    error?: string;
  }> {
    const webhook = await this.getWebhook(userId, webhookId);

    const testPayload: WebhookPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook payload',
        webhookId,
      },
    };

    try {
      const result = await this.sendWebhook(webhook, testPayload);
      return {
        success: result.success,
        statusCode: result.statusCode,
        response: result.response,
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errMsg,
      };
    }
  }

  /**
   * Trigger webhooks for a specific event
   */
  async trigger(
    userId: string,
    event: WebhookEvent,
    data: Record<string, any>,
    projectId?: string,
  ): Promise<void> {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        userId,
        active: true,
        events: { has: event },
      },
    });

    if (webhooks.length === 0) {
      return;
    }

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      projectId,
      userId,
    };

    // Fire webhooks in parallel but don't block
    Promise.all(
      webhooks.map((webhook) => this.deliverWebhook(webhook, payload)),
    ).catch((error) => {
      this.logger.error('Error delivering webhooks', error);
    });
  }

  /**
   * Deliver a webhook with retries
   */
  private async deliverWebhook(
    webhook: PrismaWebhook,
    payload: WebhookPayload,
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await this.sendWebhook(
          this.mapWebhook(webhook),
          payload,
        );

        if (result.success) {
          // Reset failure count on success
          await this.prisma.webhook.update({
            where: { id: webhook.id },
            data: {
              failureCount: 0,
              lastTriggeredAt: new Date(),
            },
          });
          return;
        }
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `Webhook ${webhook.id} delivery attempt ${attempt + 1} failed: ${
            lastError.message
          }`,
        );

        // Wait before retry
        if (attempt < this.maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelay * (attempt + 1)),
          );
        }
      }
    }

    // All retries failed
    this.logger.error(
      `Webhook ${webhook.id} delivery failed after ${this.maxRetries} attempts`,
    );

    // Increment failure count
    const updatedWebhook = await this.prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        failureCount: { increment: 1 },
        lastTriggeredAt: new Date(),
      },
    });

    // Disable webhook if too many failures
    if (updatedWebhook.failureCount >= 10) {
      await this.prisma.webhook.update({
        where: { id: webhook.id },
        data: { active: false },
      });
      this.logger.warn(
        `Webhook ${webhook.id} disabled due to repeated failures`,
      );
    }

    // Log the failure
    await this.prisma.webhookLog.create({
      data: {
        webhookId: webhook.id,
        event: payload.event,
        payload: payload as unknown as Prisma.InputJsonValue,
        success: false,
        error: (lastError as Error)?.message || 'Unknown error',
      },
    });
  }

  /**
   * Send a single webhook request
   */
  private async sendWebhook(
    webhook: WebhookConfig,
    payload: WebhookPayload,
  ): Promise<{ success: boolean; statusCode?: number; response?: string }> {
    const payloadString = JSON.stringify(payload);
    const signature = this.generateSignature(payloadString, webhook.secret);

    try {
      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': payload.timestamp,
          'User-Agent': 'PresentationDesigner-Webhook/1.0',
        },
        timeout: 10000, // 10 second timeout
        validateStatus: () => true, // Don't throw on non-2xx
      });

      const success = response.status >= 200 && response.status < 300;

      // Log the attempt
      await this.prisma.webhookLog.create({
        data: {
          webhookId: webhook.id,
          event: payload.event,
          payload: payload as unknown as Prisma.InputJsonValue,
          success,
          statusCode: response.status,
          response:
            typeof response.data === 'string'
              ? response.data.substring(0, 1000)
              : JSON.stringify(response.data).substring(0, 1000),
        },
      });

      return {
        success,
        statusCode: response.status,
        response:
          typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data),
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Request failed: ${errMsg}`, { cause: error as Error });
    }
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Verify a webhook signature (for incoming webhooks)
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  /**
   * Get webhook delivery logs
   */
  async getWebhookLogs(
    userId: string,
    webhookId: string,
    limit = 50,
  ): Promise<PrismaWebhookLog[]> {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, userId },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    return this.prisma.webhookLog.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Map database webhook to config interface
   */
  private mapWebhook(webhook: PrismaWebhook): WebhookConfig {
    return {
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret,
      active: webhook.active,
      createdAt: webhook.createdAt,
      lastTriggeredAt: webhook.lastTriggeredAt ?? undefined,
      failureCount: webhook.failureCount,
    };
  }
}
