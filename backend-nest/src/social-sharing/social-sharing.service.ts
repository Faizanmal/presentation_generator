import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as crypto from 'crypto';

// Platform-specific interfaces
interface LinkedInSharePayload {
  author: string;
  lifecycleState: string;
  specificContent: {
    'com.linkedin.ugc.ShareContent': {
      shareCommentary: { text: string };
      shareMediaCategory: string;
      media?: Array<{
        status: string;
        originalUrl: string;
        title?: { text: string };
        description?: { text: string };
      }>;
    };
  };
  visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': string };
}

interface TwitterShareResponse {
  data: { id: string; text: string };
}

interface YouTubeUploadResponse {
  id: string;
  snippet: { title: string; publishedAt: string };
}

export interface ShareResult {
  platform: 'linkedin' | 'twitter' | 'youtube' | 'facebook' | 'embed';
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
}

export interface EmbedConfig {
  width: number;
  height: number;
  autoplay: boolean;
  showControls: boolean;
  theme: 'light' | 'dark';
  allowFullscreen: boolean;
  responsive: boolean;
}

@Injectable()
export class SocialSharingService {
  private readonly logger = new Logger(SocialSharingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ============================================
  // LINKEDIN INTEGRATION
  // ============================================

  /**
   * Get LinkedIn OAuth URL for authorization
   */
  getLinkedInAuthUrl(userId: string): string {
    const clientId = this.configService.get<string>('LINKEDIN_CLIENT_ID');
    const redirectUri = `${this.configService.get('API_URL')}/api/social/linkedin/callback`;
    const state = this.generateState(userId);
    const scope = 'openid profile w_member_social';

    return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}`;
  }

  /**
   * Exchange LinkedIn authorization code for access token
   */
  async exchangeLinkedInCode(
    code: string,
    state: string,
  ): Promise<{ userId: string; accessToken: string }> {
    const userId = this.validateState(state);
    const clientId = this.configService.get<string>('LINKEDIN_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'LINKEDIN_CLIENT_SECRET',
    );
    const redirectUri = `${this.configService.get('API_URL')}/api/social/linkedin/callback`;

    const response = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId || '',
        client_secret: clientSecret || '',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    // Get user profile to get LinkedIn URN
    const profileResponse = await axios.get(
      'https://api.linkedin.com/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${response.data.access_token}` },
      },
    );

    // Store the connection
    await this.prisma.socialConnection.upsert({
      where: { userId_platform: { userId, platform: 'linkedin' } },
      update: {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
        profileId: profileResponse.data.sub,
        profileData: profileResponse.data,
        isActive: true,
      },
      create: {
        userId,
        platform: 'linkedin',
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
        profileId: profileResponse.data.sub,
        profileData: profileResponse.data,
        isActive: true,
      },
    });

    return { userId, accessToken: response.data.access_token };
  }

  /**
   * Share presentation to LinkedIn
   */
  async shareToLinkedIn(
    userId: string,
    projectId: string,
    options: {
      message?: string;
      includePreview?: boolean;
    } = {},
  ): Promise<ShareResult> {
    const connection = await this.getConnection(userId, 'linkedin');
    const project = await this.getProject(projectId, userId);
    const shareUrl = this.getPublicShareUrl(project);

    const payload: LinkedInSharePayload = {
      author: `urn:li:person:${connection.profileId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text:
              options.message || `Check out my presentation: ${project.title}`,
          },
          shareMediaCategory: options.includePreview ? 'ARTICLE' : 'NONE',
          media: options.includePreview
            ? [
                {
                  status: 'READY',
                  originalUrl: shareUrl,
                  title: { text: project.title },
                  description: {
                    text:
                      project.description ||
                      'Created with Presentation Designer',
                  },
                },
              ]
            : undefined,
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };

    try {
      const response = await axios.post(
        'https://api.linkedin.com/v2/ugcPosts',
        payload,
        {
          headers: {
            Authorization: `Bearer ${connection.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        },
      );

      await this.logShare(
        userId,
        projectId,
        'linkedin',
        true,
        response.data.id,
      );

      return {
        platform: 'linkedin',
        success: true,
        postId: response.data.id,
        url: `https://www.linkedin.com/feed/update/${response.data.id}`,
      };
    } catch (error) {
      this.logger.error('LinkedIn share failed', error);
      await this.logShare(userId, projectId, 'linkedin', false);
      return { platform: 'linkedin', success: false, error: error.message };
    }
  }

  // ============================================
  // TWITTER/X INTEGRATION
  // ============================================

  /**
   * Get Twitter OAuth 2.0 URL
   */
  getTwitterAuthUrl(userId: string): string {
    const clientId = this.configService.get<string>('TWITTER_CLIENT_ID');
    const redirectUri = `${this.configService.get('API_URL')}/api/social/twitter/callback`;
    const state = this.generateState(userId);
    const codeChallenge = this.generateCodeChallenge();

    return `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=tweet.read%20tweet.write%20users.read&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
  }

  /**
   * Share presentation to Twitter/X
   */
  async shareToTwitter(
    userId: string,
    projectId: string,
    options: {
      message?: string;
      includeImage?: boolean;
    } = {},
  ): Promise<ShareResult> {
    const connection = await this.getConnection(userId, 'twitter');
    const project = await this.getProject(projectId, userId);
    const shareUrl = this.getPublicShareUrl(project);

    const tweetText =
      options.message ||
      `📊 Check out my new presentation: "${project.title}" ${shareUrl}`;

    try {
      const response = await axios.post<TwitterShareResponse>(
        'https://api.twitter.com/2/tweets',
        { text: tweetText },
        {
          headers: {
            Authorization: `Bearer ${connection.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      await this.logShare(
        userId,
        projectId,
        'twitter',
        true,
        response.data.data.id,
      );

      return {
        platform: 'twitter',
        success: true,
        postId: response.data.data.id,
        url: `https://twitter.com/i/web/status/${response.data.data.id}`,
      };
    } catch (error) {
      this.logger.error('Twitter share failed', error);
      await this.logShare(userId, projectId, 'twitter', false);
      return { platform: 'twitter', success: false, error: error.message };
    }
  }

  // ============================================
  // YOUTUBE INTEGRATION
  // ============================================

  /**
   * Get YouTube OAuth URL
   */
  getYouTubeAuthUrl(userId: string): string {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const redirectUri = `${this.configService.get('API_URL')}/api/social/youtube/callback`;
    const state = this.generateState(userId);
    const scope =
      'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube';

    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}&access_type=offline&prompt=consent`;
  }

  /**
   * Upload presentation video to YouTube
   */
  async uploadToYouTube(
    userId: string,
    projectId: string,
    videoBuffer: Buffer,
    options: {
      title?: string;
      description?: string;
      tags?: string[];
      privacy?: 'public' | 'private' | 'unlisted';
      categoryId?: string;
    } = {},
  ): Promise<ShareResult> {
    const connection = await this.getConnection(userId, 'youtube');
    const project = await this.getProject(projectId, userId);

    const metadata = {
      snippet: {
        title: options.title || project.title,
        description:
          options.description ||
          `${project.description || ''}\n\nCreated with Presentation Designer`,
        tags: options.tags || ['presentation', 'slides'],
        categoryId: options.categoryId || '27', // Education
      },
      status: {
        privacyStatus: options.privacy || 'unlisted',
        selfDeclaredMadeForKids: false,
      },
    };

    try {
      // Initiate resumable upload
      const initResponse = await axios.post(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        metadata,
        {
          headers: {
            Authorization: `Bearer ${connection.accessToken}`,
            'Content-Type': 'application/json',
            'X-Upload-Content-Type': 'video/mp4',
            'X-Upload-Content-Length': videoBuffer.length.toString(),
          },
        },
      );

      const uploadUrl = initResponse.headers['location'];

      // Upload the video
      const uploadResponse = await axios.put<YouTubeUploadResponse>(
        uploadUrl,
        videoBuffer,
        {
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': videoBuffer.length.toString(),
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        },
      );

      await this.logShare(
        userId,
        projectId,
        'youtube',
        true,
        uploadResponse.data.id,
      );

      return {
        platform: 'youtube',
        success: true,
        postId: uploadResponse.data.id,
        url: `https://www.youtube.com/watch?v=${uploadResponse.data.id}`,
      };
    } catch (error) {
      this.logger.error('YouTube upload failed', error);
      await this.logShare(userId, projectId, 'youtube', false);
      return { platform: 'youtube', success: false, error: error.message };
    }
  }

  // ============================================
  // EMBED CODE GENERATION
  // ============================================

  /**
   * Generate embed code for website integration
   */
  generateEmbedCode(
    projectId: string,
    config: Partial<EmbedConfig> = {},
  ): { html: string; iframe: string; script: string } {
    const baseUrl = this.configService.get<string>('FRONTEND_URL');
    const defaultConfig: EmbedConfig = {
      width: 800,
      height: 600,
      autoplay: false,
      showControls: true,
      theme: 'light',
      allowFullscreen: true,
      responsive: true,
      ...config,
    };

    const embedUrl = `${baseUrl}/embed/${projectId}`;
    const params = new URLSearchParams({
      autoplay: defaultConfig.autoplay.toString(),
      controls: defaultConfig.showControls.toString(),
      theme: defaultConfig.theme,
    });

    const iframeCode = `<iframe 
  src="${embedUrl}?${params}" 
  width="${defaultConfig.responsive ? '100%' : defaultConfig.width}" 
  height="${defaultConfig.height}" 
  frameborder="0" 
  ${defaultConfig.allowFullscreen ? 'allowfullscreen' : ''}
  loading="lazy"
  title="Presentation"
></iframe>`;

    const responsiveWrapper = defaultConfig.responsive
      ? `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
  <iframe 
    src="${embedUrl}?${params}" 
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
    frameborder="0" 
    ${defaultConfig.allowFullscreen ? 'allowfullscreen' : ''}
    loading="lazy"
    title="Presentation"
  ></iframe>
</div>`
      : iframeCode;

    const scriptEmbed = `<div id="pd-embed-${projectId}"></div>
<script src="${baseUrl}/embed.js" data-presentation-id="${projectId}" data-config='${JSON.stringify(defaultConfig)}'></script>`;

    return {
      html: responsiveWrapper,
      iframe: iframeCode,
      script: scriptEmbed,
    };
  }

  /**
   * Generate OG (Open Graph) metadata for social preview
   */
  async generateSocialPreview(projectId: string): Promise<{
    title: string;
    description: string;
    image: string;
    url: string;
    type: string;
    siteName: string;
  }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { slides: { take: 1, orderBy: { order: 'asc' } } },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const baseUrl = this.configService.get<string>('FRONTEND_URL');
    const firstSlide = project.slides?.[0];
    const thumbnailUrl =
      firstSlide?.thumbnailUrl || `${baseUrl}/api/thumbnails/${projectId}`;

    return {
      title: project.title,
      description: project.description || 'Created with Presentation Designer',
      image: thumbnailUrl,
      url: `${baseUrl}/present/${projectId}`,
      type: 'article',
      siteName: 'Presentation Designer',
    };
  }

  // ============================================
  // QUICK SHARE LINKS
  // ============================================

  /**
   * Generate quick share links for all platforms
   */
  async getQuickShareLinks(
    projectId: string,
    userId: string,
  ): Promise<Record<string, string>> {
    const project = await this.getProject(projectId, userId);
    const shareUrl = encodeURIComponent(this.getPublicShareUrl(project));
    const title = encodeURIComponent(project.title);
    const description = encodeURIComponent(
      project.description || 'Check out this presentation',
    );

    return {
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${shareUrl}&text=${title}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
      whatsapp: `https://wa.me/?text=${title}%20${shareUrl}`,
      telegram: `https://t.me/share/url?url=${shareUrl}&text=${title}`,
      email: `mailto:?subject=${title}&body=${description}%0A%0A${shareUrl}`,
      reddit: `https://reddit.com/submit?url=${shareUrl}&title=${title}`,
      pinterest: `https://pinterest.com/pin/create/button/?url=${shareUrl}&description=${title}`,
      slack: `https://slack.com/share?url=${shareUrl}&text=${title}`,
    };
  }

  /**
   * Create short shareable link
   */
  async createShortLink(projectId: string, userId: string): Promise<string> {
    const project = await this.getProject(projectId, userId);
    const shortCode = this.generateShortCode();

    await this.prisma.shareLink.create({
      data: {
        projectId,
        shortCode,
        originalUrl: this.getPublicShareUrl(project),
        createdBy: userId,
        expiresAt: null, // No expiration by default
      },
    });

    const baseUrl = this.configService.get<string>('FRONTEND_URL');
    return `${baseUrl}/s/${shortCode}`;
  }

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * Get sharing analytics for a project
   */
  async getShareAnalytics(projectId: string, userId: string) {
    await this.getProject(projectId, userId); // Verify ownership

    const shares = await this.prisma.shareLog.groupBy({
      by: ['platform'],
      where: { projectId },
      _count: { id: true },
    });

    const recentShares = await this.prisma.shareLog.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const linkClicks = await this.prisma.shareLinkClick.count({
      where: { shareLink: { projectId } },
    });

    return {
      sharesByPlatform: shares.reduce(
        (acc, s) => ({ ...acc, [s.platform ?? 'unknown']: s._count.id }),
        {},
      ),
      totalShares: shares.reduce((sum, s) => sum + s._count.id, 0),
      linkClicks,
      recentShares,
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private generateState(userId: string): string {
    const data = { userId, timestamp: Date.now() };
    return Buffer.from(JSON.stringify(data)).toString('base64url');
  }

  private validateState(state: string): string {
    try {
      const data = JSON.parse(Buffer.from(state, 'base64url').toString()) as {
        userId: string;
        timestamp: number;
      };
      // Check if state is less than 10 minutes old
      if (Date.now() - data.timestamp > 10 * 60 * 1000) {
        throw new BadRequestException('State expired');
      }
      return data.userId;
    } catch {
      throw new BadRequestException('Invalid state');
    }
  }

  private generateCodeChallenge(): string {
    const verifier = crypto.randomBytes(32).toString('base64url');
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  private generateShortCode(): string {
    return crypto.randomBytes(4).toString('hex');
  }

  private async getConnection(userId: string, platform: string) {
    const connection = await this.prisma.socialConnection.findFirst({
      where: { userId, platform, isActive: true },
    });

    if (!connection) {
      throw new BadRequestException(
        `${platform} account not connected. Please connect your ${platform} account first.`,
      );
    }

    // Check if token needs refresh
    if (connection.expiresAt && connection.expiresAt < new Date()) {
      return this.refreshToken(connection);
    }

    return connection;
  }

  private async refreshToken(connection: {
    id: string;
    platform: string | null;
    refreshToken: string | null;
  }): Promise<never> {
    if (!connection.refreshToken) {
      throw new BadRequestException(
        `${connection.platform ?? 'unknown'} connection expired. Please reconnect.`,
      );
    }

    // Platform-specific token refresh logic would go here
    // For now, throw an error
    throw new BadRequestException(
      `${connection.platform ?? 'unknown'} token expired. Please reconnect.`,
    );
  }

  private async getProject(projectId: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          {
            collaborators: {
              some: { userId, accessLevel: { in: ['OWNER', 'EDITOR'] } },
            },
          },
        ],
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found or access denied');
    }

    return project;
  }

  private getPublicShareUrl(project: {
    id: string;
    isPublic?: boolean;
  }): string {
    const baseUrl = this.configService.get<string>('FRONTEND_URL');
    return `${baseUrl}/present/${project.id}`;
  }

  private async logShare(
    userId: string,
    projectId: string,
    platform: string,
    success: boolean,
    postId?: string,
  ) {
    await this.prisma.shareLog.create({
      data: {
        userId,
        projectId,
        platform,
        success,
        externalPostId: postId,
      },
    });
  }
}
