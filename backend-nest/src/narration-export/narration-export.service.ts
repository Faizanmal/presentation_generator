import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

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
  private openai: OpenAI;

  readonly voiceOptions: VoiceOption[] = [
    { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced', gender: 'neutral', style: 'professional' },
    { id: 'echo', name: 'Echo', description: 'Warm and engaging', gender: 'male', style: 'conversational' },
    { id: 'fable', name: 'Fable', description: 'Expressive and dynamic', gender: 'neutral', style: 'storytelling' },
    { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative', gender: 'male', style: 'formal' },
    { id: 'nova', name: 'Nova', description: 'Friendly and upbeat', gender: 'female', style: 'casual' },
    { id: 'shimmer', name: 'Shimmer', description: 'Clear and professional', gender: 'female', style: 'business' },
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

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
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert presentation coach. Generate engaging speaker notes that sound natural when spoken aloud.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 500,
        });

        const speakerNotes = response.choices[0]?.message?.content?.trim() || '';

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
        this.logger.error(`Failed to generate notes for slide ${slide.id}:`, error);
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
      ? project.slides.filter(s => options.slideIds!.includes(s.id))
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

    // Process asynchronously
    this.processNarration(narrationProject.id, slidesToProcess, options.voice, speed);

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
      const mp3 = await this.openai.audio.speech.create({
        model: 'tts-1-hd',
        voice,
        input: speakerNotes,
        speed,
        response_format: 'mp3',
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      
      // Estimate duration (approximate: ~150 words per minute at speed 1.0)
      const wordCount = speakerNotes.split(/\s+/).length;
      const estimatedDuration = (wordCount / 150) * 60 / speed;

      // In production, upload to S3
      // For now, save locally and return path
      const filename = `narration_${slideId}_${Date.now()}.mp3`;
      const uploadsDir = path.join(process.cwd(), 'uploads', 'narrations');
      
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, buffer);

      // In production, this would be an S3 URL
      const audioUrl = `/uploads/narrations/${filename}`;

      return {
        audioUrl,
        duration: Math.round(estimatedDuration),
      };
    } catch (error) {
      this.logger.error(`Failed to generate audio for slide ${slideId}:`, error);
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
        status: 'pending',
        progress: 0,
      },
    });

    // Process async
    this.processVideoExport(job.id);

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
  async getNarrationProject(narrationProjectId: string): Promise<NarrationProject | null> {
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
      slides: project.slides.map(s => ({
        slideId: s.slideId,
        slideNumber: s.slideNumber,
        speakerNotes: s.speakerNotes,
        audioUrl: s.audioUrl || undefined,
        duration: s.duration || undefined,
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
      projectId: job.projectId,
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
  private async processNarration(
    narrationProjectId: string,
    slides: any[],
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
          this.logger.error(`Failed to generate audio for slide ${slide.id}:`, error);
        }
      }

      await this.prisma.narrationProject.update({
        where: { id: narrationProjectId },
        data: {
          status: 'completed',
          totalDuration,
        },
      });
    } catch (error) {
      this.logger.error(`Narration project ${narrationProjectId} failed:`, error);
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
        data: { status: 'processing' },
      });

      const job = await this.prisma.videoExportJob.findUnique({
        where: { id: jobId },
        include: {
          project: {
            include: {
              slides: {
                include: { blocks: true },
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      });

      if (!job) return;

      // In production, this would use FFmpeg or a video generation service
      // For now, we'll simulate the progress
      const totalSlides = job.project.slides.length;
      
      for (let i = 0; i < totalSlides; i++) {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await this.prisma.videoExportJob.update({
          where: { id: jobId },
          data: {
            progress: Math.round(((i + 1) / totalSlides) * 100),
          },
        });
      }

      // In production, this would be the actual video URL
      const outputUrl = `/exports/video_${job.projectId}_${Date.now()}.${job.format}`;

      await this.prisma.videoExportJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          progress: 100,
          outputUrl,
        },
      });
    } catch (error) {
      this.logger.error(`Video export job ${jobId} failed:`, error);
      await this.prisma.videoExportJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          error: error.message,
        },
      });
    }
  }

  private extractSlideContent(slide: any): string {
    const blocks = slide.blocks || [];
    const textParts: string[] = [];

    for (const block of blocks) {
      const content = block.content;
      if (typeof content === 'string') {
        textParts.push(content);
      } else if (content?.text) {
        textParts.push(content.text);
      } else if (content?.content) {
        textParts.push(content.content);
      } else if (Array.isArray(content?.items)) {
        textParts.push(content.items.join('. '));
      }
    }

    return textParts.join('\n\n');
  }
}
