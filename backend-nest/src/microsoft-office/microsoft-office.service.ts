import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import axios from 'axios';
import * as crypto from 'crypto';
import PptxGenJS from 'pptxgenjs';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface MicrosoftTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface OneDriveFile {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  file?: { mimeType: string };
  folder?: { childCount: number };
}

export interface SharePointSite {
  id: string;
  name: string;
  displayName: string;
  webUrl: string;
}

export interface PowerPointSlide {
  title?: string;
  subtitle?: string;
  content: Array<{
    type: 'text' | 'image' | 'shape' | 'table' | 'chart';
    data: unknown;
    position: { x: number; y: number; w: number; h: number };
    style?: Record<string, unknown>;
  }>;
  notes?: string;
  layout?: string;
  background?: { color?: string; image?: string };
}

export interface ImportOptions {
  preserveLayout: boolean;
  preserveAnimations: boolean;
  preserveTransitions: boolean;
  extractImages: boolean;
  extractNotes: boolean;
}

export interface ExportOptions {
  includeNotes: boolean;
  includeAnimations: boolean;
  templateStyle: 'modern' | 'classic' | 'minimal' | 'corporate';
  author?: string;
  company?: string;
  subject?: string;
}

@Injectable()
export class MicrosoftOfficeService {
  private readonly logger = new Logger(MicrosoftOfficeService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly microsoftGraphUrl = 'https://graph.microsoft.com/v1.0';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectQueue('powerpoint-processing') private readonly pptxQueue: Queue,
  ) {
    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY') || '',
      },
    });
    this.bucketName = this.configService.get('AWS_S3_BUCKET') || '';
  }

  // ============================================
  // MICROSOFT OAUTH
  // ============================================

  /**
   * Get Microsoft OAuth URL
   */
  getMicrosoftAuthUrl(userId: string): string {
    const clientId = this.configService.get<string>('MICROSOFT_CLIENT_ID');
    const redirectUri = `${this.configService.get('API_URL')}/api/microsoft/callback`;
    const state = this.generateState(userId);
    const scope = [
      'openid',
      'profile',
      'email',
      'offline_access',
      'Files.ReadWrite.All',
      'Sites.ReadWrite.All',
    ].join(' ');

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}&response_mode=query`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeMicrosoftCode(
    code: string,
    state: string,
  ): Promise<{ userId: string }> {
    const userId = this.validateState(state);
    const clientId = this.configService.get<string>('MICROSOFT_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'MICROSOFT_CLIENT_SECRET',
    );
    const redirectUri = `${this.configService.get('API_URL')}/api/microsoft/callback`;

    const response = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId || '',
        client_secret: clientSecret || '',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    // Get user profile
    const profileResponse = await axios.get(`${this.microsoftGraphUrl}/me`, {
      headers: { Authorization: `Bearer ${response.data.access_token}` },
    });

    // Store the connection
    await this.prisma.microsoftConnection.upsert({
      where: { userId },
      update: {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
        profileId: profileResponse.data.id,
        profileData: profileResponse.data,
        isActive: true,
      },
      create: {
        userId,
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
        profileId: profileResponse.data.id,
        profileData: profileResponse.data,
        isActive: true,
      },
    });

    return { userId };
  }

  // ============================================
  // ONEDRIVE INTEGRATION
  // ============================================

  /**
   * List OneDrive files
   */
  async listOneDriveFiles(
    userId: string,
    folderId?: string,
  ): Promise<OneDriveFile[]> {
    const tokens = await this.getTokens(userId);

    const url = folderId
      ? `${this.microsoftGraphUrl}/me/drive/items/${folderId}/children`
      : `${this.microsoftGraphUrl}/me/drive/root/children`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      params: {
        $filter:
          "file/mimeType eq 'application/vnd.openxmlformats-officedocument.presentationml.presentation' or folder ne null",
        $select:
          'id,name,size,webUrl,createdDateTime,lastModifiedDateTime,file,folder',
        $orderby: 'name',
      },
    });

    return response.data.value;
  }

  /**
   * Download file from OneDrive
   */
  async downloadFromOneDrive(userId: string, fileId: string): Promise<Buffer> {
    const tokens = await this.getTokens(userId);

    const response = await axios.get(
      `${this.microsoftGraphUrl}/me/drive/items/${fileId}/content`,
      {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
        responseType: 'arraybuffer',
      },
    );

    return Buffer.from(response.data);
  }

  /**
   * Upload file to OneDrive
   */
  async uploadToOneDrive(
    userId: string,
    fileName: string,
    content: Buffer,
    folderId?: string,
  ): Promise<OneDriveFile> {
    const tokens = await this.getTokens(userId);

    const url = folderId
      ? `${this.microsoftGraphUrl}/me/drive/items/${folderId}:/${fileName}:/content`
      : `${this.microsoftGraphUrl}/me/drive/root:/${fileName}:/content`;

    const response = await axios.put(url, content, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      },
    });

    return response.data;
  }

  // ============================================
  // SHAREPOINT INTEGRATION
  // ============================================

  /**
   * List SharePoint sites
   */
  async listSharePointSites(userId: string): Promise<SharePointSite[]> {
    const tokens = await this.getTokens(userId);

    const response = await axios.get(`${this.microsoftGraphUrl}/sites`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      params: {
        search: '*',
        $select: 'id,name,displayName,webUrl',
      },
    });

    return response.data.value;
  }

  /**
   * List files in SharePoint site
   */
  async listSharePointFiles(
    userId: string,
    siteId: string,
    folderId?: string,
  ): Promise<OneDriveFile[]> {
    const tokens = await this.getTokens(userId);

    const url = folderId
      ? `${this.microsoftGraphUrl}/sites/${siteId}/drive/items/${folderId}/children`
      : `${this.microsoftGraphUrl}/sites/${siteId}/drive/root/children`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      params: {
        $filter:
          "file/mimeType eq 'application/vnd.openxmlformats-officedocument.presentationml.presentation' or folder ne null",
        $select:
          'id,name,size,webUrl,createdDateTime,lastModifiedDateTime,file,folder',
      },
    });

    return response.data.value;
  }

  // ============================================
  // POWERPOINT IMPORT
  // ============================================

  /**
   * Import PowerPoint from uploaded file
   */
  async importPowerPoint(
    userId: string,
    fileBuffer: Buffer,
    fileName: string,
    options: Partial<ImportOptions> = {},
  ): Promise<{ jobId: string }> {
    const defaultOptions: ImportOptions = {
      preserveLayout: true,
      preserveAnimations: false,
      preserveTransitions: false,
      extractImages: true,
      extractNotes: true,
      ...options,
    };

    // Upload to S3 for processing
    const s3Key = `imports/${userId}/${Date.now()}_${fileName}`;
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileBuffer,
        ContentType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      }),
    );

    // Create import job
    const importJob = await this.prisma.powerPointImportJob.create({
      data: {
        userId,
        fileName,
        s3Key,
        status: 'queued',
        options: defaultOptions as object,
      },
    });

    // Queue processing
    await this.pptxQueue.add(
      'import-pptx',
      {
        jobId: importJob.id,
        userId,
        s3Key,
        options: defaultOptions,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    return { jobId: importJob.id };
  }

  /**
   * Import PowerPoint from OneDrive
   */
  async importFromOneDrive(
    userId: string,
    fileId: string,
    options: Partial<ImportOptions> = {},
  ): Promise<{ jobId: string }> {
    // Get file info
    const tokens = await this.getTokens(userId);
    const fileInfo = await axios.get(
      `${this.microsoftGraphUrl}/me/drive/items/${fileId}`,
      { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
    );

    // Download file
    const fileBuffer = await this.downloadFromOneDrive(userId, fileId);

    return this.importPowerPoint(
      userId,
      fileBuffer,
      fileInfo.data.name,
      options,
    );
  }

  /**
   * Parse PowerPoint file (called by worker)
   */
  async parsePowerPointFile(
    s3Key: string,
    options: ImportOptions,
  ): Promise<PowerPointSlide[]> {
    // Download from S3
    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      }),
    );

    const fileBuffer = Buffer.from(await response.Body!.transformToByteArray());

    // Parse PPTX file
    // Note: In production, you would use a library like 'pptx-parser' or
    // 'officegen' to parse the actual PPTX file structure
    // Here we'll simulate the extraction

    const slides: PowerPointSlide[] = [];

    // Simulated parsing - in production this would parse the actual PPTX XML
    // For now, return a placeholder structure
    this.logger.log('Parsing PowerPoint file...');

    return slides;
  }

  // ============================================
  // POWERPOINT EXPORT
  // ============================================

  /**
   * Export project to PowerPoint
   */
  async exportToPowerPoint(
    userId: string,
    projectId: string,
    options: Partial<ExportOptions> = {},
  ): Promise<{ downloadUrl: string }> {
    const project = await this.verifyProjectAccess(userId, projectId);

    const slides = await this.prisma.slide.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
      include: { blocks: { orderBy: { order: 'asc' } } },
    });

    const defaultOptions: ExportOptions = {
      includeNotes: true,
      includeAnimations: false,
      templateStyle: 'modern',
      author: '',
      company: '',
      subject: project.description || '',
      ...options,
    };

    // Create PowerPoint presentation
    const pptx = new PptxGenJS();

    // Set metadata
    pptx.author = defaultOptions.author || 'Presentation Designer';
    pptx.company = defaultOptions.company || '';
    pptx.subject = defaultOptions.subject ?? '';
    pptx.title = project.title;

    // Apply template style
    this.applyTemplateStyle(pptx, defaultOptions.templateStyle);

    // Convert slides
    for (const slide of slides) {
      const pptxSlide = pptx.addSlide();

      // Add title
      if (slide.title) {
        pptxSlide.addText(slide.title, {
          x: 0.5,
          y: 0.3,
          w: '90%',
          h: 0.8,
          fontSize: 32,
          bold: true,
          color: '363636',
        });
      }

      // Add blocks
      let yPosition = 1.5;
      for (const block of slide.blocks) {
        yPosition = this.addBlockToPptx(pptxSlide, block, yPosition);
      }

      // Add speaker notes
      if (defaultOptions.includeNotes && slide.speakerNotes) {
        pptxSlide.addNotes(slide.speakerNotes);
      }
    }

    // Generate file
    const pptxBuffer = (await pptx.write({
      outputType: 'arraybuffer',
    })) as ArrayBuffer;
    const buffer = Buffer.from(pptxBuffer);

    // Upload to S3
    const s3Key = `exports/${userId}/${projectId}/${Date.now()}_${project.title.replace(/[^a-zA-Z0-9]/g, '_')}.pptx`;
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ContentDisposition: `attachment; filename="${project.title}.pptx"`,
      }),
    );

    // Generate signed download URL
    const downloadUrl = await getSignedUrl(
      this.s3Client,
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      }),
      { expiresIn: 3600 },
    );

    // Log export
    await this.prisma.exportLog.create({
      data: {
        userId,
        projectId,
        format: 'pptx',
        s3Key,
      },
    });

    return { downloadUrl };
  }

  /**
   * Export and save to OneDrive
   */
  async exportToOneDrive(
    userId: string,
    projectId: string,
    folderId?: string,
    options?: Partial<ExportOptions>,
  ): Promise<OneDriveFile> {
    const project = await this.verifyProjectAccess(userId, projectId);

    // Generate PPTX
    const { downloadUrl } = await this.exportToPowerPoint(
      userId,
      projectId,
      options,
    );

    // Download the generated file
    const response = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
    });
    const fileBuffer = Buffer.from(response.data);

    // Upload to OneDrive
    const fileName = `${project.title.replace(/[^a-zA-Z0-9]/g, '_')}.pptx`;
    return this.uploadToOneDrive(userId, fileName, fileBuffer, folderId);
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
      if (Date.now() - data.timestamp > 10 * 60 * 1000) {
        throw new BadRequestException('State expired');
      }
      return data.userId;
    } catch {
      throw new BadRequestException('Invalid state');
    }
  }

  private async getTokens(userId: string): Promise<MicrosoftTokens> {
    const connection = await this.prisma.microsoftConnection.findFirst({
      where: { userId, isActive: true },
    });

    if (!connection) {
      throw new BadRequestException(
        'Microsoft account not connected. Please connect your Microsoft account.',
      );
    }

    // Refresh token if expired
    if (connection.expiresAt < new Date()) {
      return this.refreshTokens(connection.id, connection.refreshToken);
    }

    return {
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      expiresAt: connection.expiresAt,
    };
  }

  private async refreshTokens(
    connectionId: string,
    refreshToken: string,
  ): Promise<MicrosoftTokens> {
    const clientId = this.configService.get<string>('MICROSOFT_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'MICROSOFT_CLIENT_SECRET',
    );

    const response = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId || '',
        client_secret: clientSecret || '',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const expiresAt = new Date(Date.now() + response.data.expires_in * 1000);

    await this.prisma.microsoftConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || refreshToken,
        expiresAt,
      },
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token || refreshToken,
      expiresAt,
    };
  }

  private async verifyProjectAccess(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [{ ownerId: userId }, { collaborators: { some: { userId } } }],
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found or access denied');
    }

    return project;
  }

  private applyTemplateStyle(
    pptx: PptxGenJS,
    style: ExportOptions['templateStyle'],
  ): void {
    // Apply different theme colors based on style
    const themes: Record<
      string,
      { primary: string; secondary: string; accent: string }
    > = {
      modern: { primary: '4F46E5', secondary: '6366F1', accent: '10B981' },
      classic: { primary: '1E3A5F', secondary: '2C5282', accent: 'C53030' },
      minimal: { primary: '374151', secondary: '6B7280', accent: '3B82F6' },
      corporate: { primary: '1A365D', secondary: '2B6CB0', accent: 'DD6B20' },
    };

    const theme = themes[style] || themes.modern;

    // Set slide master
    pptx.defineSlideMaster({
      title: 'DEFAULT_MASTER',
      background: { color: 'FFFFFF' },
      objects: [
        // Header line
        {
          rect: {
            x: 0,
            y: 0,
            w: '100%',
            h: 0.05,
            fill: { color: theme.primary },
          },
        },
        // Footer
        {
          text: {
            text: 'Created with Presentation Designer',
            options: {
              x: 0.5,
              y: '95%',
              w: '40%',
              h: 0.3,
              fontSize: 8,
              color: '9CA3AF',
            },
          },
        },
      ],
    });
  }

  private addBlockToPptx(
    slide: PptxGenJS.Slide,
    block: { blockType: string; content: unknown },
    yPosition: number,
  ): number {
    const content = block.content as Record<string, unknown>;

    switch (block.blockType) {
      case 'HEADING':
        slide.addText(String(content.text || ''), {
          x: 0.5,
          y: yPosition,
          w: '90%',
          fontSize: 24,
          bold: true,
          color: '1F2937',
        });
        return yPosition + 0.8;

      case 'PARAGRAPH':
        slide.addText(String(content.text || ''), {
          x: 0.5,
          y: yPosition,
          w: '90%',
          fontSize: 14,
          color: '4B5563',
        });
        return yPosition + 0.6;

      case 'BULLET_LIST':
        const items = (content.items as string[]) || [];
        items.forEach((item, index) => {
          slide.addText(item, {
            x: 0.7,
            y: yPosition + index * 0.4,
            w: '85%',
            fontSize: 14,
            bullet: true,
            color: '4B5563',
          });
        });
        return yPosition + items.length * 0.4 + 0.3;

      case 'IMAGE':
        if (content.url) {
          slide.addImage({
            path: String(content.url),
            x: 0.5,
            y: yPosition,
            w: 4,
            h: 3,
          });
          return yPosition + 3.3;
        }
        return yPosition;

      case 'CODE':
        slide.addText(String(content.code || ''), {
          x: 0.5,
          y: yPosition,
          w: '90%',
          fontSize: 10,
          fontFace: 'Courier New',
          fill: { color: 'F3F4F6' },
          color: '374151',
        });
        return yPosition + 1;

      default:
        return yPosition + 0.5;
    }
  }
}
