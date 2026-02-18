import { Test, TestingModule } from '@nestjs/testing';
import { NarrationExportService } from './narration-export.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AIService } from '../ai/ai.service';
import { NotFoundException } from '@nestjs/common';

describe('NarrationExportService', () => {
  let service: NarrationExportService;

  const mockProject = {
    id: 'project-1',
    ownerId: 'user-1',
    title: 'Test Presentation',
    slides: [
      {
        id: 'slide-1',
        order: 0,
        title: 'Introduction',
        blocks: [
          {
            id: 'block-1',
            type: 'TEXT',
            content: { text: 'Welcome to this presentation' },
          },
        ],
      },
      {
        id: 'slide-2',
        order: 1,
        title: 'Main Content',
        blocks: [
          {
            id: 'block-2',
            type: 'TEXT',
            content: { text: 'Here is the main content' },
          },
        ],
      },
    ],
    theme: {
      colors: { background: '#ffffff', text: '#000000' },
    },
  };

  const mockPrismaService = {
    project: {
      findFirst: jest.fn(),
    },
    narrationProject: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    videoExportJob: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    narrationSlide: { create: jest.fn() },
    speakerNote: { upsert: jest.fn(), findUnique: jest.fn() },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        AWS_S3_BUCKET: '', // keep empty to avoid S3 uploads in tests
        AWS_S3_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
      };
      return config[key];
    }),
  };

  const mockAIService = {
    chatCompletion: jest.fn().mockResolvedValue({
      choices: [{ message: { content: 'Generated speaker notes' } }],
    }),
    generateSpeech: jest.fn().mockResolvedValue(Buffer.from('audio data')),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NarrationExportService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AIService,
          useValue: mockAIService,
        },
      ],
    }).compile();

    service = module.get<NarrationExportService>(NarrationExportService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSpeakerNotes', () => {
    it('should generate speaker notes for project', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockAIService.chatCompletion.mockResolvedValueOnce({
        choices: [{ message: { content: 'Generated speaker notes' } }],
      });

      const result = await service.generateSpeakerNotes('project-1', 'user-1');

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(mockAIService.chatCompletion).toHaveBeenCalled();
    });

    it('should throw NotFoundException if project not found', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.generateSpeakerNotes('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateSlideAudio', () => {
    it('should generate audio for a slide', async () => {
      mockAIService.generateSpeech.mockResolvedValueOnce(
        Buffer.from('audio data'),
      );

      const result = await service.generateSlideAudio(
        'slide-1',
        'Hello world',
        'alloy',
        1.0,
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('audioUrl');
      expect(typeof result.duration).toBe('number');
    });

    it('should throw when AI service fails', async () => {
      mockAIService.generateSpeech.mockRejectedValueOnce(
        new Error('TTS failed'),
      );

      await expect(
        service.generateSlideAudio('slide-1', 'Test text', 'alloy', 1.0),
      ).rejects.toThrow();
    });
  });

  describe('exportVideo', () => {
    it('should create a video export job', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.videoExportJob.create.mockResolvedValue({
        id: 'job-1',
        projectId: 'project-1',
        format: 'mp4',
        resolution: '1080p',
        includeNarration: true,
        slideDuration: 5,
        status: 'PENDING',
        progress: 0,
        createdAt: new Date(),
      });

      const result = await service.exportVideo('project-1', 'user-1', {
        format: 'mp4',
        resolution: '1080p',
        includeNarration: true,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('job-1');
      expect(mockPrismaService.videoExportJob.create).toHaveBeenCalled();
    });
  });

  describe('getNarrationProject', () => {
    it('should return narration project status', async () => {
      const mockProjectRecord = {
        id: 'narr-1',
        projectId: 'project-1',
        voice: 'alloy',
        speed: 1.0,
        slides: [],
        totalDuration: 10,
        status: 'completed',
        createdAt: new Date(),
      } as any;

      mockPrismaService.narrationProject.findUnique.mockResolvedValue(
        mockProjectRecord,
      );

      const result = await service.getNarrationProject('narr-1');

      expect(result).toBeDefined();
      expect(result?.status).toBe('completed');
    });

    it('should return null if project not found', async () => {
      mockPrismaService.narrationProject.findUnique.mockResolvedValue(null);

      const result = await service.getNarrationProject('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getVoiceOptions', () => {
    it('should return list of available voices', () => {
      const voices = service.getVoiceOptions();

      expect(voices).toBeInstanceOf(Array);
      expect(voices.length).toBeGreaterThan(0);
      expect(voices[0]).toHaveProperty('id');
      expect(voices[0]).toHaveProperty('name');
    });
  });
});
