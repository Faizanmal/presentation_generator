import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import axios from 'axios';

type IntegrationProvider =
  | 'ZOOM'
  | 'SLACK'
  | 'TEAMS'
  | 'GOOGLE_DRIVE'
  | 'FIGMA'
  | 'NOTION'
  | 'DROPBOX';

interface OAuthCallbackData {
  code: string;
  state?: string;
}

interface IntegrationConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

interface LocalIntegration {
  id: string;
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | Date | null;
  [key: string]: unknown;
}

interface NotionRichText {
  plain_text: string;
  [key: string]: unknown;
}

interface NotionBlock {
  type: string;
  heading_1?: { rich_text: NotionRichText[] };
  heading_2?: { rich_text: NotionRichText[] };
  paragraph?: { rich_text: NotionRichText[] };
  bulleted_list_item?: { rich_text: NotionRichText[] };
  numbered_list_item?: { rich_text: NotionRichText[] };
  image?: {
    file?: { url: string };
    external?: { url: string };
  };
  [key: string]: unknown;
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);
  private readonly integrationConfigs: Map<
    IntegrationProvider,
    IntegrationConfig
  >;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.integrationConfigs = new Map([
      [
        'ZOOM',
        {
          clientId: this.configService.get<string>('ZOOM_CLIENT_ID') || '',
          clientSecret:
            this.configService.get<string>('ZOOM_CLIENT_SECRET') || '',
          redirectUri: `${this.configService.get<string>('API_URL')}/api/integrations/zoom/callback`,
          scopes: ['meeting:write', 'user:read'],
        },
      ],
      [
        'SLACK',
        {
          clientId: this.configService.get<string>('SLACK_CLIENT_ID') || '',
          clientSecret:
            this.configService.get<string>('SLACK_CLIENT_SECRET') || '',
          redirectUri: `${this.configService.get<string>('API_URL')}/api/integrations/slack/callback`,
          scopes: ['chat:write', 'channels:read', 'users:read'],
        },
      ],
      [
        'TEAMS',
        {
          clientId: this.configService.get<string>('TEAMS_CLIENT_ID') || '',
          clientSecret:
            this.configService.get<string>('TEAMS_CLIENT_SECRET') || '',
          redirectUri: `${this.configService.get<string>('API_URL')}/api/integrations/teams/callback`,
          scopes: ['Chat.ReadWrite', 'ChannelMessage.Send'],
        },
      ],
      [
        'GOOGLE_DRIVE',
        {
          clientId: this.configService.get<string>('GOOGLE_CLIENT_ID') || '',
          clientSecret:
            this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '',
          redirectUri: `${this.configService.get<string>('API_URL')}/api/integrations/google-drive/callback`,
          scopes: [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/drive.readonly',
          ],
        },
      ],
      [
        'FIGMA',
        {
          clientId: this.configService.get<string>('FIGMA_CLIENT_ID') || '',
          clientSecret:
            this.configService.get<string>('FIGMA_CLIENT_SECRET') || '',
          redirectUri: `${this.configService.get<string>('API_URL')}/api/integrations/figma/callback`,
          scopes: ['file_read'],
        },
      ],
      [
        'NOTION',
        {
          clientId: this.configService.get<string>('NOTION_CLIENT_ID') || '',
          clientSecret:
            this.configService.get<string>('NOTION_CLIENT_SECRET') || '',
          redirectUri: `${this.configService.get<string>('API_URL')}/api/integrations/notion/callback`,
          scopes: [],
        },
      ],
    ]);
  }

  // ============================================
  // OAUTH FLOW
  // ============================================

  /**
   * Get OAuth authorization URL for a provider
   */
  getAuthUrl(provider: IntegrationProvider, userId: string): string {
    const config = this.integrationConfigs.get(provider);
    if (!config) {
      throw new BadRequestException(`Unknown provider: ${provider}`);
    }

    const state = Buffer.from(JSON.stringify({ userId, provider })).toString(
      'base64',
    );

    switch (provider) {
      case 'ZOOM':
        return `https://zoom.us/oauth/authorize?response_type=code&client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&state=${state}`;

      case 'SLACK':
        return `https://slack.com/oauth/v2/authorize?client_id=${config.clientId}&scope=${config.scopes.join(',')}&redirect_uri=${encodeURIComponent(config.redirectUri)}&state=${state}`;

      case 'TEAMS':
        return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${config.clientId}&scope=${config.scopes.join(' ')}&redirect_uri=${encodeURIComponent(config.redirectUri)}&response_type=code&state=${state}`;

      case 'GOOGLE_DRIVE':
        return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&scope=${encodeURIComponent(config.scopes.join(' '))}&response_type=code&access_type=offline&state=${state}`;

      case 'FIGMA':
        return `https://www.figma.com/oauth?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&scope=${config.scopes.join(',')}&state=${state}&response_type=code`;

      case 'NOTION':
        return `https://api.notion.com/v1/oauth/authorize?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&response_type=code&state=${state}`;

      default:
        throw new BadRequestException(`OAuth not supported for ${provider}`);
    }
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleOAuthCallback(
    provider: IntegrationProvider,
    data: OAuthCallbackData,
  ) {
    const config = this.integrationConfigs.get(provider);
    if (!config) {
      throw new BadRequestException(`Unknown provider: ${provider}`);
    }

    // Decode state to get userId
    const stateRaw = Buffer.from(data.state || '', 'base64').toString();
    let stateData: unknown;
    try {
      stateData = JSON.parse(stateRaw) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid state parameter');
    }

    const userId =
      stateData &&
      typeof stateData === 'object' &&
      typeof (stateData as Record<string, unknown>).userId === 'string'
        ? ((stateData as Record<string, unknown>).userId as string)
        : undefined;

    if (!userId) {
      throw new BadRequestException('Invalid state parameter');
    }

    // Exchange code for tokens
    let tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresIn?: number;
      metadata?: Record<string, unknown> | undefined;
    };

    switch (provider) {
      case 'ZOOM':
        tokens = await this.exchangeZoomCode(data.code, config);
        break;
      case 'SLACK':
        tokens = await this.exchangeSlackCode(data.code, config);
        break;
      case 'TEAMS':
        tokens = await this.exchangeTeamsCode(data.code, config);
        break;
      case 'GOOGLE_DRIVE':
        tokens = await this.exchangeGoogleCode(data.code, config);
        break;
      case 'FIGMA':
        tokens = await this.exchangeFigmaCode(data.code, config);
        break;
      case 'NOTION':
        tokens = await this.exchangeNotionCode(data.code, config);
        break;
      default:
        throw new BadRequestException(
          `Token exchange not implemented for ${provider}`,
        );
    }

    // Store integration
    const expiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : null;

    const safeMetadata =
      tokens.metadata && typeof tokens.metadata === 'object'
        ? tokens.metadata
        : undefined;

    await this.prisma.integration.upsert({
      where: {
        userId_provider: { userId, provider },
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
        metadata: safeMetadata as unknown as Prisma.InputJsonValue,
        isActive: true,
      },
      create: {
        userId,
        provider,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
        metadata: safeMetadata as unknown as Prisma.InputJsonValue,
      },
    });

    return { success: true, provider };
  }

  // ============================================
  // TOKEN EXCHANGE IMPLEMENTATIONS
  // ============================================

  private async exchangeZoomCode(code: string, config: IntegrationConfig) {
    const response = await axios.post(
      'https://zoom.us/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      }),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    const data = response.data as Record<string, unknown>;

    const accessToken =
      typeof data.access_token === 'string' ? data.access_token : undefined;
    const refreshToken =
      typeof data.refresh_token === 'string' ? data.refresh_token : undefined;
    const expiresIn =
      typeof data.expires_in === 'number'
        ? data.expires_in
        : typeof data.expires_in === 'string'
          ? parseInt(data.expires_in, 10)
          : undefined;

    if (!accessToken)
      throw new BadRequestException('Invalid Zoom token response');

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  private async exchangeSlackCode(code: string, config: IntegrationConfig) {
    const response = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      }),
    );

    const data = response.data as Record<string, unknown>;

    const accessToken =
      typeof data.access_token === 'string' ? data.access_token : undefined;
    const team =
      data.team && typeof data.team === 'object' ? data.team : undefined;
    const botUserId =
      typeof data.bot_user_id === 'string' ? data.bot_user_id : undefined;

    if (!accessToken)
      throw new BadRequestException('Invalid Slack token response');

    return {
      accessToken,
      metadata: {
        team,
        botUserId,
      },
    };
  }

  private async exchangeTeamsCode(code: string, config: IntegrationConfig) {
    const response = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
        scope: config.scopes.join(' '),
      }),
    );

    const data = response.data as Record<string, unknown>;

    const accessToken =
      typeof data.access_token === 'string' ? data.access_token : undefined;
    const refreshToken =
      typeof data.refresh_token === 'string' ? data.refresh_token : undefined;
    const expiresIn =
      typeof data.expires_in === 'number'
        ? data.expires_in
        : typeof data.expires_in === 'string'
          ? parseInt(data.expires_in, 10)
          : undefined;

    if (!accessToken)
      throw new BadRequestException('Invalid Teams token response');

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  private async exchangeGoogleCode(code: string, config: IntegrationConfig) {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    });

    const data = response.data as Record<string, unknown>;

    const accessToken =
      typeof data.access_token === 'string' ? data.access_token : undefined;
    const refreshToken =
      typeof data.refresh_token === 'string' ? data.refresh_token : undefined;
    const expiresIn =
      typeof data.expires_in === 'number'
        ? data.expires_in
        : typeof data.expires_in === 'string'
          ? parseInt(data.expires_in, 10)
          : undefined;

    if (!accessToken)
      throw new BadRequestException('Invalid Google token response');

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  private async exchangeFigmaCode(code: string, config: IntegrationConfig) {
    const response = await axios.post(
      'https://www.figma.com/api/oauth/token',
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code,
        grant_type: 'authorization_code',
      }),
    );

    const data = response.data as Record<string, unknown>;

    const accessToken =
      typeof data.access_token === 'string' ? data.access_token : undefined;
    const refreshToken =
      typeof data.refresh_token === 'string' ? data.refresh_token : undefined;
    const expiresIn =
      typeof data.expires_in === 'number'
        ? data.expires_in
        : typeof data.expires_in === 'string'
          ? parseInt(data.expires_in, 10)
          : undefined;

    if (!accessToken)
      throw new BadRequestException('Invalid Figma token response');

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  private async exchangeNotionCode(code: string, config: IntegrationConfig) {
    const response = await axios.post(
      'https://api.notion.com/v1/oauth/token',
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const data = response.data as Record<string, unknown>;

    const accessToken =
      typeof data.access_token === 'string' ? data.access_token : undefined;
    const workspace =
      typeof data.workspace_name === 'string' ? data.workspace_name : undefined;
    const workspaceId =
      typeof data.workspace_id === 'string' ? data.workspace_id : undefined;

    if (!accessToken)
      throw new BadRequestException('Invalid Notion token response');

    return {
      accessToken,
      metadata: {
        workspace,
        workspaceId,
      },
    };
  }

  // ============================================
  // INTEGRATION MANAGEMENT
  // ============================================

  async getUserIntegrations(userId: string) {
    return this.prisma.integration.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        provider: true,
        isActive: true,
        createdAt: true,
        metadata: true,
      },
    });
  }

  async getIntegration(userId: string, provider: IntegrationProvider) {
    return this.prisma.integration.findUnique({
      where: {
        userId_provider: { userId, provider },
      },
    });
  }

  async disconnectIntegration(userId: string, provider: IntegrationProvider) {
    return this.prisma.integration.update({
      where: {
        userId_provider: { userId, provider },
      },
      data: { isActive: false },
    });
  }

  // ============================================
  // INTEGRATION ACTIONS
  // ============================================

  /**
   * Create a Zoom meeting for a presentation
   */
  async createZoomMeeting(
    userId: string,
    _projectId: string,
    topic: string,
    startTime?: Date,
  ) {
    const integrationRaw = await this.getIntegration(userId, 'ZOOM');
    if (!integrationRaw) {
      throw new BadRequestException('Zoom not connected');
    }
    this.assertIntegration(integrationRaw);
    const integration = integrationRaw;

    const accessToken = await this.ensureValidToken(integration);

    const response = await axios.post(
      'https://api.zoom.us/v2/users/me/meetings',
      {
        topic,
        type: startTime ? 2 : 1, // 2 = scheduled, 1 = instant
        start_time: startTime?.toISOString(),
        duration: 60,
        settings: {
          join_before_host: true,
          mute_upon_entry: true,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const d = response.data as Record<string, unknown>;
    return {
      meetingId:
        typeof d.id === 'string' || typeof d.id === 'number'
          ? String(d.id)
          : undefined,
      joinUrl: typeof d.join_url === 'string' ? d.join_url : undefined,
      startUrl: typeof d.start_url === 'string' ? d.start_url : undefined,
      password: typeof d.password === 'string' ? d.password : undefined,
    };
  }

  /**
   * Send a Slack message with presentation link
   */
  async sendSlackMessage(
    userId: string,
    channel: string,
    message: string,
    presentationUrl: string,
  ) {
    const integration = await this.getIntegration(userId, 'SLACK');
    if (!integration) {
      throw new BadRequestException('Slack not connected');
    }

    const response = await axios.post(
      'https://slack.com/api/chat.postMessage',
      {
        channel,
        text: message,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: message,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'View Presentation',
                },
                url: presentationUrl,
                style: 'primary',
              },
            ],
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const d = response.data as Record<string, unknown>;
    return {
      success: Boolean(d.ok),
      messageTs: typeof d.ts === 'string' ? d.ts : undefined,
    };
  }

  /**
   * Get Slack channels for selection
   */
  async getSlackChannels(userId: string) {
    const integrationRaw = await this.getIntegration(userId, 'SLACK');
    if (!integrationRaw) {
      throw new BadRequestException('Slack not connected');
    }
    this.assertIntegration(integrationRaw);
    const integration = integrationRaw;

    const response = await axios.get(
      'https://slack.com/api/conversations.list',
      {
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
        },
        params: {
          types: 'public_channel,private_channel',
          limit: 100,
        },
      },
    );

    const data = response.data as Record<string, unknown>;
    const channelsRaw = data.channels;
    if (!Array.isArray(channelsRaw)) return [];

    const channels: Array<{ id: string; name: string; isPrivate: boolean }> =
      [];
    channelsRaw.forEach((ch) => {
      if (!ch || typeof ch !== 'object') return;
      const obj = ch as Record<string, unknown>;
      const id = typeof obj.id === 'string' ? obj.id : undefined;
      const name = typeof obj.name === 'string' ? obj.name : undefined;
      const isPrivate = obj.is_private ?? obj.isPrivate ?? false;
      if (id && name)
        channels.push({ id, name, isPrivate: Boolean(isPrivate) });
    });

    return channels;
  }

  /**
   * Import content from Notion page
   */
  async importFromNotion(userId: string, pageId: string) {
    const integration = await this.getIntegration(userId, 'NOTION');
    if (!integration) {
      throw new BadRequestException('Notion not connected');
    }

    const response = await axios.get(
      `https://api.notion.com/v1/blocks/${pageId}/children`,
      {
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
          'Notion-Version': '2022-06-28',
        },
      },
    );

    // Parse Notion blocks to presentation format
    const results = (response.data as Record<string, unknown>).results;
    return Array.isArray(results) ? this.parseNotionBlocks(results) : [];
  }

  /**
   * Get Figma file data for import
   */
  async getFigmaFile(userId: string, fileKey: string) {
    const integrationRaw = await this.getIntegration(userId, 'FIGMA');
    if (!integrationRaw) {
      throw new BadRequestException('Figma not connected');
    }
    this.assertIntegration(integrationRaw);
    const integration = integrationRaw;

    const response = await axios.get(
      `https://api.figma.com/v1/files/${fileKey}`,
      {
        headers: {
          'X-Figma-Token': integration.accessToken,
        },
      },
    );

    const data = response.data as Record<string, unknown>;
    const pagesRaw =
      data.document && (data.document as Record<string, unknown>).children;
    const pages: Array<{ id: string; name: string; type: string }> = [];
    if (Array.isArray(pagesRaw)) {
      pagesRaw.forEach((p) => {
        if (!p || typeof p !== 'object') return;
        const page = p as Record<string, unknown>;
        const id = typeof page.id === 'string' ? page.id : undefined;
        const name = typeof page.name === 'string' ? page.name : undefined;
        const type = typeof page.type === 'string' ? page.type : undefined;
        if (id && name && type) pages.push({ id, name, type });
      });
    }

    return {
      name: typeof data.name === 'string' ? data.name : undefined,
      lastModified:
        typeof data.lastModified === 'string' ? data.lastModified : undefined,
      thumbnailUrl:
        typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : undefined,
      pages,
    };
  }

  /**
   * Export images from Figma frames
   */
  async exportFigmaFrames(userId: string, fileKey: string, nodeIds: string[]) {
    const integration = await this.getIntegration(userId, 'FIGMA');
    if (!integration) {
      throw new BadRequestException('Figma not connected');
    }

    const response = await axios.get(
      `https://api.figma.com/v1/images/${fileKey}`,
      {
        headers: {
          'X-Figma-Token': integration.accessToken,
        },
        params: {
          ids: nodeIds.join(','),
          format: 'png',
          scale: 2,
        },
      },
    );

    const data = response.data as Record<string, unknown>;
    const images =
      data.images && typeof data.images === 'object'
        ? (data.images as Record<string, unknown>)
        : {};
    const result: Record<string, string> = {};
    Object.keys(images).forEach((k) => {
      const v = images[k];
      if (typeof v === 'string') result[k] = v;
    });

    return result;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private assertIntegration(
    integration: unknown,
  ): asserts integration is LocalIntegration {
    if (!integration || typeof integration !== 'object') {
      throw new BadRequestException('Integration not found');
    }
    const i = integration as Record<string, unknown>;
    if (typeof i.accessToken !== 'string') {
      throw new BadRequestException('Integration access token missing');
    }
  }

  private async ensureValidToken(
    integration: LocalIntegration,
  ): Promise<string> {
    // Check if token is expired
    if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
      // Refresh token
      if (integration.refreshToken) {
        const newTokens = await this.refreshToken(
          integration.provider,
          String(integration.refreshToken),
        );

        await this.prisma.integration.update({
          where: { id: integration.id },
          data: {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            expiresAt: newTokens.expiresAt,
          },
        });

        return newTokens.accessToken;
      }
      throw new BadRequestException('Token expired, please reconnect');
    }

    return integration.accessToken;
  }

  private async refreshToken(
    provider: IntegrationProvider,
    refreshToken: string,
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date | undefined;
  }> {
    const config = this.integrationConfigs.get(provider);
    if (!config) {
      throw new BadRequestException(`Unknown provider: ${provider}`);
    }

    switch (provider) {
      case 'ZOOM': {
        const response = await axios.post(
          'https://zoom.us/oauth/token',
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }),
          {
            headers: {
              Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        );
        const data = response.data as Record<string, unknown>;
        const accessToken =
          typeof data.access_token === 'string' ? data.access_token : undefined;
        const refreshTok =
          typeof data.refresh_token === 'string'
            ? data.refresh_token
            : undefined;
        const expiresIn =
          typeof data.expires_in === 'number'
            ? data.expires_in
            : typeof data.expires_in === 'string'
              ? parseInt(data.expires_in, 10)
              : undefined;
        if (!accessToken)
          throw new BadRequestException('Invalid Zoom refresh response');
        return {
          accessToken,
          refreshToken: refreshTok,
          expiresAt: expiresIn
            ? new Date(Date.now() + expiresIn * 1000)
            : undefined,
        };
      }
      // Add other provider refresh implementations as needed
      default:
        throw new BadRequestException(
          `Token refresh not implemented for ${provider}`,
        );
    }
  }

  private parseNotionBlocks(blocks: unknown[]) {
    if (!Array.isArray(blocks)) return [];

    return blocks
      .map((block) => {
        if (!block || typeof block !== 'object') return null;
        const b = block as NotionBlock;

        switch (b.type) {
          case 'heading_1': {
            const rich = b.heading_1?.rich_text;
            return { type: 'HEADING', content: this.extractNotionText(rich) };
          }
          case 'heading_2': {
            const rich = b.heading_2?.rich_text;
            return {
              type: 'SUBHEADING',
              content: this.extractNotionText(rich),
            };
          }
          case 'paragraph': {
            const rich = b.paragraph?.rich_text;
            return { type: 'PARAGRAPH', content: this.extractNotionText(rich) };
          }
          case 'bulleted_list_item': {
            const rich = b.bulleted_list_item?.rich_text;
            return {
              type: 'BULLET_LIST',
              content: this.extractNotionText(rich),
            };
          }
          case 'numbered_list_item': {
            const rich = b.numbered_list_item?.rich_text;
            return {
              type: 'NUMBERED_LIST',
              content: this.extractNotionText(rich),
            };
          }
          case 'image': {
            const img = b.image;
            const url = img?.file?.url || img?.external?.url;
            return {
              type: 'IMAGE',
              content: typeof url === 'string' ? url : undefined,
            };
          }
          default:
            return null;
        }
      })
      .filter(Boolean);
  }

  private extractNotionText(richText: NotionRichText[] | undefined) {
    if (!Array.isArray(richText)) return '';
    return richText.map((t) => t.plain_text || '').join('');
  }
}
