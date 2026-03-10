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
import * as crypto from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface RecordingSession {
  id: string;
  projectId: string;
  userId: string;
  status:
    | 'initializing'
    | 'recording'
    | 'paused'
    | 'processing'
    | 'completed'
    | 'failed';
  startedAt: Date;
  duration?: number;
  settings: RecordingSettings;
}

export interface RecordingSettings {
  resolution: '720p' | '1080p' | '4k';
  frameRate: 30 | 60;
  includeWebcam: boolean;
  webcamPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  webcamSize: 'small' | 'medium' | 'large';
  includeAudio: boolean;
  audioSource: 'microphone' | 'system' | 'both';
  includeMouseCursor: boolean;
  includeClicks: boolean;
  countdownTimer: number;
  autoAdvanceSlides: boolean;
  slideInterval?: number;
}

export interface VideoExportOptions {
  format: 'mp4' | 'webm' | 'mov' | 'gif';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  addWatermark: boolean;
  watermarkText?: string;
  addIntro: boolean;
  introTemplateId?: string;
  addOutro: boolean;
  outroTemplateId?: string;
  addBackgroundMusic: boolean;
  musicTrackId?: string;
  musicVolume?: number;
}

export interface VideoChunk {
  index: number;
  data: Buffer;
  timestamp: number;
  type: 'screen' | 'webcam' | 'audio';
}

@Injectable()
export class VideoRecordingService {
  private readonly logger = new Logger(VideoRecordingService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private activeSessions = new Map<string, RecordingSession>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectQueue('video-processing') private readonly videoQueue: Queue,
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
  // RECORDING SESSION MANAGEMENT
  // ============================================

  /**
   * Initialize a new recording session
   */
  async initializeRecording(
    userId: string,
    projectId: string,
    settings: Partial<RecordingSettings> = {},
  ): Promise<RecordingSession> {
    // Verify project access
    await this.verifyProjectAccess(userId, projectId);

    // Check subscription limits
    await this.checkRecordingLimits(userId);

    const sessionId = crypto.randomUUID();
    const defaultSettings: RecordingSettings = {
      resolution: '1080p',
      frameRate: 30,
      includeWebcam: false,
      webcamPosition: 'bottom-right',
      webcamSize: 'small',
      includeAudio: true,
      audioSource: 'microphone',
      includeMouseCursor: true,
      includeClicks: true,
      countdownTimer: 3,
      autoAdvanceSlides: false,
      ...settings,
    };

    const session: RecordingSession = {
      id: sessionId,
      projectId,
      userId,
      status: 'initializing',
      startedAt: new Date(),
      settings: defaultSettings,
    };

    // Create database record
    await this.prisma.videoRecording.create({
      data: {
        id: sessionId,
        projectId,
        userId,
        status: 'initializing',
        settings: defaultSettings as object,
      },
    });

    this.activeSessions.set(sessionId, session);

    // Generate upload URLs for chunks
    const uploadUrls = await this.generateChunkUploadUrls(sessionId, 100); // Pre-generate 100 chunk URLs

    this.logger.log(`Recording session initialized: ${sessionId}`);

    return {
      ...session,
      // @ts-expect-error Adding extra field for response
      uploadUrls,
    };
  }

  /**
   * Start recording
   */
  async startRecording(sessionId: string, userId: string): Promise<void> {
    const session = await this.getSession(sessionId, userId);

    if (session.status !== 'initializing' && session.status !== 'paused') {
      throw new BadRequestException('Cannot start recording in current state');
    }

    await this.prisma.videoRecording.update({
      where: { id: sessionId },
      data: {
        status: 'recording',
        startedAt: session.status === 'initializing' ? new Date() : undefined,
      },
    });

    session.status = 'recording';
    this.activeSessions.set(sessionId, session);

    this.logger.log(`Recording started: ${sessionId}`);
  }

  /**
   * Pause recording
   */
  async pauseRecording(sessionId: string, userId: string): Promise<void> {
    const session = await this.getSession(sessionId, userId);

    if (session.status !== 'recording') {
      throw new BadRequestException('Recording is not active');
    }

    await this.prisma.videoRecording.update({
      where: { id: sessionId },
      data: { status: 'paused' },
    });

    session.status = 'paused';
    this.activeSessions.set(sessionId, session);

    this.logger.log(`Recording paused: ${sessionId}`);
  }

  /**
   * Upload video chunk
   */
  async uploadChunk(
    sessionId: string,
    userId: string,
    chunk: VideoChunk,
  ): Promise<{ received: boolean; chunkIndex: number }> {
    const session = await this.getSession(sessionId, userId);

    if (session.status !== 'recording' && session.status !== 'paused') {
      throw new BadRequestException('Recording session is not active');
    }

    const key = `recordings/${sessionId}/chunks/${chunk.type}_${chunk.index.toString().padStart(6, '0')}.webm`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: chunk.data,
        ContentType: 'video/webm',
        Metadata: {
          sessionId,
          chunkIndex: chunk.index.toString(),
          chunkType: chunk.type,
          timestamp: chunk.timestamp.toString(),
        },
      }),
    );

    // Track chunk in database
    await this.prisma.videoChunk.create({
      data: {
        recordingId: sessionId,
        index: chunk.index,
        type: chunk.type,
        s3Key: key,
        size: chunk.data.length,
        timestamp: chunk.timestamp,
      },
    });

    return { received: true, chunkIndex: chunk.index };
  }

  /**
   * Stop recording and start processing
   */
  async stopRecording(
    sessionId: string,
    userId: string,
    exportOptions?: Partial<VideoExportOptions>,
  ): Promise<{ jobId: string }> {
    const session = await this.getSession(sessionId, userId);

    if (session.status !== 'recording' && session.status !== 'paused') {
      throw new BadRequestException('Recording is not active');
    }

    const duration = (Date.now() - session.startedAt.getTime()) / 1000;

    await this.prisma.videoRecording.update({
      where: { id: sessionId },
      data: {
        status: 'processing',
        duration,
        endedAt: new Date(),
      },
    });

    // Clean up active session
    this.activeSessions.delete(sessionId);

    // Queue video processing job
    const defaultExportOptions: VideoExportOptions = {
      format: 'mp4',
      quality: 'high',
      addWatermark: false,
      addIntro: false,
      addOutro: false,
      addBackgroundMusic: false,
      ...exportOptions,
    };

    const job = await this.videoQueue.add(
      'process-recording',
      {
        sessionId,
        userId,
        exportOptions: defaultExportOptions,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    this.logger.log(
      `Recording stopped and queued for processing: ${sessionId}`,
    );

    return { jobId: job.id || sessionId };
  }

  // ============================================
  // VIDEO PROCESSING
  // ============================================

  /**
   * Process recorded video (called by worker)
   */
  async processRecording(
    sessionId: string,
    exportOptions: VideoExportOptions,
  ): Promise<string> {
    this.logger.log(`Processing recording: ${sessionId}`);

    // Get all chunks
    const chunks = await this.prisma.videoChunk.findMany({
      where: { recordingId: sessionId },
      orderBy: [{ type: 'asc' }, { index: 'asc' }],
    });

    if (chunks.length === 0) {
      throw new BadRequestException('No video chunks found');
    }

    // Here we would use FFmpeg or a similar tool to:
    // 1. Download all chunks from S3
    // 2. Concatenate screen recording chunks
    // 3. Overlay webcam if present
    // 4. Merge audio tracks
    // 5. Add intro/outro if requested
    // 6. Add watermark if requested
    // 7. Add background music if requested
    // 8. Export to final format

    // For now, simulate processing
    const outputKey = `videos/${sessionId}/final.${exportOptions.format}`;

    // Update recording with final video URL
    const videoUrl = `https://${this.bucketName}.s3.amazonaws.com/${outputKey}`;

    await this.prisma.videoRecording.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        outputUrl: videoUrl,
        outputFormat: exportOptions.format,
        processedAt: new Date(),
      },
    });

    return videoUrl;
  }

  /**
   * Export presentation as video (pre-recorded, no live recording)
   */
  async exportPresentationAsVideo(
    userId: string,
    projectId: string,
    options: Partial<VideoExportOptions> & {
      slideTimings?: number[];
      narrationAudioUrl?: string;
    } = {},
  ): Promise<{ jobId: string }> {
    await this.verifyProjectAccess(userId, projectId);

    const defaultOptions: VideoExportOptions = {
      format: 'mp4',
      quality: 'high',
      addWatermark: false,
      addIntro: false,
      addOutro: false,
      addBackgroundMusic: false,
      ...options,
    };

    // Create export job record
    const exportJob = await this.prisma.videoExportJob.create({
      data: {
        projectId,
        userId,
        status: 'PENDING',
        format: defaultOptions.format || 'mp4',
      },
    });

    // Queue the export job
    // const job = await this.videoQueue.add(
    //   'export-presentation',
    //   {
    //     jobId: exportJob.id,
    //     projectId,
    //     userId,
    //     options: defaultOptions,
    //     slideTimings: options.slideTimings,
    //     narrationAudioUrl: options.narrationAudioUrl,
    //   },
    //   {
    //     attempts: 3,
    //     backoff: { type: 'exponential', delay: 5000 },
    //   },
    // );

    return { jobId: exportJob.id };
  }

  // ============================================
  // TEMPLATES & ASSETS
  // ============================================

  /**
   * Get available intro/outro templates
   */
  async getVideoTemplates(type: 'intro' | 'outro'): Promise<
    Array<{
      id: string;
      name: string;
      thumbnailUrl: string;
      duration: number;
      isPremium: boolean;
    }>
  > {
    const templates = await this.prisma.videoTemplate.findMany({
      where: { type, isActive: true },
      select: {
        id: true,
        name: true,
        thumbnailUrl: true,
        duration: true,
        isPremium: true,
      },
      orderBy: { order: 'asc' },
    });
    return templates.map((t) => ({
      id: t.id,
      name: t.name ?? 'Untitled',
      thumbnailUrl: t.thumbnailUrl ?? '',
      duration: t.duration ?? 0,
      isPremium: t.isPremium,
    }));
  }

  /**
   * Get available background music tracks
   */
  async getMusicTracks(): Promise<
    Array<{
      id: string;
      name: string;
      artist: string;
      duration: number;
      previewUrl: string;
      mood: string;
      isPremium: boolean;
    }>
  > {
    const tracks = await this.prisma.musicTrack.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        artist: true,
        duration: true,
        previewUrl: true,
        mood: true,
        isPremium: true,
      },
      orderBy: [{ mood: 'asc' }, { name: 'asc' }],
    });
    return tracks.map((t) => ({
      id: t.id,
      name: t.name ?? 'Unknown',
      artist: t.artist ?? 'Unknown',
      duration: t.duration ?? 0,
      previewUrl: t.previewUrl ?? '',
      mood: t.mood ?? 'neutral',
      isPremium: t.isPremium,
    }));
  }

  // ============================================
  // RECORDING HISTORY
  // ============================================

  /**
   * Get user's recording history
   */
  async getRecordingHistory(
    userId: string,
    options: {
      projectId?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const where = {
      userId,
      ...(options.projectId && { projectId: options.projectId }),
    };

    const [recordings, total] = await Promise.all([
      this.prisma.videoRecording.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit || 20,
        skip: options.offset || 0,
        include: {
          project: {
            select: { id: true, title: true },
          },
        },
      }),
      this.prisma.videoRecording.count({ where }),
    ]);

    return {
      recordings,
      total,
      hasMore: (options.offset || 0) + recordings.length < total,
    };
  }

  /**
   * Get recording details
   */
  async getRecording(recordingId: string, userId: string) {
    const recording = await this.prisma.videoRecording.findFirst({
      where: { id: recordingId, userId },
      include: {
        project: {
          select: { id: true, title: true },
        },
      },
    });

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    return recording;
  }

  /**
   * Delete a recording
   */
  async deleteRecording(recordingId: string, userId: string): Promise<void> {
    const recording = await this.getRecording(recordingId, userId);

    // Delete all chunks and final video from S3
    try {
      // List and delete all S3 objects for this recording
      const prefix = `recordings/${recordingId}/`;
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      });
      const listResult = await this.s3Client.send(listCommand);

      if (listResult.Contents?.length) {
        for (const obj of listResult.Contents) {
          if (obj.Key) {
            await this.s3Client.send(
              new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: obj.Key,
              }),
            );
          }
        }
        this.logger.log(
          `Deleted ${listResult.Contents.length} S3 objects for recording ${recordingId}`,
        );
      }

      // Delete the final video if it has a URL
      if (recording.outputUrl) {
        const videoKey = recording.outputUrl.split('.amazonaws.com/')[1];
        if (videoKey) {
          await this.s3Client.send(
            new DeleteObjectCommand({
              Bucket: this.bucketName,
              Key: videoKey,
            }),
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Failed to delete S3 objects for recording ${recordingId}: ${(err as Error).message}`,
      );
    }

    // Delete from database
    await this.prisma.videoChunk.deleteMany({
      where: { recordingId },
    });

    await this.prisma.videoRecording.delete({
      where: { id: recordingId },
    });

    this.logger.log(`Recording deleted: ${recordingId}`);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

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

  private async checkRecordingLimits(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    });

    // Check concurrent recording limit
    const activeRecordings = await this.prisma.videoRecording.count({
      where: {
        userId,
        status: { in: ['initializing', 'recording', 'paused'] },
      },
    });

    if (activeRecordings >= 1) {
      throw new BadRequestException(
        'You can only have one active recording at a time',
      );
    }

    // Check monthly recording limit based on subscription
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlyRecordings = await this.prisma.videoRecording.count({
      where: {
        userId,
        createdAt: { gte: monthStart },
        status: 'completed',
      },
    });

    const limits: Record<string, number> = {
      FREE: 2,
      PRO: 50,
      ENTERPRISE: 500,
    };

    const limit = limits[user?.subscriptionTier || 'FREE'] || 2;

    if (monthlyRecordings >= limit) {
      throw new BadRequestException(
        `Monthly recording limit reached (${limit} recordings). Upgrade your plan for more.`,
      );
    }
  }

  private async getSession(
    sessionId: string,
    userId: string,
  ): Promise<RecordingSession> {
    // Check active sessions first
    const activeSession = this.activeSessions.get(sessionId);
    if (activeSession && activeSession.userId === userId) {
      return activeSession;
    }

    // Check database
    const recording = await this.prisma.videoRecording.findFirst({
      where: { id: sessionId, userId },
    });

    if (!recording) {
      throw new NotFoundException('Recording session not found');
    }

    return {
      id: recording.id,
      projectId: recording.projectId ?? '',
      userId: recording.userId ?? '',
      status: recording.status as RecordingSession['status'],
      startedAt: recording.startedAt || recording.createdAt,
      duration: recording.duration || undefined,
      settings: recording.settings as unknown as RecordingSettings,
    };
  }

  private async generateChunkUploadUrls(
    sessionId: string,
    count: number,
  ): Promise<Array<{ index: number; url: string }>> {
    const urls: Array<{ index: number; url: string }> = [];

    for (let i = 0; i < count; i++) {
      const key = `recordings/${sessionId}/chunks/screen_${i.toString().padStart(6, '0')}.webm`;
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: 'video/webm',
      });
      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600,
      });
      urls.push({ index: i, url });
    }

    return urls;
  }
}
