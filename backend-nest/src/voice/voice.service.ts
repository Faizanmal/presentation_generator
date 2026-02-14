import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { AIService } from '../ai/ai.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TranscriptionResult {
  text: string;
  duration: number;
  language: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

export interface VoiceGenerationResult {
  recordingId: string;
  transcription: string;
  presentation: unknown;
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Upload and start processing a voice recording
   */
  async uploadVoiceRecording(
    userId: string,
    file: Express.Multer.File,
    projectId?: string,
  ) {
    // Validate file type
    const allowedTypes = [
      'audio/mpeg',
      'audio/wav',
      'audio/webm',
      'audio/mp4',
      'audio/ogg',
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid audio file type');
    }

    // Upload to S3
    const uploadResult = await this.uploadService.uploadFile(
      file,
      userId,
      'voice',
    );

    // Create recording record
    const recording = await this.prisma.voiceRecording.create({
      data: {
        userId,
        projectId,
        filename: file.originalname,
        url: uploadResult.url,
        duration: 0, // Will be updated after processing
        status: 'UPLOADING',
      },
    });

    // Start async processing
    void this.processRecording(recording.id, file).catch((error) => {
      this.logger.error(`Failed to process recording ${recording.id}`, error);
      void this.updateRecordingStatus(recording.id, 'FAILED');
    });

    return recording;
  }

  /**
   * Process a voice recording - transcribe and optionally generate slides
   */
  private async processRecording(
    recordingId: string,
    file: Express.Multer.File,
  ) {
    try {
      // Update status to transcribing
      await this.updateRecordingStatus(recordingId, 'TRANSCRIBING');

      // Transcribe the audio
      const transcription = await this.transcribeAudio(file);

      // Update recording with transcription
      await this.prisma.voiceRecording.update({
        where: { id: recordingId },
        data: {
          transcription: transcription.text,
          duration: transcription.duration,
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      });

      this.logger.log(`Recording ${recordingId} processed successfully`);
    } catch (error) {
      this.logger.error(`Error processing recording ${recordingId}`, error);
      await this.updateRecordingStatus(recordingId, 'FAILED');
      throw error;
    }
  }

  /**
   * Transcribe audio using OpenAI Whisper
   */
  async transcribeAudio(
    file: Express.Multer.File,
  ): Promise<TranscriptionResult> {
    try {
      // Write buffer to temp file (Whisper requires a file)
      const tempPath = path.join(
        os.tmpdir(),
        `whisper-${Date.now()}-${file.originalname}`,
      );
      fs.writeFileSync(tempPath, file.buffer);

      const transcription = await this.aiService.transcribeAudio(
        fs.createReadStream(tempPath),
        'en', // Auto-detect if not specified
      );

      // Clean up temp file
      fs.unlinkSync(tempPath);

      const transcriptionResult = transcription as {
        text: string;
        duration?: number;
        language?: string;
        segments?: Array<{ start: number; end: number; text: string }>;
      };

      return {
        text: transcriptionResult.text,
        duration: transcriptionResult.duration || 0,
        language: transcriptionResult.language || 'en',
        segments: transcriptionResult.segments?.map((seg) => ({
          start: seg.start,
          end: seg.end,
          text: seg.text,
        })),
      };
    } catch (error) {
      this.logger.error('Transcription failed', error);
      throw new InternalServerErrorException('Failed to transcribe audio');
    }
  }

  /**
   * Generate slides from a voice recording's transcription
   */
  async generateSlidesFromVoice(
    recordingId: string,
    userId: string,
    options?: {
      tone?: string;
      audience?: string;
      length?: number;
    },
  ): Promise<VoiceGenerationResult> {
    const recording = await this.prisma.voiceRecording.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      throw new BadRequestException('Recording not found');
    }

    if (recording.userId !== userId) {
      throw new BadRequestException('Unauthorized');
    }

    if (!recording.transcription) {
      throw new BadRequestException('Recording has not been transcribed yet');
    }

    // Update status
    await this.updateRecordingStatus(recordingId, 'GENERATING');

    try {
      // Use the AI service to generate presentation from transcription
      const presentation = await this.aiService.generatePresentation({
        topic: recording.transcription,
        tone: options?.tone || 'professional',
        audience: options?.audience || 'general',
        length: options?.length || 5,
        type: 'presentation',
      });

      await this.updateRecordingStatus(recordingId, 'COMPLETED');

      return {
        recordingId,
        transcription: recording.transcription,
        presentation,
      };
    } catch (error) {
      await this.updateRecordingStatus(recordingId, 'FAILED');
      throw error;
    }
  }

  /**
   * Get user's voice recordings
   */
  async getUserRecordings(userId: string, projectId?: string) {
    return this.prisma.voiceRecording.findMany({
      where: {
        userId,
        ...(projectId && { projectId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a specific recording
   */
  async getRecording(recordingId: string, userId: string) {
    const recording = await this.prisma.voiceRecording.findUnique({
      where: { id: recordingId },
    });

    if (!recording || recording.userId !== userId) {
      throw new BadRequestException('Recording not found');
    }

    return recording;
  }

  /**
   * Delete a recording
   */
  async deleteRecording(recordingId: string, userId: string) {
    const recording = await this.getRecording(recordingId, userId);

    // Delete from S3
    await this.uploadService.deleteFile(recording.url);

    // Delete from database
    return this.prisma.voiceRecording.delete({
      where: { id: recordingId },
    });
  }

  async startLiveTranscription(userId: string) {
    // This would integrate with a streaming ASR service
    // For now, we'll use batch processing with Whisper
    // In production, consider using:
    // - Azure Speech Services real-time transcription
    // - Google Cloud Speech-to-Text streaming
    // - Deepgram real-time API

    this.logger.log(`Starting live transcription for user ${userId}`);
    await Promise.resolve(); // Simulate async work

    return {
      stop: () => {
        this.logger.log(`Stopping live transcription for user ${userId}`);
      },
    };
  }

  private async updateRecordingStatus(
    recordingId: string,
    status:
      | 'UPLOADING'
      | 'TRANSCRIBING'
      | 'GENERATING'
      | 'COMPLETED'
      | 'FAILED',
  ) {
    return this.prisma.voiceRecording.update({
      where: { id: recordingId },
      data: { status },
    });
  }
}
