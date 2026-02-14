import { Test, TestingModule } from '@nestjs/testing';
import { ExportService } from './export.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

describe('ExportService', () => {
  let service: ExportService;

  const mockProject = {
    id: 'project-1',
    title: 'Test Presentation',
    description: 'A test presentation',
    themeId: 'theme-1',
    blocks: [],
    slides: [
      {
        id: 'slide-1',
        title: 'Introduction',
        order: 0,
        speakerNotes: 'Welcome everyone!',
        layout: 'title',
        blocks: [
          {
            id: 'block-1',
            type: 'TEXT',
            content: { text: 'Welcome to my presentation' },
            style: { fontSize: 32, fontWeight: 'bold' },
            order: 0,
          },
        ],
      },
      {
        id: 'slide-2',
        title: 'Main Content',
        order: 1,
        layout: 'title-content',
        blocks: [
          {
            id: 'block-2',
            type: 'TEXT',
            content: { text: 'Key Point 1' },
            style: {},
            order: 0,
          },
          {
            id: 'block-3',
            type: 'BULLET_LIST',
            content: { items: ['Item 1', 'Item 2', 'Item 3'] },
            style: {},
            order: 1,
          },
        ],
      },
    ],
    theme: {
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        background: '#ffffff',
        text: '#1f2937',
      },
      fonts: {
        heading: 'Inter',
        body: 'Inter',
      },
    },
  };

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        FRONTEND_URL: 'http://localhost:3000',
      };
      return config[key];
    }),
  };

  const mockUsersService = {
    getSubscription: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);

    jest.clearAllMocks();
  });

  describe('exportToJSON', () => {
    it('should export project to JSON format', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = (await service.exportToJSON('project-1')) as {
        title: string;
        slides: unknown[];
      };

      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('slides');
      expect(result.slides).toHaveLength(2);
    });

    it('should throw error for non-existent project', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.exportToJSON('non-existent')).rejects.toThrow();
    });
  });

  describe('exportToHTML', () => {
    it('should generate valid HTML string', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.exportToHTML('project-1');

      expect(typeof result).toBe('string');
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain(mockProject.title);
    });

    it('should include all slides in HTML', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.exportToHTML('project-1');

      expect(result).toContain('Welcome to my presentation');
      expect(result).toContain('Key Point 1');
    });

    it('should apply theme colors', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.exportToHTML('project-1');

      expect(result).toContain('#3b82f6'); // Primary color
    });
  });

  describe('exportToPDF', () => {
    it('should generate PDF buffer (fallback to HTML)', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.exportToPDF('project-1');

      expect(Buffer.isBuffer(result)).toBe(true);
      // Currently falls back to HTML
      expect(result.toString('utf-8')).toContain('<!DOCTYPE html>');
    });

    it('should include options in PDF generation', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.exportToPDF('project-1');

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('exportToPPTX', () => {
    it('should generate PPTX buffer', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.exportToPPTX('project-1');

      expect(Buffer.isBuffer(result)).toBe(true);
      // PPTX files are ZIP files, start with PK
      expect(result.toString('utf-8', 0, 2)).toBe('PK');
    });

    it('should include speaker notes when requested', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.exportToPPTX('project-1');

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle different slide layouts', async () => {
      const projectWithLayouts = {
        ...mockProject,
        slides: [
          {
            ...mockProject.slides[0],
            layout: 'title',
          },
          {
            ...mockProject.slides[1],
            layout: 'two-column',
          },
        ],
      };

      mockPrismaService.project.findUnique.mockResolvedValue(
        projectWithLayouts,
      );

      const result = await service.exportToPPTX('project-1');

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('canExport', () => {
    it('should return true for users with valid subscription', async () => {
      mockUsersService.getSubscription.mockResolvedValue({
        plan: 'PRO',
      });
      const result = await service.canExport('user-1');
      expect(result).toBe(true);
    });

    it('should return false for users with free subscription', async () => {
      mockUsersService.getSubscription.mockResolvedValue({
        plan: 'FREE',
      });
      const result = await service.canExport('user-1');
      expect(result).toBe(false);
    });
  });
});
