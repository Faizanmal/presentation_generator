import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LibraryItem {
  id: string;
  userId: string;
  name: string;
  description?: string;
  type: 'slide' | 'block';
  content: any;
  tags: string[];
  category: string;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateLibraryItemDto {
  name: string;
  description?: string;
  type: 'slide' | 'block';
  content: any;
  tags?: string[];
  category?: string;
}

@Injectable()
export class ContentLibraryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Save a slide or block to the user's library
   */
  async saveToLibrary(
    userId: string,
    item: CreateLibraryItemDto,
  ): Promise<LibraryItem> {
    // Store in a JSON field within assets or create dedicated storage
    const asset = await this.prisma.asset.create({
      data: {
        userId,
        filename: `library-${item.type}-${Date.now()}.json`,
        url: '', // Not a file URL, but metadata
        mimeType: 'application/json',
        size: JSON.stringify(item.content).length,
      },
    });

    // Return the library item format
    return {
      id: asset.id,
      userId,
      name: item.name,
      description: item.description,
      type: item.type,
      content: item.content,
      tags: item.tags || [],
      category: item.category || 'uncategorized',
      usageCount: 0,
      createdAt: asset.createdAt,
      updatedAt: asset.createdAt,
    };
  }

  /**
   * Get user's content library
   */
  async getLibrary(
    userId: string,
    options?: {
      type?: 'slide' | 'block';
      category?: string;
      search?: string;
    },
  ): Promise<LibraryItem[]> {
    const assets = await this.prisma.asset.findMany({
      where: {
        userId,
        mimeType: 'application/json',
        filename: {
          startsWith: options?.type ? `library-${options.type}` : 'library-',
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // For a real implementation, you'd parse stored JSON
    // This is a simplified version
    return assets.map((asset) => ({
      id: asset.id,
      userId: asset.userId,
      name: asset.filename.replace('library-', '').replace('.json', ''),
      type: asset.filename.includes('slide') ? 'slide' : 'block',
      content: {},
      tags: [],
      category: 'uncategorized',
      usageCount: 0,
      createdAt: asset.createdAt,
      updatedAt: asset.createdAt,
    }));
  }

  /**
   * Delete item from library
   */
  async deleteFromLibrary(userId: string, itemId: string): Promise<void> {
    await this.prisma.asset.deleteMany({
      where: {
        id: itemId,
        userId,
      },
    });
  }

  /**
   * Get pre-built content templates
   */
  getBuiltInTemplates(): LibraryItem[] {
    return [
      {
        id: 'template-title-slide',
        userId: 'system',
        name: 'Title Slide',
        description: 'A professional title slide with heading and subtitle',
        type: 'slide',
        content: {
          blocks: [
            {
              type: 'HEADING',
              content: { text: 'Presentation Title' },
              order: 1,
            },
            {
              type: 'SUBHEADING',
              content: { text: 'Your subtitle goes here' },
              order: 2,
            },
          ],
        },
        tags: ['title', 'intro', 'opening'],
        category: 'titles',
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'template-agenda',
        userId: 'system',
        name: 'Agenda Slide',
        description: 'List your presentation topics',
        type: 'slide',
        content: {
          blocks: [
            { type: 'HEADING', content: { text: 'Agenda' }, order: 1 },
            {
              type: 'NUMBERED_LIST',
              content: {
                items: ['Topic One', 'Topic Two', 'Topic Three', 'Topic Four'],
              },
              order: 2,
            },
          ],
        },
        tags: ['agenda', 'outline', 'topics'],
        category: 'structure',
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'template-key-points',
        userId: 'system',
        name: 'Key Points',
        description: '3 bullet points layout',
        type: 'slide',
        content: {
          blocks: [
            { type: 'HEADING', content: { text: 'Key Points' }, order: 1 },
            {
              type: 'BULLET_LIST',
              content: {
                items: [
                  'First important point with supporting details',
                  'Second important point with context',
                  'Third important point with conclusion',
                ],
              },
              order: 2,
            },
          ],
        },
        tags: ['points', 'bullets', 'summary'],
        category: 'content',
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'template-comparison',
        userId: 'system',
        name: 'Comparison',
        description: 'Compare two options or concepts',
        type: 'slide',
        content: {
          blocks: [
            { type: 'HEADING', content: { text: 'Comparison' }, order: 1 },
            {
              type: 'COMPARISON',
              content: {
                left: {
                  title: 'Option A',
                  items: ['Feature 1', 'Feature 2', 'Feature 3'],
                },
                right: {
                  title: 'Option B',
                  items: ['Feature 1', 'Feature 2', 'Feature 3'],
                },
              },
              order: 2,
            },
          ],
        },
        tags: ['comparison', 'vs', 'options'],
        category: 'analysis',
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'template-stats',
        userId: 'system',
        name: 'Statistics',
        description: 'Display key metrics',
        type: 'slide',
        content: {
          blocks: [
            { type: 'HEADING', content: { text: 'Key Statistics' }, order: 1 },
            {
              type: 'STATS_GRID',
              content: {
                stats: [
                  { value: '95%', label: 'Customer Satisfaction' },
                  { value: '2M+', label: 'Active Users' },
                  { value: '50+', label: 'Countries' },
                  { value: '24/7', label: 'Support' },
                ],
              },
              order: 2,
            },
          ],
        },
        tags: ['stats', 'metrics', 'numbers'],
        category: 'data',
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'template-timeline',
        userId: 'system',
        name: 'Timeline',
        description: 'Show project phases or history',
        type: 'slide',
        content: {
          blocks: [
            { type: 'HEADING', content: { text: 'Timeline' }, order: 1 },
            {
              type: 'TIMELINE',
              content: {
                events: [
                  {
                    date: 'Q1 2024',
                    title: 'Phase 1',
                    description: 'Planning',
                  },
                  {
                    date: 'Q2 2024',
                    title: 'Phase 2',
                    description: 'Development',
                  },
                  { date: 'Q3 2024', title: 'Phase 3', description: 'Testing' },
                  { date: 'Q4 2024', title: 'Phase 4', description: 'Launch' },
                ],
              },
              order: 2,
            },
          ],
        },
        tags: ['timeline', 'roadmap', 'phases'],
        category: 'planning',
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'template-quote',
        userId: 'system',
        name: 'Quote Slide',
        description: 'Feature a impactful quote',
        type: 'slide',
        content: {
          blocks: [
            {
              type: 'QUOTE',
              content: {
                text: 'The only way to do great work is to love what you do.',
                author: 'Steve Jobs',
              },
              order: 1,
            },
          ],
        },
        tags: ['quote', 'inspiration', 'testimonial'],
        category: 'content',
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'template-cta',
        userId: 'system',
        name: 'Call to Action',
        description: 'Closing slide with next steps',
        type: 'slide',
        content: {
          blocks: [
            {
              type: 'HEADING',
              content: { text: 'Get Started Today' },
              order: 1,
            },
            {
              type: 'PARAGRAPH',
              content: {
                text: 'Ready to take the next step? Contact us or sign up to begin your journey.',
              },
              order: 2,
            },
            {
              type: 'CALL_TO_ACTION',
              content: {
                primaryButton: { text: 'Get Started', url: '#' },
                secondaryButton: { text: 'Learn More', url: '#' },
              },
              order: 3,
            },
          ],
        },
        tags: ['cta', 'closing', 'action'],
        category: 'closing',
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'template-thank-you',
        userId: 'system',
        name: 'Thank You',
        description: 'Professional closing slide',
        type: 'slide',
        content: {
          blocks: [
            { type: 'HEADING', content: { text: 'Thank You!' }, order: 1 },
            {
              type: 'PARAGRAPH',
              content: { text: "Questions? Comments? Let's discuss." },
              order: 2,
            },
            {
              type: 'PARAGRAPH',
              content: { text: 'Contact: email@example.com' },
              order: 3,
            },
          ],
        },
        tags: ['thank-you', 'closing', 'end'],
        category: 'closing',
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  /**
   * Get pre-built block templates
   */
  getBlockTemplates(): LibraryItem[] {
    return [
      {
        id: 'block-pros-cons',
        userId: 'system',
        name: 'Pros & Cons',
        description: 'Two-column pros and cons list',
        type: 'block',
        content: {
          type: 'COMPARISON',
          content: {
            left: {
              title: '✅ Pros',
              items: ['Advantage 1', 'Advantage 2', 'Advantage 3'],
            },
            right: {
              title: '❌ Cons',
              items: ['Disadvantage 1', 'Disadvantage 2', 'Disadvantage 3'],
            },
          },
        },
        tags: ['pros', 'cons', 'comparison'],
        category: 'analysis',
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'block-3-column-features',
        userId: 'system',
        name: '3-Column Features',
        description: 'Showcase three features with icons',
        type: 'block',
        content: {
          type: 'STATS_GRID',
          content: {
            stats: [
              { value: '🚀', label: 'Fast Performance' },
              { value: '🔒', label: 'Secure by Design' },
              { value: '🎯', label: 'Easy to Use' },
            ],
          },
        },
        tags: ['features', 'icons', 'grid'],
        category: 'content',
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'block-pricing-table',
        userId: 'system',
        name: 'Pricing Table',
        description: 'Display pricing tiers',
        type: 'block',
        content: {
          type: 'STATS_GRID',
          content: {
            stats: [
              { value: '$0', label: 'Free Plan' },
              { value: '$29', label: 'Pro Plan' },
              { value: '$99', label: 'Enterprise' },
            ],
          },
        },
        tags: ['pricing', 'plans', 'money'],
        category: 'sales',
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }
}
