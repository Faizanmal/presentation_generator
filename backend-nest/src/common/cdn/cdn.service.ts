import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from '@aws-sdk/client-cloudfront';

import * as crypto from 'crypto';
import * as path from 'path';

export interface CDNUploadOptions {
  /**
   * Content type of the file
   */
  contentType?: string;
  /**
   * Cache control header (e.g., 'public, max-age=31536000')
   */
  cacheControl?: string;
  /**
   * Custom metadata
   */
  metadata?: Record<string, string>;
  /**
   * Folder/prefix for organizing files
   */
  folder?: string;
}

export interface CDNUploadResult {
  /**
   * CDN URL of the uploaded file
   */
  url: string;
  /**
   * Original file path (if applicable)
   */
  originalPath?: string;
  /**
   * CDN-specific identifier
   */
  cdnId: string;
  /**
   * File size in bytes
   */
  size: number;
}

@Injectable()
export class CDNService {
  private readonly logger = new Logger(CDNService.name);
  private readonly cdnEnabled: boolean;
  private readonly cdnProvider: 'cloudflare' | 'cloudfront' | 'local';
  private readonly cdnBaseUrl: string;
  private readonly localBaseUrl: string;
  private r2Client: S3Client | null = null;
  private s3Client: S3Client | null = null;
  private cloudFrontClient: CloudFrontClient | null = null;
  private readonly r2Bucket: string;
  private readonly s3Bucket: string;
  private readonly cloudFrontDistributionId: string;

  constructor(private readonly configService: ConfigService) {
    this.cdnEnabled = this.configService.get<boolean>('CDN_ENABLED', false);
    this.cdnProvider = this.configService.get<
      'cloudflare' | 'cloudfront' | 'local'
    >('CDN_PROVIDER', 'local');
    this.cdnBaseUrl = this.configService.get<string>('CDN_BASE_URL', '');
    this.localBaseUrl = this.configService.get<string>(
      'BASE_URL',
      'http://localhost:3001',
    );

    this.r2Bucket = this.configService.get<string>('R2_BUCKET_NAME', '');
    this.s3Bucket = this.configService.get<string>('S3_BUCKET_NAME', '');
    this.cloudFrontDistributionId = this.configService.get<string>(
      'CLOUDFRONT_DISTRIBUTION_ID',
      '',
    );

    if (this.cdnEnabled) {
      this.initializeClients();
    }

    this.logger.log(
      `CDN Service initialized: ${this.cdnEnabled ? 'ENABLED' : 'DISABLED'} (Provider: ${this.cdnProvider})`,
    );
  }

  /**
   * Initialize CDN provider SDK clients based on configuration
   */
  private initializeClients(): void {
    if (this.cdnProvider === 'cloudflare') {
      const accountId = this.configService.get<string>('R2_ACCOUNT_ID', '');
      const accessKeyId = this.configService.get<string>(
        'R2_ACCESS_KEY_ID',
        '',
      );
      const secretAccessKey = this.configService.get<string>(
        'R2_SECRET_ACCESS_KEY',
        '',
      );

      if (accountId && accessKeyId && secretAccessKey) {
        this.r2Client = new S3Client({
          region: 'auto',
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        this.logger.log('Cloudflare R2 client initialized');
      } else {
        this.logger.warn('Cloudflare R2 credentials not fully configured');
      }
    } else if (this.cdnProvider === 'cloudfront') {
      const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
      const accessKeyId = this.configService.get<string>(
        'AWS_ACCESS_KEY_ID',
        '',
      );
      const secretAccessKey = this.configService.get<string>(
        'AWS_SECRET_ACCESS_KEY',
        '',
      );

      const credentials =
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined;

      this.s3Client = new S3Client({ region, credentials });
      this.cloudFrontClient = new CloudFrontClient({ region, credentials });
      this.logger.log('AWS S3 and CloudFront clients initialized');
    }
  }

  /**
   * Upload a file to CDN
   * @param file File buffer or path
   * @param fileName Desired file name
   * @param options Upload options
   * @returns CDN URL and metadata
   */
  async uploadFile(
    file: Buffer | string,
    fileName: string,
    options: CDNUploadOptions = {},
  ): Promise<CDNUploadResult> {
    if (!this.cdnEnabled) {
      return this.uploadToLocal(file, fileName, options);
    }

    try {
      switch (this.cdnProvider) {
        case 'cloudflare':
          return await this.uploadToCloudflare(file, fileName, options);
        case 'cloudfront':
          return await this.uploadToCloudFront(file, fileName, options);
        default:
          return await this.uploadToLocal(file, fileName, options);
      }
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `CDN upload failed, falling back to local: ${err.message}`,
        err.stack,
      );
      return this.uploadToLocal(file, fileName, options);
    }
  }

  /**
   * Get CDN URL for a local file path
   * @param localPath Local file path
   * @returns CDN URL or local URL if CDN is disabled
   */
  getCDNUrl(localPath: string): string {
    if (!this.cdnEnabled || !this.cdnBaseUrl) {
      return `${this.localBaseUrl}/${localPath.replace(/\\/g, '/')}`;
    }

    return `${this.cdnBaseUrl}/${localPath.replace(/\\/g, '/')}`;
  }

  /**
   * Generate a signed URL for private content (if CDN supports it)
   * @param filePath File path
   * @param expiresIn Expiration time in seconds
   * @returns Signed URL
   */
  async getSignedUrl(
    filePath: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    if (!this.cdnEnabled) {
      return this.getCDNUrl(filePath);
    }

    try {
      switch (this.cdnProvider) {
        case 'cloudflare':
          return await this.getCloudflareSignedUrl(filePath, expiresIn);
        case 'cloudfront':
          return await this.getCloudFrontSignedUrl(filePath, expiresIn);
        default:
          return this.getCDNUrl(filePath);
      }
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Failed to generate signed URL: ${err.message}`,
        err.stack,
      );
      return this.getCDNUrl(filePath);
    }
  }

  /**
   * Delete a file from CDN
   * @param filePath File path or CDN ID
   * @returns Success status
   */
  async deleteFile(filePath: string): Promise<boolean> {
    if (!this.cdnEnabled) {
      return true; // Local files handled separately
    }

    try {
      switch (this.cdnProvider) {
        case 'cloudflare':
          return await this.deleteFromCloudflare(filePath);
        case 'cloudfront':
          return await this.deleteFromCloudFront(filePath);
        default:
          return true;
      }
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`CDN delete failed: ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Purge/invalidate CDN cache for specific files
   * @param filePaths Array of file paths to purge
   * @returns Success status
   */
  async purgeCache(filePaths: string[]): Promise<boolean> {
    if (!this.cdnEnabled) {
      return true;
    }

    try {
      switch (this.cdnProvider) {
        case 'cloudflare':
          return await this.purgeCloudflareCache(filePaths);
        case 'cloudfront':
          return await this.purgeCloudFrontCache(filePaths);
        default:
          return true;
      }
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`CDN cache purge failed: ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Upload to Cloudflare R2
   */
  private async uploadToCloudflare(
    file: Buffer | string,
    fileName: string,
    options: CDNUploadOptions,
  ): Promise<CDNUploadResult> {
    if (!this.r2Client) {
      this.logger.warn(
        'R2 client not initialized, falling back to local storage',
      );
      return this.uploadToLocal(file, fileName, options);
    }

    const fs = await import('fs/promises');
    let fileBuffer: Buffer;
    if (typeof file === 'string') {
      fileBuffer = await fs.readFile(file);
    } else {
      fileBuffer = file;
    }

    const key = options.folder ? `${options.folder}/${fileName}` : fileName;

    await this.r2Client.send(
      new PutObjectCommand({
        Bucket: this.r2Bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: options.contentType,
        CacheControl: options.cacheControl || 'public, max-age=31536000',
        Metadata: options.metadata,
      }),
    );

    this.logger.log(`Uploaded to Cloudflare R2: ${key}`);

    return {
      url: this.getCDNUrl(key),
      originalPath: typeof file === 'string' ? file : undefined,
      cdnId: key,
      size: fileBuffer.length,
    };
  }

  /**
   * Upload to AWS S3 (served via CloudFront)
   */
  private async uploadToCloudFront(
    file: Buffer | string,
    fileName: string,
    options: CDNUploadOptions,
  ): Promise<CDNUploadResult> {
    if (!this.s3Client) {
      this.logger.warn(
        'S3 client not initialized, falling back to local storage',
      );
      return this.uploadToLocal(file, fileName, options);
    }

    const fs = await import('fs/promises');
    let fileBuffer: Buffer;
    if (typeof file === 'string') {
      fileBuffer = await fs.readFile(file);
    } else {
      fileBuffer = file;
    }

    const key = options.folder ? `${options.folder}/${fileName}` : fileName;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: options.contentType,
        CacheControl: options.cacheControl || 'public, max-age=31536000',
        Metadata: options.metadata,
      }),
    );

    this.logger.log(`Uploaded to S3: ${key}`);

    return {
      url: this.getCDNUrl(key),
      originalPath: typeof file === 'string' ? file : undefined,
      cdnId: key,
      size: fileBuffer.length,
    };
  }

  /**
   * Upload to local storage (fallback)
   */
  private async uploadToLocal(
    file: Buffer | string,
    fileName: string,
    options: CDNUploadOptions,
  ): Promise<CDNUploadResult> {
    const fs = await import('fs/promises');
    const uploadsDir = path.join(
      process.cwd(),
      'uploads',
      options.folder || '',
    );

    // Ensure directory exists
    await fs.mkdir(uploadsDir, { recursive: true });

    const targetPath = path.join(uploadsDir, fileName);
    let fileBuffer: Buffer;

    if (typeof file === 'string') {
      fileBuffer = await fs.readFile(file);
    } else {
      fileBuffer = file;
    }

    await fs.writeFile(targetPath, fileBuffer);

    const relativePath = path
      .relative(process.cwd(), targetPath)
      .replace(/\\/g, '/');

    return {
      url: this.getCDNUrl(relativePath),
      originalPath: targetPath,
      cdnId: fileName,
      size: fileBuffer.length,
    };
  }

  /**
   * Generate Cloudflare R2 pre-signed URL
   */
  private async getCloudflareSignedUrl(
    filePath: string,
    expiresIn: number,
  ): Promise<string> {
    if (!this.r2Client) {
      this.logger.warn('R2 client not initialized, returning public URL');
      return this.getCDNUrl(filePath);
    }

    const command = new GetObjectCommand({
      Bucket: this.r2Bucket,
      Key: filePath,
    });

    const signedUrl = await getSignedUrl(this.r2Client, command, {
      expiresIn,
    });

    return signedUrl;
  }

  /**
   * Generate CloudFront signed URL
   */
  private getCloudFrontSignedUrl(
    filePath: string,
    expiresIn: number,
  ): Promise<string> {
    const signingKey = this.configService.get<string>(
      'CLOUDFRONT_SIGNING_KEY',
      '',
    );
    const keyPairId = this.configService.get<string>(
      'CLOUDFRONT_KEY_PAIR_ID',
      '',
    );

    if (!signingKey || !keyPairId) {
      this.logger.warn('CloudFront signing credentials not configured');
      return Promise.resolve(this.getCDNUrl(filePath));
    }

    const url = this.getCDNUrl(filePath);
    const expires = Math.floor(Date.now() / 1000) + expiresIn;

    // Simple CloudFront signed URL generation
    const policy = JSON.stringify({
      Statement: [
        {
          Resource: url,
          Condition: {
            DateLessThan: { 'AWS:EpochTime': expires },
          },
        },
      ],
    });

    const signature = crypto
      .createSign('RSA-SHA1')
      .update(policy)
      .sign(signingKey, 'base64')
      .replace(/\+/g, '-')
      .replace(/=/g, '_')
      .replace(/\//g, '~');

    return Promise.resolve(
      `${url}?Expires=${expires}&Signature=${signature}&Key-Pair-Id=${keyPairId}`,
    );
  }

  /**
   * Delete from Cloudflare R2
   */
  private async deleteFromCloudflare(filePath: string): Promise<boolean> {
    if (!this.r2Client) {
      this.logger.warn('R2 client not initialized, cannot delete');
      return false;
    }

    await this.r2Client.send(
      new DeleteObjectCommand({
        Bucket: this.r2Bucket,
        Key: filePath,
      }),
    );

    this.logger.log(`Deleted from Cloudflare R2: ${filePath}`);
    return true;
  }

  /**
   * Delete from S3 (CloudFront origin)
   */
  private async deleteFromCloudFront(filePath: string): Promise<boolean> {
    if (!this.s3Client) {
      this.logger.warn('S3 client not initialized, cannot delete');
      return false;
    }

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.s3Bucket,
        Key: filePath,
      }),
    );

    this.logger.log(`Deleted from S3: ${filePath}`);
    return true;
  }

  /**
   * Purge Cloudflare cache
   */
  private async purgeCloudflareCache(filePaths: string[]): Promise<boolean> {
    const zoneId = this.configService.get<string>('CLOUDFLARE_ZONE_ID', '');
    const apiKey = this.configService.get<string>('CLOUDFLARE_API_KEY', '');

    if (!zoneId || !apiKey) {
      this.logger.warn('Cloudflare credentials not configured for cache purge');
      return false;
    }

    try {
      const fetch = (await import('node-fetch')).default;
      const urls = filePaths.map((p) => this.getCDNUrl(p));

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ files: urls }),
        },
      );

      const result: unknown = await response.json();
      const json = result as { success?: boolean };
      return json.success === true;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Cloudflare cache purge failed: ${err.message}`,
        err.stack,
      );
      return false;
    }
  }

  /**
   * Purge CloudFront cache via invalidation request
   */
  private async purgeCloudFrontCache(filePaths: string[]): Promise<boolean> {
    if (!this.cloudFrontClient || !this.cloudFrontDistributionId) {
      this.logger.warn('CloudFront client or distribution ID not configured');
      return false;
    }

    const items = filePaths.map((p) => (p.startsWith('/') ? p : `/${p}`));

    const result = await this.cloudFrontClient.send(
      new CreateInvalidationCommand({
        DistributionId: this.cloudFrontDistributionId,
        InvalidationBatch: {
          CallerReference: `invalidation-${Date.now()}`,
          Paths: {
            Quantity: items.length,
            Items: items,
          },
        },
      }),
    );

    this.logger.log(
      `CloudFront invalidation created: ${result.Invalidation?.Id}`,
    );
    return true;
  }

  /**
   * Get CDN analytics/stats (if available)
   */
  async getAnalytics(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    bandwidth: number;
    requests: number;
    cacheHitRate: number;
  }> {
    if (!this.cdnEnabled) {
      return { bandwidth: 0, requests: 0, cacheHitRate: 0 };
    }

    try {
      switch (this.cdnProvider) {
        case 'cloudflare':
          return await this.getCloudflareAnalytics(startDate, endDate);
        case 'cloudfront':
          return await this.getCloudFrontAnalytics(startDate, endDate);
        default:
          return { bandwidth: 0, requests: 0, cacheHitRate: 0 };
      }
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Failed to retrieve CDN analytics: ${err.message}`,
        err.stack,
      );
      return { bandwidth: 0, requests: 0, cacheHitRate: 0 };
    }
  }

  /**
   * Retrieve analytics from Cloudflare GraphQL API
   */
  private async getCloudflareAnalytics(
    startDate: Date,
    endDate: Date,
  ): Promise<{ bandwidth: number; requests: number; cacheHitRate: number }> {
    const zoneId = this.configService.get<string>('CLOUDFLARE_ZONE_ID', '');
    const apiKey = this.configService.get<string>('CLOUDFLARE_API_KEY', '');

    if (!zoneId || !apiKey) {
      this.logger.warn('Cloudflare credentials not configured for analytics');
      return { bandwidth: 0, requests: 0, cacheHitRate: 0 };
    }

    const fetch = (await import('node-fetch')).default;

    const query = `
      query {
        viewer {
          zones(filter: { zoneTag: "${zoneId}" }) {
            httpRequests1dGroups(
              filter: {
                date_geq: "${startDate.toISOString().split('T')[0]}"
                date_leq: "${endDate.toISOString().split('T')[0]}"
              }
              limit: 1000
            ) {
              sum {
                bytes
                requests
                cachedBytes
                cachedRequests
              }
            }
          }
        }
      }
    `;

    const response = await fetch(
      'https://api.cloudflare.com/client/v4/graphql',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      },
    );

    const result = (await response.json()) as {
      data?: {
        viewer?: {
          zones?: Array<{
            httpRequests1dGroups?: Array<{
              sum?: {
                bytes?: number;
                requests?: number;
                cachedBytes?: number;
                cachedRequests?: number;
              };
            }>;
          }>;
        };
      };
    };

    const groups = result.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
    let totalBandwidth = 0;
    let totalRequests = 0;
    let cachedRequests = 0;

    for (const group of groups) {
      totalBandwidth += group.sum?.bytes || 0;
      totalRequests += group.sum?.requests || 0;
      cachedRequests += group.sum?.cachedRequests || 0;
    }

    return {
      bandwidth: totalBandwidth,
      requests: totalRequests,
      cacheHitRate: totalRequests > 0 ? cachedRequests / totalRequests : 0,
    };
  }

  /**
   * Retrieve analytics from AWS CloudWatch for CloudFront distribution.
   * Requires @aws-sdk/client-cloudwatch as an optional dependency.
   */
  private async getCloudFrontAnalytics(
    startDate: Date,
    endDate: Date,
  ): Promise<{ bandwidth: number; requests: number; cacheHitRate: number }> {
    if (!this.cloudFrontDistributionId) {
      this.logger.warn(
        'CloudFront distribution ID not configured for analytics',
      );
      return { bandwidth: 0, requests: 0, cacheHitRate: 0 };
    }

    try {
      const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
      // optional module import; if not installed we'll bail gracefully
      // dynamic import is optional; if the package isn't installed we get null
      // @ts-expect-error optional dependency—it may not exist at compile time
      const awsCloudWatch = (await import('@aws-sdk/client-cloudwatch').catch(
        () => null,
      )) as null | { CloudWatchClient: any; GetMetricStatisticsCommand: any };
      if (!awsCloudWatch) {
        throw new Error('CloudWatch module not available');
      }
      const { CloudWatchClient, GetMetricStatisticsCommand } = awsCloudWatch;
      // provide locally‑typed aliases with explicit constructor signatures
      // so the linter no longer sees an unresolved type
      type CloudWatchClientType = new (opts: { region: string }) => {
        send: (cmd: unknown) => Promise<unknown>;
      };
      const CloudWatchClientCtor =
        CloudWatchClient as unknown as CloudWatchClientType;
      type GetMetricStatisticsCommandType = new (input: unknown) => unknown;
      const GetMetricStatisticsCommandCtor =
        GetMetricStatisticsCommand as unknown as GetMetricStatisticsCommandType;

      const cloudWatch = new CloudWatchClientCtor({ region });

      const dimensions = [
        { Name: 'DistributionId', Value: this.cloudFrontDistributionId },
        { Name: 'Region', Value: 'Global' },
      ];

      const [requestsResult, bytesResult] = (await Promise.all([
        cloudWatch.send(
          new GetMetricStatisticsCommandCtor({
            Namespace: 'AWS/CloudFront',
            MetricName: 'Requests',
            Dimensions: dimensions,
            StartTime: startDate,
            EndTime: endDate,
            Period: 86400,
            Statistics: ['Sum'],
          }),
        ),
        cloudWatch.send(
          new GetMetricStatisticsCommandCtor({
            Namespace: 'AWS/CloudFront',
            MetricName: 'BytesDownloaded',
            Dimensions: dimensions,
            StartTime: startDate,
            EndTime: endDate,
            Period: 86400,
            Statistics: ['Sum'],
          }),
        ),
      ])) as [any, any];

      const requestsDataPoints =
        (requestsResult.Datapoints as Array<{ Sum?: number }> | undefined) ||
        [];
      const totalRequests = requestsDataPoints.reduce(
        (sum: number, dp) => sum + (dp.Sum || 0),
        0,
      );
      const bytesDataPoints =
        (bytesResult.Datapoints as Array<{ Sum?: number }> | undefined) || [];
      const totalBandwidth = bytesDataPoints.reduce(
        (sum: number, dp) => sum + (dp.Sum || 0),
        0,
      );

      return {
        bandwidth: totalBandwidth,
        requests: totalRequests,
        cacheHitRate: 0, // CloudWatch doesn't expose cache hit rate as a single metric
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.warn(
        `CloudFront analytics unavailable (install @aws-sdk/client-cloudwatch for full support): ${err.message}`,
      );
      return { bandwidth: 0, requests: 0, cacheHitRate: 0 };
    }
  }

  /**
   * Optimize image for CDN delivery
   */
  async optimizeImage(
    imageBuffer: Buffer,
    options: {
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp' | 'avif';
      maxWidth?: number;
      maxHeight?: number;
    } = {},
  ): Promise<Buffer> {
    try {
      interface SharpInstance {
        resize(width?: number, height?: number, opts?: unknown): SharpInstance;
        jpeg(opts?: unknown): SharpInstance;
        png(opts?: unknown): SharpInstance;
        webp(opts?: unknown): SharpInstance;
        avif(opts?: unknown): SharpInstance;
        toBuffer(): Promise<Buffer>;
      }

      // @ts-expect-error sharp is an optional dependency
      const sharpModule = (await import('sharp')).default as unknown as (
        input: Buffer,
      ) => SharpInstance;

      let transformer: SharpInstance = sharpModule(imageBuffer);

      // Resize if needed
      if (options.maxWidth || options.maxHeight) {
        transformer = transformer.resize(options.maxWidth, options.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // Convert format
      switch (options.format) {
        case 'jpeg':
          transformer = transformer.jpeg({ quality: options.quality || 85 });
          break;
        case 'png':
          transformer = transformer.png({ quality: options.quality || 85 });
          break;
        case 'webp':
          transformer = transformer.webp({ quality: options.quality || 85 });
          break;
        case 'avif':
          transformer = transformer.avif({ quality: options.quality || 75 });
          break;
      }

      return await transformer.toBuffer();
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Image optimization failed: ${err.message}`, err.stack);
      return imageBuffer;
    }
  }
}
