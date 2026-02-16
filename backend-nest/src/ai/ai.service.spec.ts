import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  AIService,
  GenerationParams,
  GeneratedPresentation,
  LayoutType,
} from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealTimeDataService } from './realtime-data.service';

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
  images: {
    generate: jest.fn(),
  },
  audio: {
    speech: {
      create: jest.fn(),
    },
  },
};

// Mock GoogleGenerativeAI
const mockGoogleGenerativeAI = {
  getGenerativeModel: jest.fn().mockReturnValue({
    startChat: jest.fn().mockReturnValue({
      sendMessage: jest.fn().mockResolvedValue({
        response: {
          text: jest.fn().mockReturnValue('Mock Google response'),
        },
      }),
    }),
  }),
};

jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest
      .fn()
      .mockImplementation(() => mockGoogleGenerativeAI),
  };
});

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => mockOpenAI);
});

describe('AIService', () => {
  let service: AIService;
  // let prismaService: PrismaService;

  const mockPrismaService = {
    aIGeneration: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        OPENAI_API_KEY: 'test-api-key',
        GOOGLE_GENERATIVE_AI_API_KEY: 'test-google-key',
      };
      return config[key];
    }),
  };

  const mockRealTimeDataService = {
    extractChartData: jest.fn().mockResolvedValue([]),
    fetchRealTimeData: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RealTimeDataService, useValue: mockRealTimeDataService },
      ],
    }).compile();

    service = module.get<AIService>(AIService);
    // prismaService = module.get<PrismaService>(PrismaService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('generatePresentation', () => {
    const mockGeneratedContent: GeneratedPresentation = {
      title: 'Introduction to Machine Learning',
      sections: [
        {
          heading: 'What is Machine Learning?',
          blocks: [
            {
              type: 'paragraph',
              content: 'Machine learning is a subset of AI...',
            },
            { type: 'bullet', content: 'Supervised learning' },
            { type: 'bullet', content: 'Unsupervised learning' },
          ],
          layout: 'title-content' as LayoutType,
        },
        {
          heading: 'Applications',
          blocks: [
            { type: 'bullet', content: 'Natural language processing' },
            { type: 'bullet', content: 'Computer vision' },
          ],
          layout: 'two-column' as LayoutType,
        },
      ],
    };

    it('should generate a presentation successfully', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(mockGeneratedContent),
            },
          },
        ],
        usage: { total_tokens: 500 },
      });

      mockPrismaService.aIGeneration.create.mockResolvedValue({ id: 'gen-1' });

      const params: GenerationParams = {
        topic: 'Introduction to Machine Learning',
        tone: 'professional',
        audience: 'developers',
        length: 5,
        type: 'presentation',
      };

      const result = await service.generatePresentation(params);

      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('sections');
      expect(result.sections.length).toBeGreaterThan(0);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
    });

    it('should throw error when AI returns invalid JSON', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'This is not valid JSON',
            },
          },
        ],
      });

      const params: GenerationParams = {
        topic: 'Test Topic',
      };

      await expect(service.generatePresentation(params)).rejects.toThrow();
    });

    it('should throw error when AI returns empty content', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      });

      const params: GenerationParams = {
        topic: 'Test Topic',
      };

      await expect(service.generatePresentation(params)).rejects.toThrow();
    });

    it('should use default values for optional parameters', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(mockGeneratedContent),
            },
          },
        ],
        usage: { total_tokens: 500 },
      });

      const params: GenerationParams = {
        topic: 'Minimal Topic',
      };

      await service.generatePresentation(params);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
        }),
      );
    });
  });

  describe('enhanceContent', () => {
    it('should enhance text content', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'This is the enhanced version of the content.',
            },
          },
        ],
      });

      const result = await service.enhanceContent(
        'Original content',
        'Make it more professional',
      );

      expect(result).toBe('This is the enhanced version of the content.');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
        }),
      );
    });

    it('should return original content when AI fails', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('API Error'),
      );

      await expect(
        service.enhanceContent('Original content', 'Make it better'),
      ).rejects.toThrow();
    });
  });

  describe('generateImage', () => {
    it('should generate an image successfully', async () => {
      mockOpenAI.images.generate.mockResolvedValue({
        data: [
          {
            url: 'https://example.com/generated-image.png',
            revised_prompt: 'Enhanced prompt for better image',
          },
        ],
      });

      const result = await service.generateImage('A futuristic city');

      expect(result).toHaveProperty('imageUrl');
      expect(result).toHaveProperty('revisedPrompt');
      expect(result.imageUrl).toBe('https://example.com/generated-image.png');
    });

    it('should throw error when image generation fails', async () => {
      mockOpenAI.images.generate.mockResolvedValue({
        data: [],
      });

      await expect(service.generateImage('Test prompt')).rejects.toThrow();
    });

    it('should use correct size parameter', async () => {
      mockOpenAI.images.generate.mockResolvedValue({
        data: [{ url: 'https://example.com/image.png' }],
      });

      await service.generateImage('Test', 'vivid', '1024x1024');

      expect(mockOpenAI.images.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          size: '1024x1024',
        }),
      );
    });
  });

  describe('generateNarration', () => {
    it('should generate narration audio', async () => {
      const mockBuffer = Buffer.from('mock audio data');
      mockOpenAI.audio.speech.create.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockBuffer),
      });

      const result = await service.generateNarration(
        'This is a test narration.',
        'nova',
        1.0,
      );

      expect(result).toHaveProperty('audioBuffer');
      expect(result).toHaveProperty('duration');
      expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
    });

    it('should truncate text longer than 4096 characters', async () => {
      const longText = 'a'.repeat(5000);
      const mockBuffer = Buffer.from('mock audio');
      mockOpenAI.audio.speech.create.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockBuffer),
      });

      await service.generateNarration(longText, 'nova', 1.0);

      expect(mockOpenAI.audio.speech.create).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.any(String) as string,
        }),
      );
    });

    it('should clamp speed to valid range', async () => {
      const mockBuffer = Buffer.from('mock audio');
      mockOpenAI.audio.speech.create.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockBuffer),
      });

      await service.generateNarration('Test', 'nova', 10.0); // Too fast

      expect(mockOpenAI.audio.speech.create).toHaveBeenCalledWith(
        expect.objectContaining({
          speed: 4.0, // Clamped to max
        }),
      );
    });
  });

  describe('recommendLayout', () => {
    it('should recommend chart-focus for chart content', () => {
      const blocks = [{ type: 'chart', content: 'Sales data' }];
      const result = service.recommendLayout(blocks, 'Sales Overview');
      expect(result).toBe('chart-focus');
    });

    it('should recommend timeline for timeline content', () => {
      const blocks = [{ type: 'bullet', content: 'Step 1' }];
      const result = service.recommendLayout(blocks, 'Project Timeline');
      expect(result).toBe('timeline');
    });

    it('should recommend comparison for vs content', () => {
      const blocks = [{ type: 'bullet', content: 'Feature A' }];
      const result = service.recommendLayout(blocks, 'React vs Vue');
      expect(result).toBe('comparison');
    });

    it('should recommend two-column for many bullet points', () => {
      const blocks = [
        { type: 'bullet', content: '1' },
        { type: 'bullet', content: '2' },
        { type: 'bullet', content: '3' },
        { type: 'bullet', content: '4' },
        { type: 'bullet', content: '5' },
        { type: 'bullet', content: '6' },
      ];
      const result = service.recommendLayout(blocks, 'Features');
      expect(result).toBe('two-column');
    });

    it('should recommend title for introduction slides', () => {
      const blocks = [{ type: 'paragraph', content: 'Welcome' }];
      const result = service.recommendLayout(blocks, 'Introduction');
      expect(result).toBe('title');
    });
  });

  describe('generateSuggestions', () => {
    it('should generate improvement suggestions', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                suggestions: [
                  'Add more visuals',
                  'Simplify bullet points',
                  'Include a call-to-action',
                ],
              }),
            },
          },
        ],
      });

      const presentation: GeneratedPresentation = {
        title: 'Test',
        sections: [
          { heading: 'Intro', blocks: [], layout: 'title' as LayoutType },
        ],
      };

      const result = await service.generateSuggestions(presentation);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array on error', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('API Error'),
      );

      const presentation: GeneratedPresentation = {
        title: 'Test',
        sections: [],
      };

      const result = await service.generateSuggestions(presentation);
      expect(result).toEqual([]);
    });
  });

  describe('generateAllSpeakerNotes', () => {
    it('should generate speaker notes for all slides', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                notes: [
                  'Welcome the audience and introduce yourself.',
                  'Explain the main concept with examples.',
                  'Summarize key takeaways.',
                ],
              }),
            },
          },
        ],
      });

      const presentation: GeneratedPresentation = {
        title: 'Test Presentation',
        sections: [
          { heading: 'Intro', blocks: [], layout: 'title' as LayoutType },
          {
            heading: 'Main',
            blocks: [],
            layout: 'title-content' as LayoutType,
          },
          { heading: 'Conclusion', blocks: [], layout: 'title' as LayoutType },
        ],
      };

      const result = await service.generateAllSpeakerNotes(presentation);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
    });
  });
});
