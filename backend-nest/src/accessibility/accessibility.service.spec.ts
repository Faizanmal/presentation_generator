import { Test, TestingModule } from '@nestjs/testing';
import { AccessibilityService } from './accessibility.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AIService } from '../ai/ai.service';
import { NotFoundException } from '@nestjs/common';

describe('AccessibilityService', () => {
  let service: AccessibilityService;

  const mockProject = {
    id: 'project-1',
    ownerId: 'user-1',
    title: 'Test Presentation',
    slides: [
      {
        id: 'slide-1',
        order: 0,
        blocks: [
          {
            id: 'block-1',
            type: 'TEXT',
            content: { text: 'Hello World' },
            style: {
              fontSize: 16,
              color: '#000000',
              backgroundColor: '#ffffff',
            },
          },
          {
            id: 'block-2',
            type: 'IMAGE',
            content: { url: 'https://example.com/image.jpg' },
            style: {},
          },
        ],
      },
    ],
    theme: {
      colors: {
        primary: '#3b82f6',
        background: '#ffffff',
        text: '#1e293b',
      },
    },
  };

  const mockPrismaService = {
    project: {
      findFirst: jest.fn(),
    },
    accessibilityReport: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(null),
  };

  const mockAIService = {
    generateAltText: jest.fn().mockResolvedValue('A descriptive alt text'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessibilityService,
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

    service = module.get<AccessibilityService>(AccessibilityService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkProject', () => {
    it('should return an accessibility report', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);

      const report = await service.checkProject('project-1', 'user-1');

      expect(report).toBeDefined();
      expect(report.projectId).toBe('project-1');
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
      expect(['A', 'B', 'C', 'D', 'F']).toContain(report.grade);
      expect(report.issues).toBeInstanceOf(Array);
    });

    it('should throw NotFoundException for non-existent project', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.checkProject('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should detect missing alt text on images', async () => {
      const projectWithImageNoAlt = {
        ...mockProject,
        slides: [
          {
            id: 'slide-1',
            order: 0,
            blocks: [
              {
                id: 'block-img',
                type: 'IMAGE',
                content: { url: 'https://example.com/image.jpg' }, // No alt
                style: {},
              },
            ],
          },
        ],
      };

      mockPrismaService.project.findFirst.mockResolvedValue(
        projectWithImageNoAlt,
      );

      const report = await service.checkProject('project-1', 'user-1');

      const altTextIssues = report.issues.filter(
        (i) => i.category === 'alt-text',
      );
      expect(altTextIssues.length).toBeGreaterThan(0);
    });

    it('should detect low contrast text', async () => {
      const projectWithLowContrast = {
        ...mockProject,
        slides: [
          {
            id: 'slide-1',
            order: 0,
            blocks: [
              {
                id: 'block-text',
                type: 'TEXT',
                content: { text: 'Hard to read' },
                style: {
                  fontSize: 14,
                  color: '#cccccc', // Light gray on white = low contrast
                  backgroundColor: '#ffffff',
                },
              },
            ],
          },
        ],
      };

      mockPrismaService.project.findFirst.mockResolvedValue(
        projectWithLowContrast,
      );

      const report = await service.checkProject('project-1', 'user-1');

      const contrastIssues = report.issues.filter(
        (i) => i.category === 'contrast',
      );
      expect(contrastIssues.length).toBeGreaterThan(0);
    });

    it('should detect small font sizes', async () => {
      const projectWithSmallFont = {
        ...mockProject,
        slides: [
          {
            id: 'slide-1',
            order: 0,
            blocks: [
              {
                id: 'block-text',
                type: 'TEXT',
                content: { text: 'Tiny text' },
                style: { fontSize: 10 }, // Too small
              },
            ],
          },
        ],
      };

      mockPrismaService.project.findFirst.mockResolvedValue(
        projectWithSmallFont,
      );

      const report = await service.checkProject('project-1', 'user-1');

      const fontSizeIssues = report.issues.filter(
        (i) => i.category === 'font-size',
      );
      expect(fontSizeIssues.length).toBeGreaterThan(0);
    });
  });

  // Note: Older tests that reached into private methods via `any` casting were removed.
  // We now rely on public APIs (`checkProject`, etc.) which internally exercise contrast
  // and scoring logic, avoiding unsafe casts and better matching real-world usage.
});
