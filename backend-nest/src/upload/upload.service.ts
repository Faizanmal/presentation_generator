import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Express } from 'express';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

export interface UploadResult {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

// Allowed file types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private s3Client: S3Client;
  private bucketName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_S3_REGION') || 'us-east-1',
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey:
          this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
    });
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET') || '';
  }

  /**
   * Upload a file to S3
   */
  /**
   * Upload a file to S3
   */
  async uploadFile(
    file: Express.Multer.File,
    userId: string,
    category?: string,
  ): Promise<UploadResult> {
    // Validate file
    this.validateFile(file);

    // Generate unique filename
    const extension = this.getExtension(file.originalname);
    const categoryPath = category ? `${category}/` : '';
    const key = `uploads/${userId}/${categoryPath}${uuidv4()}${extension}`;

    try {
      // Upload to S3
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read',
        }),
      );

      const url = `https://${this.bucketName}.s3.amazonaws.com/${key}`;

      // Save to database
      const asset = await this.prisma.asset.create({
        data: {
          userId,
          filename: file.originalname,
          url,
          mimeType: file.mimetype,
          size: file.size,
        },
      });

      this.logger.log(`File uploaded: ${key}`);

      return {
        id: asset.id,
        url: asset.url,
        filename: asset.filename,
        mimeType: asset.mimeType,
        size: asset.size,
      };
    } catch (error) {
      this.logger.error('Failed to upload file', error);
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  /**
   * Get presigned URL for direct upload
   */
  async getPresignedUploadUrl(
    userId: string,
    filename: string,
    mimeType: string,
    category?: string,
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    // Validate mime type
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException('File type not allowed');
    }

    const extension = this.getExtension(filename);
    const categoryPath = category ? `${category}/` : '';
    const key = `uploads/${userId}/${categoryPath}${uuidv4()}${extension}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: mimeType,
        ACL: 'public-read',
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600, // 1 hour
      });

      const publicUrl = `https://${this.bucketName}.s3.amazonaws.com/${key}`;

      return {
        uploadUrl,
        key,
        publicUrl,
      };
    } catch (error) {
      this.logger.error('Failed to generate presigned URL', error);
      throw new InternalServerErrorException('Failed to generate upload URL');
    }
  }

  /**
   * Confirm upload and save to database
   */
  async confirmUpload(
    userId: string,
    key: string,
    filename: string,
    mimeType: string,
    size: number,
  ): Promise<UploadResult> {
    const url = `https://${this.bucketName}.s3.amazonaws.com/${key}`;

    const asset = await this.prisma.asset.create({
      data: {
        userId,
        filename,
        url,
        mimeType,
        size,
      },
    });

    return {
      id: asset.id,
      url: asset.url,
      filename: asset.filename,
      mimeType: asset.mimeType,
      size: asset.size,
    };
  }

  /**
   * Delete a file
   */
  async deleteFile(assetIdOrUrl: string): Promise<void> {
    // Find asset by ID or URL
    const asset = await this.prisma.asset.findFirst({
      where: {
        OR: [{ id: assetIdOrUrl }, { url: assetIdOrUrl }],
      },
    });

    if (!asset) {
      // If passing a URL that's not in DB, maybe try to derive key?
      // For now, warn and return to avoid blocking deletions of parent objects
      this.logger.warn(`Asset not found for deletion: ${assetIdOrUrl}`);
      return;
    }

    // Extract key from URL
    const key = asset.url.replace(
      `https://${this.bucketName}.s3.amazonaws.com/`,
      '',
    );

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );

      await this.prisma.asset.delete({
        where: { id: asset.id },
      });

      this.logger.log(`File deleted: ${key}`);
    } catch (error) {
      this.logger.error('Failed to delete file', error);
      // We don't throw here to ensure parent record deletion can proceed
      // but maybe we should throw if it's critical?
      // Sticking to original behavior of throwing but now we log warning if not found
      throw new InternalServerErrorException('Failed to delete file');
    }
  }

  /**
   * Get user's assets
   */
  async getUserAssets(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [assets, total] = await Promise.all([
      this.prisma.asset.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.asset.count({
        where: { userId },
      }),
    ]);

    return {
      data: assets,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: Express.Multer.File): void {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }
  }

  /**
   * Get file extension
   */
  private getExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
  }
}
