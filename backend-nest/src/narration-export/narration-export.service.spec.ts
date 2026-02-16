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
    narrationExport: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        AWS_S3_BUCKET: 'test-bucket',
        AWS_S3_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
      };
      return config[key];
    }),
  };

  const mockAIService = {
    generateNarration: jest.fn().mockResolvedValue('This is the narration for slide 1'),
    textToSpeech: jest.fn().mockResolvedValue(Buffer.from('audio data')),
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

  describe('generateNarrationScript', () => {
    it('should generate narration script for project', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockAIService.generateNarration.mockResolvedValue('Generated narration text');

      const result = await service.generateNarrationScript('project-1', 'user-1');

      expect(result).toBeDefined();
      expect(result.slides).toHaveLength(2);
      expect(mockAIService.generateNarration).toHaveBeenCalled();
    });

    it('should throw NotFoundException if project not found', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.generateNarrationScript('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateAudio', () => {
    it('should generate audio from text', async () => {
      mockAIService.textToSpeech.mockResolvedValue(Buffer.from('audio data'));

      const result = await service.generateAudio('Hello world', {
        voice: 'alloy',
        speed: 1.0,
      });

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should use default voice settings', async () => {
      await service.generateAudio('Test text');

      expect(mockAIService.textToSpeech).toHaveBeenCalledWith(
        'Test text',
        expect.objectContaining({
          voice: 'alloy',
        }),
      );
    });
  });

  describe('exportWithNarration', () => {
    it('should create a narration export job', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.narrationExport.create.mockResolvedValue({
        id: 'export-1',
        projectId: 'project-1',
        status: 'PENDING',
        format: 'AUDIO',
      });

      const result = await service.exportWithNarration('project-1', 'user-1', {
        format: 'audio',
        voice: 'alloy',
        speed: 1.0,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('export-1');
      expect(mockPrismaService.narrationExport.create).toHaveBeenCalled();
    });
  });

  describe('getExportStatus', () => {
    it('should return export status', async () => {
      const mockExport = {
        id: 'export-1',
        projectId: 'project-1',
        status: 'COMPLETED',
        outputUrl: 'https://s3.amazonaws.com/test-bucket/exports/export-1.mp3',
      };

      mockPrismaService.narrationExport.findUnique.mockResolvedValue(mockExport);

      const result = await service.getExportStatus('export-1', 'user-1');

      expect(result).toBeDefined();
      expect(result.status).toBe('COMPLETED');
    });

    it('should throw NotFoundException if export not found', async () => {
      mockPrismaService.narrationExport.findUnique.mockResolvedValue(null);

      await expect(
        service.getExportStatus('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAvailableVoices', () => {
    it('should return list of available voices', async () => {
      const voices = await service.getAvailableVoices();

      expect(voices).toBeInstanceOf(Array);
      expect(voices.length).toBeGreaterThan(0);
      expect(voices[0]).toHaveProperty('id');
      expect(voices[0]).toHaveProperty('name');
    });
  });

  describe('estimateDuration', () => {
    it('should estimate audio duration from text length', () => {
      // Assuming average speaking rate of ~150 words per minute
      const text = 'This is a test sentence with ten words in it.';
      const duration = (service as any).estimateDuration(text);

      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(60); // Should be less than a minute for this text
    });

    it('should return 0 for empty text', () => {
      const duration = (service as any).estimateDuration('');
      expect(duration).toBe(0);
    });
  });
});
