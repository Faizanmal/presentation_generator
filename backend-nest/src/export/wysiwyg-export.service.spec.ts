import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WysiwygExportService } from './wysiwyg-export.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WysiwygExportService visual fidelity', () => {
  let service: WysiwygExportService;

  const mockProject = {
    title: 'AI is already here',
    description: null,
    theme: {
      colors: {
        primary: '#0284C7',
        text: '#1F2937',
        background: '#FFFFFF',
        surface: '#F0F9FF',
        accent: '#0284C7',
        textMuted: '#64748B',
      },
      fonts: { heading: 'Source Serif 4', body: 'Source Sans 3' },
    },
    slides: [
      {
        id: 's1',
        layout: 'title-hero',
        order: 0,
        blocks: [
          {
            blockType: 'HEADING',
            order: 0,
            content: { text: 'AI is Not the Future' },
            style: {},
          },
          {
            blockType: 'IMAGE',
            order: 1,
            content: {
              url: 'https://picsum.photos/seed/hero/1600/900',
              alt: 'Neural net',
            },
            style: {},
          },
        ],
      },
      {
        id: 's2',
        layout: 'stats-grid',
        order: 1,
        blocks: [
          {
            blockType: 'STATS_GRID',
            order: 0,
            content: {
              stats: [{ value: '35%', label: 'Amazon recommendation revenue' }],
            },
            style: {},
          },
        ],
      },
      {
        id: 's3',
        layout: 'timeline',
        order: 2,
        blocks: [
          {
            blockType: 'TIMELINE',
            order: 0,
            content: { items: ['2025-2026: agents go mainstream'] },
            style: {},
          },
        ],
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WysiwygExportService,
        {
          provide: PrismaService,
          useValue: {
            project: {
              findUnique: jest.fn().mockResolvedValue(mockProject),
            },
          },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get(WysiwygExportService);
  });

  it('renders layout classes, images, stats, and timeline chrome', async () => {
    const html = await service.generateWysiwygHtml('proj-1');

    expect(html).toContain('layout-title-hero');
    expect(html).toContain('hero-media');
    expect(html).toContain('layout-stats-grid');
    expect(html).toContain('layout-timeline');
    expect(html).toContain('<img');
    expect(html.includes('picsum.photos') || html.includes('data:image')).toBe(
      true,
    );
    expect(html).toContain('stat-value');
    expect(html).toContain('35%');
    expect(html).toContain('timeline-step');
    expect(html.length).toBeGreaterThan(2000);
  });
});
