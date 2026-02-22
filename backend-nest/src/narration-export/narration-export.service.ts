import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type VoiceId = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type ExportFormat = 'mp3' | 'mp4' | 'webm';

export interface VoiceOption {
  id: VoiceId;
  name: string;
  description: string;
  gender: 'male' | 'female' | 'neutral';
  style: string;
}

export interface NarrationSlide {
  slideId: string;
  slideNumber: number;
  speakerNotes: string;
  audioUrl?: string;
  duration?: number; // seconds
}

export interface NarrationProject {
  id: string;
  projectId: string;
  voice: VoiceId;
  speed: number;
  slides: NarrationSlide[];
  totalDuration: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  createdAt: Date;
}

export interface VideoExportJob {
  id: string;
  projectId: string;
  format: ExportFormat;
  resolution: '720p' | '1080p' | '4k';
  includeNarration: boolean;
  slideTransition: 'none' | 'fade' | 'slide';
  slideDuration: number; // default seconds per slide
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputUrl?: string;
  error?: string;
  createdAt: Date;
}

@Injectable()
export class NarrationExportService {
  private readonly logger = new Logger(NarrationExportService.name);

  readonly voiceOptions: VoiceOption[] = [
    {
      id: 'alloy',
      name: 'Alloy',
      description: 'Neutral and balanced',
      gender: 'neutral',
      style: 'professional',
    },
    {
      id: 'echo',
      name: 'Echo',
      description: 'Warm and engaging',
      gender: 'male',
      style: 'conversational',
    },
    {
      id: 'fable',
      name: 'Fable',
      description: 'Expressive and dynamic',
      gender: 'neutral',
      style: 'storytelling',
    },
    {
      id: 'onyx',
      name: 'Onyx',
      description: 'Deep and authoritative',
      gender: 'male',
      style: 'formal',
    },
    {
      id: 'nova',
      name: 'Nova',
      description: 'Friendly and upbeat',
      gender: 'female',
      style: 'casual',
    },
    {
      id: 'shimmer',
      name: 'Shimmer',
      description: 'Clear and professional',
      gender: 'female',
      style: 'business',
    },
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
    @InjectQueue('narration') private readonly narrationQueue: Queue,
  ) {
    // Initialize S3 client
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

  private s3Client: S3Client;
  private bucketName: string;
  private execAsync = promisify(exec);

  /**
   * Get available voice options
   */
  getVoiceOptions(): VoiceOption[] {
    return this.voiceOptions;
  }

  /**
   * Generate speaker notes for all slides using AI
   */
  async generateSpeakerNotes(
    projectId: string,
    userId: string,
    options?: {
      tone?: 'professional' | 'casual' | 'educational' | 'persuasive';
      duration?: 'short' | 'medium' | 'detailed';
    },
  ): Promise<NarrationSlide[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
      include: {
        slides: {
          include: { blocks: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const tone = options?.tone || 'professional';
    const duration = options?.duration || 'medium';

    const durationGuide = {
      short: '30-60 seconds per slide',
      medium: '1-2 minutes per slide',
      detailed: '2-4 minutes per slide',
    };

    const narrationSlides: NarrationSlide[] = [];

    for (let i = 0; i < project.slides.length; i++) {
      const slide = project.slides[i];
      const slideContent = this.extractSlideContent(slide);

      const prompt = `
Generate speaker notes for this presentation slide.

SLIDE ${i + 1} CONTENT:
${slideContent}

GUIDELINES:
- Tone: ${tone}
- Target duration: ${durationGuide[duration]}
- The notes should be written as if speaking directly to the audience
- Include natural pauses (indicated by "...")
- Add emphasis cues for important points [EMPHASIS]
- Include transitions if not the first slide

Return only the speaker notes, ready to be read aloud.
      `.trim();

      try {
        const response = await this.aiService.chatCompletion({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content:
                'You are an expert presentation coach. Generate engaging speaker notes that sound natural when spoken aloud.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 500,
        });

        const speakerNotes =
          response.choices[0]?.message?.content?.trim() || '';

        // Save to database
        await this.prisma.speakerNote.upsert({
          where: { slideId: slide.id },
          create: {
            slideId: slide.id,
            content: speakerNotes,
            isAIGenerated: true,
          },
          update: {
            content: speakerNotes,
            isAIGenerated: true,
          },
        });

        narrationSlides.push({
          slideId: slide.id,
          slideNumber: i + 1,
          speakerNotes,
        });
      } catch (error) {
        this.logger.error(
          `Failed to generate notes for slide ${slide.id}:`,
          error,
        );
        narrationSlides.push({
          slideId: slide.id,
          slideNumber: i + 1,
          speakerNotes: '',
        });
      }
    }

    return narrationSlides;
  }

  /**
   * Generate audio narration for slides
   */
  async generateNarration(
    projectId: string,
    userId: string,
    options: {
      voice: VoiceId;
      speed?: number; // 0.25 to 4.0
      slideIds?: string[]; // Optional: generate for specific slides only
    },
  ): Promise<NarrationProject> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
      include: {
        slides: {
          include: { blocks: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const speed = Math.max(0.25, Math.min(4.0, options.speed || 1.0));
    const slidesToProcess = options.slideIds
      ? project.slides.filter((s) => options.slideIds!.includes(s.id))
      : project.slides;

    // Create narration project record
    const narrationProject = await this.prisma.narrationProject.create({
      data: {
        projectId,
        voice: options.voice,
        speed,
        status: 'generating',
        totalDuration: 0,
      },
    });

    // Enqueue narration job (processed by worker)
    await this.narrationQueue.add(
      'generate-narration',
      {
        narrationProjectId: narrationProject.id,
        slides: slidesToProcess,
        voice: options.voice,
        speed,
      },
      { attempts: 3, removeOnComplete: true },
    );

    return {
      id: narrationProject.id,
      projectId,
      voice: options.voice,
      speed,
      slides: [],
      totalDuration: 0,
      status: 'generating',
      createdAt: narrationProject.createdAt,
    };
  }

  /**
   * Generate audio for a single slide
   */
  async generateSlideAudio(
    slideId: string,
    speakerNotes: string,
    voice: VoiceId,
    speed: number = 1.0,
  ): Promise<{ audioUrl: string; duration: number }> {
    try {
      const buffer = await this.aiService.generateSpeech(
        speakerNotes,
        voice,
        speed,
      );

      // Estimate duration (approximate: ~150 words per minute at speed 1.0)
      const wordCount = speakerNotes.split(/\s+/).length;
      const estimatedDuration = ((wordCount / 150) * 60) / speed;

      // Upload to S3
      const filename = `narration_${slideId}_${uuidv4()}.mp3`;
      const key = `narrations/${filename}`;

      let audioUrl: string;

      if (this.bucketName) {
        // Upload to S3
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: 'audio/mpeg',
            ACL: 'public-read',
          }),
        );
        audioUrl = `https://${this.bucketName}.s3.amazonaws.com/${key}`;
      } else {
        // Fallback to local storage for development
        const uploadsDir = path.join(process.cwd(), 'uploads', 'narrations');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, buffer);
        audioUrl = `/uploads/narrations/${filename}`;
      }

      return {
        audioUrl,
        duration: Math.round(estimatedDuration),
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate audio for slide ${slideId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Export presentation as video with narration
   */
  async exportVideo(
    projectId: string,
    userId: string,
    options: {
      format: ExportFormat;
      resolution: '720p' | '1080p' | '4k';
      includeNarration: boolean;
      slideTransition?: 'none' | 'fade' | 'slide';
      slideDuration?: number;
      narrationProjectId?: string;
    },
  ): Promise<VideoExportJob> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Create export job
    const job = await this.prisma.videoExportJob.create({
      data: {
        projectId,
        format: options.format,
        resolution: options.resolution,
        includeNarration: options.includeNarration,
        slideTransition: options.slideTransition || 'fade',
        slideDuration: options.slideDuration || 5,
        narrationProjectId: options.narrationProjectId,
        status: 'PENDING',
        progress: 0,
      },
    });

    // Process async
    void this.processVideoExport(job.id);

    return {
      id: job.id,
      projectId,
      format: options.format,
      resolution: options.resolution,
      includeNarration: options.includeNarration,
      slideTransition: options.slideTransition || 'fade',
      slideDuration: options.slideDuration || 5,
      status: 'pending',
      progress: 0,
      createdAt: job.createdAt,
    };
  }

  /**
   * Get narration project status
   */
  async getNarrationProject(
    narrationProjectId: string,
  ): Promise<NarrationProject | null> {
    const project = await this.prisma.narrationProject.findUnique({
      where: { id: narrationProjectId },
      include: {
        slides: true,
      },
    });

    if (!project) return null;

    return {
      id: project.id,
      projectId: project.projectId,
      voice: project.voice as VoiceId,
      speed: project.speed,
      slides: project.slides.map((s) => ({
        slideId: s.slideId,
        slideNumber: s.slideNumber,
        speakerNotes: s.speakerNotes,
        audioUrl: s.audioUrl || undefined,
        duration: s.audioDuration || undefined,
      })),
      totalDuration: project.totalDuration,
      status: project.status as NarrationProject['status'],
      createdAt: project.createdAt,
    };
  }

  /**
   * Get video export job status
   */
  async getVideoExportJob(jobId: string): Promise<VideoExportJob | null> {
    const job = await this.prisma.videoExportJob.findUnique({
      where: { id: jobId },
    });

    if (!job) return null;

    return {
      id: job.id,
      projectId: job.projectId || '',
      format: job.format as ExportFormat,
      resolution: job.resolution as '720p' | '1080p' | '4k',
      includeNarration: job.includeNarration,
      slideTransition: job.slideTransition as 'none' | 'fade' | 'slide',
      slideDuration: job.slideDuration,
      status: job.status as VideoExportJob['status'],
      progress: job.progress,
      outputUrl: job.outputUrl || undefined,
      error: job.error || undefined,
      createdAt: job.createdAt,
    };
  }

  /**
   * Update speaker notes manually
   */
  async updateSpeakerNotes(
    slideId: string,
    speakerNotes: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const slide = await this.prisma.slide.findFirst({
      where: {
        id: slideId,
        project: { ownerId: userId },
      },
    });

    if (!slide) {
      throw new NotFoundException('Slide not found');
    }

    await this.prisma.speakerNote.upsert({
      where: { slideId },
      create: {
        slideId,
        content: speakerNotes,
        isAIGenerated: false,
      },
      update: {
        content: speakerNotes,
        isAIGenerated: false,
      },
    });

    return { success: true };
  }

  // Private methods
  async processNarration(
    narrationProjectId: string,
    slides: { id: string; blocks?: { content: unknown }[] }[],
    voice: VoiceId,
    speed: number,
  ) {
    try {
      let totalDuration = 0;

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];

        // Get speaker notes
        const speakerNote = await this.prisma.speakerNote.findUnique({
          where: { slideId: slide.id },
        });

        const notes = speakerNote?.content || this.extractSlideContent(slide);

        if (!notes || notes.length < 10) {
          continue;
        }

        try {
          const { audioUrl, duration } = await this.generateSlideAudio(
            slide.id,
            notes,
            voice,
            speed,
          );

          await this.prisma.narrationSlide.create({
            data: {
              narrationProjectId,
              slideId: slide.id,
              slideNumber: i + 1,
              speakerNotes: notes,
              audioUrl,
              duration,
            },
          });

          totalDuration += duration;

          // Update progress
          await this.prisma.narrationProject.update({
            where: { id: narrationProjectId },
            data: { totalDuration },
          });
        } catch (error) {
          this.logger.error(
            `Failed to generate audio for slide ${slide.id}:`,
            error,
          );
        }
      }

      await this.prisma.narrationProject.update({
        where: { id: narrationProjectId },
        data: {
          status: 'completed',
          totalDuration,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Narration project ${narrationProjectId} failed: ${message}`,
        error,
      );
      await this.prisma.narrationProject.update({
        where: { id: narrationProjectId },
        data: { status: 'failed' },
      });
    }
  }

  private async processVideoExport(jobId: string) {
    try {
      await this.prisma.videoExportJob.update({
        where: { id: jobId },
        data: { status: 'PROCESSING' },
      });

      const job = await this.prisma.videoExportJob.findUnique({
        where: { id: jobId },
        include: {
          narrationProject: {
            include: {
              slides: true,
            },
          },
        },
      });

      if (!job || !job.narrationProject) {
        throw new Error('Job or narration project not found');
      }

      // Fetch the project separately
      const project = await this.prisma.project.findUnique({
        where: { id: job.narrationProject.projectId },
        include: {
          slides: {
            include: { blocks: true },
            orderBy: { order: 'asc' },
          },
          theme: true,
        },
      });

      if (!project) {
        throw new Error('Project not found');
      }

      const slides = project.slides;
      const narrationSlides = job.narrationProject.slides;

      // Create temp directory for video processing
      const tempDir = path.join(os.tmpdir(), `video_export_${jobId}`);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Get resolution settings
      const resolutions: Record<string, { width: number; height: number }> = {
        '720p': { width: 1280, height: 720 },
        '1080p': { width: 1920, height: 1080 },
        '4k': { width: 3840, height: 2160 },
      };
      const res =
        resolutions[job.resolution || '1080p'] || resolutions['1080p'];

      // Check if FFmpeg is available
      let ffmpegAvailable = false;
      try {
        await this.execAsync('which ffmpeg');
        ffmpegAvailable = true;
      } catch {
        this.logger.warn(
          'FFmpeg not available, using fallback video generation',
        );
      }

      const totalSlides = slides.length;
      const slideDuration = job.slideDuration || 5;

      // Generate slide images (simplified - in production use HTML to image)
      const slideImages: string[] = [];
      for (let i = 0; i < totalSlides; i++) {
        // Update progress
        await this.prisma.videoExportJob.update({
          where: { id: jobId },
          data: {
            progress: Math.round(((i + 1) / totalSlides) * 30),
          },
        });

        // Create a simple slide image placeholder
        // In production, use puppeteer to screenshot actual rendered slides
        slideImages.push(`slide_${i}.png`);
      }

      let outputUrl: string;

      if (ffmpegAvailable && job.includeNarration) {
        // Generate video with FFmpeg
        try {
          // Create concat file for FFmpeg
          const concatFile = path.join(tempDir, 'concat.txt');
          let concatContent = '';

          for (let i = 0; i < totalSlides; i++) {
            const duration = narrationSlides[i]?.duration || slideDuration;
            concatContent += `file 'slide_${i}.png'\nduration ${duration}\n`;
          }
          fs.writeFileSync(concatFile, concatContent);

          // Generate video
          const outputFile = path.join(tempDir, `output.${job.format}`);
          const ffmpegCmd = `ffmpeg -f concat -safe 0 -i ${concatFile} -vf "scale=${res.width}:${res.height}" -c:v libx264 -pix_fmt yuv420p ${outputFile}`;

          await this.execAsync(ffmpegCmd);

          // Upload to S3
          if (this.bucketName && fs.existsSync(outputFile)) {
            const videoBuffer = fs.readFileSync(outputFile);
            const key = `exports/video_${project.id}_${Date.now()}.${job.format}`;

            await this.s3Client.send(
              new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: videoBuffer,
                ContentType: job.format === 'mp4' ? 'video/mp4' : 'video/webm',
                ACL: 'public-read',
              }),
            );

            outputUrl = `https://${this.bucketName}.s3.amazonaws.com/${key}`;
          } else {
            outputUrl = `/exports/video_${project.id}_${Date.now()}.${job.format}`;
          }
        } catch (ffmpegError) {
          this.logger.error('FFmpeg processing failed:', ffmpegError);
          throw new Error('Video processing failed', {
            cause: ffmpegError as Error,
          });
        }
      } else {
        // Fallback: Create a slideshow-style export using HTML
        // This generates a downloadable HTML presentation with autoplay
        const htmlContent = this.generateVideoFallbackHtml(
          project,
          narrationSlides.map((slide) => ({
            duration: slide.duration || undefined,
            audioUrl: slide.audioUrl || undefined,
          })),
          slideDuration,
        );
        const filename = `video_${project.id}_${Date.now()}.html`;

        if (this.bucketName) {
          const key = `exports/${filename}`;
          await this.s3Client.send(
            new PutObjectCommand({
              Bucket: this.bucketName,
              Key: key,
              Body: htmlContent,
              ContentType: 'text/html',
              ACL: 'public-read',
            }),
          );
          outputUrl = `https://${this.bucketName}.s3.amazonaws.com/${key}`;
        } else {
          const exportsDir = path.join(process.cwd(), 'exports');
          if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
          }
          fs.writeFileSync(path.join(exportsDir, filename), htmlContent);
          outputUrl = `/exports/${filename}`;
        }
      }

      // Cleanup temp directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }

      await this.prisma.videoExportJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          outputUrl,
        },
      });
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Video export job ${jobId} failed:`, err);
      await this.prisma.videoExportJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          error: err.message,
        },
      });
    }
  }

  private extractSlideContent(slide: {
    blocks?: Array<{ content: unknown }>;
  }): string {
    const blocks = slide.blocks || [];
    const textParts: string[] = [];

    for (const block of blocks) {
      const content = block.content;
      if (typeof content === 'string') {
        textParts.push(content);
      } else if (typeof content === 'object' && content !== null) {
        const anyContent = content as Record<string, unknown>;
        if (typeof anyContent.text === 'string') {
          textParts.push(anyContent.text);
        } else if (typeof anyContent.content === 'string') {
          textParts.push(anyContent.content);
        } else if (Array.isArray(anyContent.items)) {
          textParts.push((anyContent.items as string[]).join('. '));
        }
      }
    }

    return textParts.join('\n\n');
  }

  /**
   * Generate an HTML-based video fallback with auto-advancing slides
   */
  private generateVideoFallbackHtml(
    project: {
      title: string;
      slides: Array<{
        blocks?: Array<{ blockType: string; content: unknown }>;
      }>;
    },
    narrationSlides: Array<{ duration?: number; audioUrl?: string }>,
    defaultDuration: number,
  ): string {
    const slidesHtml = project.slides
      .map((slide, index) => {
        const content = this.extractSlideContent(slide);
        const duration = narrationSlides[index]?.duration || defaultDuration;
        const audioUrl = narrationSlides[index]?.audioUrl;

        return `
        <div class="slide" data-duration="${duration * 1000}" ${audioUrl ? `data-audio="${audioUrl}"` : ''}>
          <div class="slide-content">
            <div class="slide-number">${index + 1} / ${project.slides.length}</div>
            <pre>${this.escapeHtml(content)}</pre>
          </div>
        </div>
      `;
      })
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(project.title)} - Video Export</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #1a1a1a; color: white; }
    .slide { display: none; width: 100vw; height: 100vh; align-items: center; justify-content: center; padding: 40px; }
    .slide.active { display: flex; }
    .slide-content { max-width: 1200px; text-align: center; }
    .slide-number { position: fixed; bottom: 20px; right: 20px; opacity: 0.5; }
    pre { white-space: pre-wrap; font-size: 24px; line-height: 1.6; }
    .progress { position: fixed; bottom: 0; left: 0; height: 4px; background: #3b82f6; transition: width 0.1s; }
    .controls { position: fixed; top: 20px; right: 20px; display: flex; gap: 10px; }
    button { padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 5px; cursor: pointer; }
    button:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="controls">
    <button onclick="togglePlay()">Play/Pause</button>
    <button onclick="prevSlide()">Prev</button>
    <button onclick="nextSlide()">Next</button>
  </div>
  ${slidesHtml}
  <div class="progress" id="progress"></div>
  
  <script>
    const slides = document.querySelectorAll('.slide');
    let currentSlide = 0;
    let isPlaying = true;
    let timer;
    let progressTimer;
    
    function showSlide(index) {
      slides.forEach(s => s.classList.remove('active'));
      slides[index].classList.add('active');
      currentSlide = index;
      
      // Play audio if available
      const audioUrl = slides[index].dataset.audio;
      if (audioUrl && isPlaying) {
        const audio = new Audio(audioUrl);
        audio.play().catch(() => {});
      }
      
      if (isPlaying) startSlideTimer();
    }
    
    function startSlideTimer() {
      clearTimeout(timer);
      clearInterval(progressTimer);
      
      const duration = parseInt(slides[currentSlide].dataset.duration) || 5000;
      const progressEl = document.getElementById('progress');
      let elapsed = 0;
      
      progressTimer = setInterval(() => {
        elapsed += 100;
        progressEl.style.width = (elapsed / duration * 100) + '%';
      }, 100);
      
      timer = setTimeout(() => {
        if (currentSlide < slides.length - 1) {
          showSlide(currentSlide + 1);
        } else {
          isPlaying = false;
          clearInterval(progressTimer);
        }
      }, duration);
    }
    
    function togglePlay() {
      isPlaying = !isPlaying;
      if (isPlaying) startSlideTimer();
      else {
        clearTimeout(timer);
        clearInterval(progressTimer);
      }
    }
    
    function nextSlide() {
      if (currentSlide < slides.length - 1) showSlide(currentSlide + 1);
    }
    
    function prevSlide() {
      if (currentSlide > 0) showSlide(currentSlide - 1);
    }
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'p') togglePlay();
    });
    
    // Start
    showSlide(0);
  </script>
</body>
</html>`;
  }

  /**
   * Escape HTML characters to prevent XSS
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Estimate narration duration for a text snippet (based on average reading speed)
   * Average speaking rate: ~150 words/minute
   */
  estimateSlideDuration(speakerNotes: string): number {
    const wordCount = speakerNotes.trim().split(/\s+/).filter(Boolean).length;
    const WORDS_PER_SECOND = 150 / 60; // 2.5 words/sec
    const rawSeconds = wordCount / WORDS_PER_SECOND;
    // Add 1 second buffer per slide, minimum 3 seconds
    return Math.max(3, Math.round(rawSeconds + 1));
  }

  /**
   * Get estimated total duration for a project's narration
   */
  async estimateProjectDuration(
    projectId: string,
    userId: string,
  ): Promise<{
    totalSeconds: number;
    perSlide: Array<{ slideId: string; estimatedSeconds: number }>;
  }> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
      include: {
        slides: {
          orderBy: { order: 'asc' },
          select: { id: true, speakerNotes: true },
        },
      },
    });

    if (!project) throw new Error('Project not found');

    const perSlide = project.slides.map((slide) => ({
      slideId: slide.id,
      estimatedSeconds: this.estimateSlideDuration(
        (slide.speakerNotes as string) || '',
      ),
    }));

    const totalSeconds = perSlide.reduce(
      (sum, s) => sum + s.estimatedSeconds,
      0,
    );
    return { totalSeconds, perSlide };
  }

  /**
   * Generate a short voice preview (first sentence of the first slide's notes)
   */
  async generateVoicePreview(
    text: string,
    voice: VoiceId = 'alloy',
    speed: number = 1.0,
  ): Promise<{ audioBase64: string; durationEstimate: number }> {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!openaiKey) throw new Error('OpenAI API key not configured for TTS');

    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: openaiKey });

    // Take at most the first 200 characters for the preview
    const previewText = text.slice(0, 200).trim();
    if (!previewText) throw new Error('No text provided for preview');

    const response = await client.audio.speech.create({
      model: 'tts-1',
      voice,
      input: previewText,
      speed,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    const audioBase64 = buffer.toString('base64');
    const durationEstimate = this.estimateSlideDuration(previewText);

    return { audioBase64, durationEstimate };
  }

  /**
   * Get available voice options with preview samples
   */
  getVoiceOptionsWithSamples(): Array<VoiceOption & { sampleText: string }> {
    const sampleTexts: Record<VoiceId, string> = {
      alloy:
        "Welcome to this presentation. Let's explore the key insights together.",
      echo: "Good morning everyone. Today we'll be covering some exciting new developments.",
      fable:
        'Once upon a time, in the world of data, a story emerged from the numbers.',
      onyx: 'Ladies and gentlemen, the findings before you represent months of rigorous research.',
      nova: "Hey there! Ready to dive into something really cool today? Let's get started!",
      shimmer:
        'Thank you for joining us today. We have an informative session ahead.',
    };

    return this.voiceOptions.map((v) => ({
      ...v,
      sampleText: sampleTexts[v.id],
    }));
  }
}
