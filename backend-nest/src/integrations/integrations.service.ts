import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
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
    const stateData = JSON.parse(
      Buffer.from(data.state || '', 'base64').toString(),
    );
    const userId = stateData.userId;

    if (!userId) {
      throw new BadRequestException('Invalid state parameter');
    }

    // Exchange code for tokens
    let tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresIn?: number;
      metadata?: any;
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

    await this.prisma.integration.upsert({
      where: {
        userId_provider: { userId, provider },
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
        metadata: tokens.metadata,
        isActive: true,
      },
      create: {
        userId,
        provider,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
        metadata: tokens.metadata,
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

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
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

    return {
      accessToken: response.data.access_token,
      metadata: {
        team: response.data.team,
        botUserId: response.data.bot_user_id,
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

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
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

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
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

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
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

    return {
      accessToken: response.data.access_token,
      metadata: {
        workspace: response.data.workspace_name,
        workspaceId: response.data.workspace_id,
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
    projectId: string,
    topic: string,
    startTime?: Date,
  ) {
    const integration = await this.getIntegration(userId, 'ZOOM');
    if (!integration) {
      throw new BadRequestException('Zoom not connected');
    }

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

    return {
      meetingId: response.data.id,
      joinUrl: response.data.join_url,
      startUrl: response.data.start_url,
      password: response.data.password,
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

    return { success: response.data.ok, messageTs: response.data.ts };
  }

  /**
   * Get Slack channels for selection
   */
  async getSlackChannels(userId: string) {
    const integration = await this.getIntegration(userId, 'SLACK');
    if (!integration) {
      throw new BadRequestException('Slack not connected');
    }

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

    return (
      response.data.channels?.map((c: any) => ({
        id: c.id,
        name: c.name,
        isPrivate: c.is_private,
      })) || []
    );
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
    return this.parseNotionBlocks(response.data.results);
  }

  /**
   * Get Figma file data for import
   */
  async getFigmaFile(userId: string, fileKey: string) {
    const integration = await this.getIntegration(userId, 'FIGMA');
    if (!integration) {
      throw new BadRequestException('Figma not connected');
    }

    const response = await axios.get(
      `https://api.figma.com/v1/files/${fileKey}`,
      {
        headers: {
          'X-Figma-Token': integration.accessToken,
        },
      },
    );

    return {
      name: response.data.name,
      lastModified: response.data.lastModified,
      thumbnailUrl: response.data.thumbnailUrl,
      pages: response.data.document.children.map((page: any) => ({
        id: page.id,
        name: page.name,
        type: page.type,
      })),
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

    return response.data.images;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async ensureValidToken(integration: any): Promise<string> {
    // Check if token is expired
    if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
      // Refresh token
      if (integration.refreshToken) {
        const newTokens = await this.refreshToken(
          integration.provider,
          integration.refreshToken,
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
  ) {
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
        return {
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
        };
      }
      // Add other provider refresh implementations as needed
      default:
        throw new BadRequestException(
          `Token refresh not implemented for ${provider}`,
        );
    }
  }

  private parseNotionBlocks(blocks: any[]) {
    return blocks
      .map((block) => {
        switch (block.type) {
          case 'heading_1':
            return {
              type: 'HEADING',
              content: this.extractNotionText(block.heading_1.rich_text),
            };
          case 'heading_2':
            return {
              type: 'SUBHEADING',
              content: this.extractNotionText(block.heading_2.rich_text),
            };
          case 'paragraph':
            return {
              type: 'PARAGRAPH',
              content: this.extractNotionText(block.paragraph.rich_text),
            };
          case 'bulleted_list_item':
            return {
              type: 'BULLET_LIST',
              content: this.extractNotionText(
                block.bulleted_list_item.rich_text,
              ),
            };
          case 'numbered_list_item':
            return {
              type: 'NUMBERED_LIST',
              content: this.extractNotionText(
                block.numbered_list_item.rich_text,
              ),
            };
          case 'image':
            return {
              type: 'IMAGE',
              content: block.image.file?.url || block.image.external?.url,
            };
          default:
            return null;
        }
      })
      .filter(Boolean);
  }

  private extractNotionText(richText: any[]) {
    return richText.map((t: any) => t.plain_text).join('');
  }
}
