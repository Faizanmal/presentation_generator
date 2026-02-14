import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import { IntegrationProvider } from '@prisma/client';

interface WebhookPayload {
  event: string;
  data: any;
  timestamp: string;
  projectId?: string;
}

export interface WebhookConfig {
  id: string;
  userId: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: Date;
}

interface CanvaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface CanvaDesign {
  id: string;
  title: string;
  thumbnail: {
    url: string;
  };
  created_at: string;
  updated_at: string;
}

interface CanvaDesignListResponse {
  designs: CanvaDesign[];
}

interface MiroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}

interface MiroBoard {
  id: string;
  name: string;
  description: string;
  viewLink: string;
  createdAt: string;
  modifiedAt: string;
}

interface MiroBoardListResponse {
  data: MiroBoard[];
}

/**
 * Advanced integrations service for Canva, Miro, and Webhooks
 */
@Injectable()
export class AdvancedIntegrationsService {
  private readonly logger = new Logger(AdvancedIntegrationsService.name);
  private readonly webhooks = new Map<string, WebhookConfig[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ============================================
  // CANVA INTEGRATION
  // ============================================

  /**
   * Get Canva OAuth URL
   */
  getCanvaAuthUrl(userId: string): string {
    const clientId = this.configService.get<string>('CANVA_CLIENT_ID');
    const redirectUri = `${this.configService.get('API_URL')}/api/integrations/canva/callback`;
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    return `https://www.canva.com/api/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=design:read+folder:read&state=${state}`;
  }

  /**
   * Exchange Canva code for tokens
   */
  async exchangeCanvaCode(code: string, state: string) {
    const clientId = this.configService.get<string>('CANVA_CLIENT_ID');
    const clientSecret = this.configService.get<string>('CANVA_CLIENT_SECRET');
    const redirectUri = `${this.configService.get('API_URL')}/api/integrations/canva/callback`;

    const stateData = JSON.parse(Buffer.from(state, 'base64').toString()) as {
      userId: string;
    };
    const userId = stateData.userId;

    const response = await axios.post(
      'https://api.canva.com/rest/v1/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId!,
        client_secret: clientSecret!,
        code,
        redirect_uri: redirectUri,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );

    const data = response.data as CanvaTokenResponse;

    await this.prisma.integration.upsert({
      where: {
        userId_provider: { userId, provider: 'CANVA' as IntegrationProvider },
      },
      update: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        isActive: true,
      },
      create: {
        userId,
        provider: 'CANVA' as IntegrationProvider,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      },
    });

    return { success: true };
  }

  /**
   * Get user's Canva designs
   */
  async getCanvaDesigns(userId: string) {
    const integration = await this.prisma.integration.findUnique({
      where: {
        userId_provider: { userId, provider: 'CANVA' as IntegrationProvider },
      },
    });

    if (!integration) {
      throw new BadRequestException('Canva not connected');
    }

    const response = await axios.get('https://api.canva.com/rest/v1/designs', {
      headers: { Authorization: `Bearer ${integration.accessToken}` },
    });

    return (response.data as CanvaDesignListResponse).designs.map((design) => ({
      id: design.id,
      title: design.title,
      thumbnailUrl: design.thumbnail.url,
      createdAt: design.created_at,
      updatedAt: design.updated_at,
    }));
  }

  /**
   * Import Canva design as slides
   */
  async importCanvaDesign(userId: string, designId: string) {
    const integration = await this.prisma.integration.findUnique({
      where: {
        userId_provider: { userId, provider: 'CANVA' as IntegrationProvider },
      },
    });

    if (!integration) {
      throw new BadRequestException('Canva not connected');
    }

    // Get design details
    const designResponse = await axios.get(
      `https://api.canva.com/rest/v1/designs/${designId}`,
      {
        headers: { Authorization: `Bearer ${integration.accessToken}` },
      },
    );

    // Export design pages as images
    const exportResponse = await axios.post(
      `https://api.canva.com/rest/v1/designs/${designId}/exports`,
      { format: 'png', pages: 'all' },
      {
        headers: { Authorization: `Bearer ${integration.accessToken}` },
      },
    );

    const design = designResponse.data as { title: string };
    const pages = (exportResponse.data as { urls: string[] }).urls || [];

    return {
      title: design.title,
      slides: pages.map((url, index) => ({
        order: index,
        content: {
          type: 'imported',
          source: 'canva',
          imageUrl: url,
        },
      })),
    };
  }

  // ============================================
  // MIRO INTEGRATION
  // ============================================

  /**
   * Get Miro OAuth URL
   */
  getMiroAuthUrl(userId: string): string {
    const clientId = this.configService.get<string>('MIRO_CLIENT_ID');
    const redirectUri = `${this.configService.get('API_URL')}/api/integrations/miro/callback`;
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    return `https://miro.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  }

  /**
   * Exchange Miro code for tokens
   */
  async exchangeMiroCode(code: string, state: string) {
    const clientId = this.configService.get<string>('MIRO_CLIENT_ID');
    const clientSecret = this.configService.get<string>('MIRO_CLIENT_SECRET');
    const redirectUri = `${this.configService.get('API_URL')}/api/integrations/miro/callback`;

    const stateData = JSON.parse(Buffer.from(state, 'base64').toString()) as {
      userId: string;
    };
    const userId = stateData.userId;

    const response = await axios.post(
      'https://api.miro.com/v1/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId!,
        client_secret: clientSecret!,
        code,
        redirect_uri: redirectUri,
      }),
    );

    const data = response.data as MiroTokenResponse;

    await this.prisma.integration.upsert({
      where: {
        userId_provider: { userId, provider: 'MIRO' as IntegrationProvider },
      },
      update: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000)
          : null,
        isActive: true,
      },
      create: {
        userId,
        provider: 'MIRO' as IntegrationProvider,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000)
          : null,
      },
    });

    return { success: true };
  }

  /**
   * Get user's Miro boards
   */
  async getMiroBoards(userId: string) {
    const integration = await this.prisma.integration.findUnique({
      where: {
        userId_provider: { userId, provider: 'MIRO' as IntegrationProvider },
      },
    });

    if (!integration) {
      throw new BadRequestException('Miro not connected');
    }

    const response = await axios.get('https://api.miro.com/v2/boards', {
      headers: { Authorization: `Bearer ${integration.accessToken}` },
    });

    return (response.data as MiroBoardListResponse).data.map((board) => ({
      id: board.id,
      name: board.name,
      description: board.description,
      viewLink: board.viewLink,
      createdAt: board.createdAt,
      modifiedAt: board.modifiedAt,
    }));
  }

  /**
   * Import Miro board content
   */
  async importMiroBoard(userId: string, boardId: string) {
    const integration = await this.prisma.integration.findUnique({
      where: {
        userId_provider: { userId, provider: 'MIRO' as IntegrationProvider },
      },
    });

    if (!integration) {
      throw new BadRequestException('Miro not connected');
    }

    // Get board items
    const itemsResponse = await axios.get(
      `https://api.miro.com/v2/boards/${boardId}/items`,
      {
        headers: { Authorization: `Bearer ${integration.accessToken}` },
      },
    );

    const items = (itemsResponse.data as { data: Record<string, any>[] }).data;

    // Group items by frames or create slides from sticky notes
    const slides = this.convertMiroItemsToSlides(items);

    return {
      title: `Imported from Miro`,
      slides,
    };
  }

  private convertMiroItemsToSlides(items: Record<string, any>[]) {
    const slides: Array<{
      order: number;
      content: {
        title: string;
        blocks: any[];
      };
    }> = [];
    const frames = items.filter((i) => i.type === 'frame');
    const stickyNotes = items.filter((i) => i.type === 'sticky_note');
    // const textItems = items.filter((i) => i.type === 'text');

    // Convert frames to slides
    frames.forEach((frame, index) => {
      const data = frame.data as { title?: string } | undefined;
      slides.push({
        order: index,
        content: {
          title: data?.title || `Slide ${index + 1}`,
          blocks: [],
        },
      });
    });

    // If no frames, create slides from sticky notes
    if (frames.length === 0 && stickyNotes.length > 0) {
      stickyNotes.forEach((note, index) => {
        const data = note.data as { content?: string } | undefined;
        slides.push({
          order: index,
          content: {
            title: data?.content?.substring(0, 50) || `Note ${index + 1}`,
            blocks: [
              {
                type: 'PARAGRAPH',
                content: { text: data?.content || '' },
              },
            ],
          },
        });
      });
    }

    return slides;
  }

  /**
   * Export presentation to Miro board
   */
  async exportToMiro(userId: string, projectId: string) {
    const integration = await this.prisma.integration.findUnique({
      where: {
        userId_provider: { userId, provider: 'MIRO' as IntegrationProvider },
      },
    });

    if (!integration) {
      throw new BadRequestException('Miro not connected');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        slides: {
          include: { blocks: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!project) {
      throw new BadRequestException('Project not found');
    }

    // Create a new Miro board
    const boardResponse = await axios.post(
      'https://api.miro.com/v2/boards',
      {
        name: project.title,
        description:
          project.description || 'Exported from Presentation Designer',
      },
      {
        headers: { Authorization: `Bearer ${integration.accessToken}` },
      },
    );

    const data = boardResponse.data as { id: string; viewLink: string };
    const boardId = data.id;

    // Create frames for each slide
    for (let i = 0; i < project.slides.length; i++) {
      // const slide = project.slides[i];
      await axios.post(
        `https://api.miro.com/v2/boards/${boardId}/frames`,
        {
          data: {
            title: `Slide ${i + 1}`,
          },
          position: {
            x: i * 1200,
            y: 0,
          },
          geometry: {
            width: 1000,
            height: 750,
          },
        },
        {
          headers: { Authorization: `Bearer ${integration.accessToken}` },
        },
      );
    }

    return {
      success: true,
      boardId,
      boardUrl: data.viewLink,
    };
  }

  // ============================================
  // WEBHOOK SYSTEM
  // ============================================

  /**
   * Register a new webhook
   */
  async registerWebhook(
    userId: string,
    url: string,
    events: string[],
  ): Promise<WebhookConfig> {
    const crypto = await import('crypto');
    const secret = crypto.randomBytes(32).toString('hex');
    const id = crypto.randomUUID();

    const webhook: WebhookConfig = {
      id,
      userId,
      url,
      events,
      secret,
      isActive: true,
      createdAt: new Date(),
    };

    // Store webhook (in production, use database)
    const userWebhooks = this.webhooks.get(userId) || [];
    userWebhooks.push(webhook);
    this.webhooks.set(userId, userWebhooks);

    this.logger.log(`Webhook registered for user ${userId}: ${url}`);

    return webhook;
  }

  /**
   * List user's webhooks
   */
  listWebhooks(userId: string): Promise<Omit<WebhookConfig, 'secret'>[]> {
    const webhooks = this.webhooks.get(userId) || [];
    return Promise.resolve(
      webhooks.map(({ secret: _secret, ...rest }) => rest),
    );
  }

  /**
   * Delete a webhook
   */
  deleteWebhook(userId: string, webhookId: string): Promise<boolean> {
    const userWebhooks = this.webhooks.get(userId) || [];
    const index = userWebhooks.findIndex((w) => w.id === webhookId);

    if (index === -1) return Promise.resolve(false);

    userWebhooks.splice(index, 1);
    this.webhooks.set(userId, userWebhooks);

    return Promise.resolve(true);
  }

  /**
   * Trigger webhooks for an event
   */
  async triggerWebhooks(
    userId: string,
    event: string,
    data: unknown,
  ): Promise<void> {
    const userWebhooks = this.webhooks.get(userId) || [];
    const applicableWebhooks = userWebhooks.filter(
      (w) => w.isActive && w.events.includes(event),
    );

    const payload: WebhookPayload = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };

    for (const webhook of applicableWebhooks) {
      try {
        const crypto = await import('crypto');
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(JSON.stringify(payload))
          .digest('hex');

        await axios.post(webhook.url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event,
          },
          timeout: 10000,
        });

        this.logger.log(`Webhook delivered: ${event} to ${webhook.url}`);
      } catch (error) {
        this.logger.error(
          `Webhook delivery failed: ${event} to ${webhook.url}`,
          error,
        );
      }
    }
  }

  // ============================================
  // SUPPORTED WEBHOOK EVENTS
  // ============================================

  getSupportedEvents(): string[] {
    return [
      'project.created',
      'project.updated',
      'project.deleted',
      'project.published',
      'slide.created',
      'slide.updated',
      'slide.deleted',
      'export.completed',
      'ai.generation.completed',
      'collaboration.joined',
      'collaboration.left',
      'analytics.milestone',
    ];
  }
}
