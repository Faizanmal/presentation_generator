import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TemplateCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  templateCount: number;
}

export interface TemplatePreview {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  category: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  stats: {
    uses: number;
    likes: number;
    rating: number;
    reviews: number;
  };
  isPremium: boolean;
  price?: number;
  tags: string[];
  createdAt: Date;
}

export interface TemplateDetails extends TemplatePreview {
  slides: Array<{
    order: number;
    layout: string;
    thumbnail: string;
  }>;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
  };
  reviews: Array<{
    userId: string;
    userName: string;
    rating: number;
    comment: string;
    createdAt: Date;
  }>;
}

@Injectable()
export class TemplateMarketplaceService {
  private readonly logger = new Logger(TemplateMarketplaceService.name);

  constructor(private prisma: PrismaService) {}

  async getCategories(): Promise<TemplateCategory[]> {
    // In production, this would come from the database
    return [
      {
        id: 'business',
        name: 'Business',
        slug: 'business',
        description: 'Professional templates for business presentations',
        icon: 'briefcase',
        templateCount: 45,
      },
      {
        id: 'education',
        name: 'Education',
        slug: 'education',
        description: 'Templates for educators and students',
        icon: 'graduation-cap',
        templateCount: 38,
      },
      {
        id: 'marketing',
        name: 'Marketing',
        slug: 'marketing',
        description: 'Eye-catching templates for marketing campaigns',
        icon: 'megaphone',
        templateCount: 32,
      },
      {
        id: 'startup',
        name: 'Startup & Pitch',
        slug: 'startup',
        description: 'Pitch deck templates for startups',
        icon: 'rocket',
        templateCount: 28,
      },
      {
        id: 'creative',
        name: 'Creative',
        slug: 'creative',
        description: 'Artistic and creative presentation templates',
        icon: 'palette',
        templateCount: 35,
      },
      {
        id: 'technology',
        name: 'Technology',
        slug: 'technology',
        description: 'Modern templates for tech presentations',
        icon: 'cpu',
        templateCount: 42,
      },
      {
        id: 'minimal',
        name: 'Minimal',
        slug: 'minimal',
        description: 'Clean and minimal design templates',
        icon: 'minus-square',
        templateCount: 25,
      },
      {
        id: 'portfolio',
        name: 'Portfolio',
        slug: 'portfolio',
        description: 'Showcase your work with portfolio templates',
        icon: 'image',
        templateCount: 20,
      },
    ];
  }

  async searchTemplates(params: {
    query?: string;
    category?: string;
    isPremium?: boolean;
    sortBy?: 'popular' | 'newest' | 'rating';
    page?: number;
    limit?: number;
  }): Promise<{ templates: TemplatePreview[]; total: number; pages: number }> {
    const { query, category, isPremium, sortBy = 'popular', page = 1, limit = 20 } = params;

    // This would be a database query in production
    // For now, return mock data
    const mockTemplates: TemplatePreview[] = [
      {
        id: 'tpl-1',
        title: 'Modern Business Pitch',
        description: 'A clean, professional template perfect for business pitches and investor presentations.',
        thumbnail: '/templates/modern-business.png',
        category: 'business',
        author: { id: 'user-1', name: 'Design Studio', avatar: '/avatars/studio.png' },
        stats: { uses: 12500, likes: 890, rating: 4.8, reviews: 156 },
        isPremium: false,
        tags: ['business', 'pitch', 'professional', 'clean'],
        createdAt: new Date('2025-10-15'),
      },
      {
        id: 'tpl-2',
        title: 'Startup Pitch Deck',
        description: 'The perfect pitch deck template for startups seeking funding.',
        thumbnail: '/templates/startup-pitch.png',
        category: 'startup',
        author: { id: 'user-2', name: 'Pitch Perfect', avatar: '/avatars/pitch.png' },
        stats: { uses: 8900, likes: 670, rating: 4.9, reviews: 98 },
        isPremium: true,
        price: 29,
        tags: ['startup', 'pitch', 'funding', 'investors'],
        createdAt: new Date('2025-11-01'),
      },
      {
        id: 'tpl-3',
        title: 'Educational Workshop',
        description: 'Engaging template for educational presentations and workshops.',
        thumbnail: '/templates/education.png',
        category: 'education',
        author: { id: 'user-3', name: 'EduDesign', avatar: '/avatars/edu.png' },
        stats: { uses: 15200, likes: 1100, rating: 4.7, reviews: 234 },
        isPremium: false,
        tags: ['education', 'workshop', 'training', 'learning'],
        createdAt: new Date('2025-09-20'),
      },
      {
        id: 'tpl-4',
        title: 'Creative Portfolio',
        description: 'Showcase your creative work with this stunning portfolio template.',
        thumbnail: '/templates/portfolio.png',
        category: 'portfolio',
        author: { id: 'user-4', name: 'Creative Co', avatar: '/avatars/creative.png' },
        stats: { uses: 6700, likes: 520, rating: 4.6, reviews: 87 },
        isPremium: true,
        price: 19,
        tags: ['portfolio', 'creative', 'showcase', 'design'],
        createdAt: new Date('2025-12-05'),
      },
      {
        id: 'tpl-5',
        title: 'Tech Product Launch',
        description: 'Modern template for technology product launches and demos.',
        thumbnail: '/templates/tech-launch.png',
        category: 'technology',
        author: { id: 'user-5', name: 'TechDesigns', avatar: '/avatars/tech.png' },
        stats: { uses: 9400, likes: 780, rating: 4.8, reviews: 145 },
        isPremium: false,
        tags: ['technology', 'product', 'launch', 'modern'],
        createdAt: new Date('2025-11-15'),
      },
    ];

    let filtered = [...mockTemplates];

    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter(
        t =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some(tag => tag.includes(q))
      );
    }

    if (category) {
      filtered = filtered.filter(t => t.category === category);
    }

    if (isPremium !== undefined) {
      filtered = filtered.filter(t => t.isPremium === isPremium);
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case 'rating':
        filtered.sort((a, b) => b.stats.rating - a.stats.rating);
        break;
      case 'popular':
      default:
        filtered.sort((a, b) => b.stats.uses - a.stats.uses);
    }

    const total = filtered.length;
    const pages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const templates = filtered.slice(start, start + limit);

    return { templates, total, pages };
  }

  async getTemplateById(templateId: string): Promise<TemplateDetails> {
    // In production, fetch from database
    const template: TemplateDetails = {
      id: templateId,
      title: 'Modern Business Pitch',
      description: 'A clean, professional template perfect for business pitches and investor presentations. Features modern design elements and easy customization.',
      thumbnail: '/templates/modern-business.png',
      category: 'business',
      author: { id: 'user-1', name: 'Design Studio', avatar: '/avatars/studio.png' },
      stats: { uses: 12500, likes: 890, rating: 4.8, reviews: 156 },
      isPremium: false,
      tags: ['business', 'pitch', 'professional', 'clean'],
      createdAt: new Date('2025-10-15'),
      slides: [
        { order: 1, layout: 'title', thumbnail: '/templates/slides/1.png' },
        { order: 2, layout: 'text-image', thumbnail: '/templates/slides/2.png' },
        { order: 3, layout: 'bullet-points', thumbnail: '/templates/slides/3.png' },
        { order: 4, layout: 'chart', thumbnail: '/templates/slides/4.png' },
        { order: 5, layout: 'team', thumbnail: '/templates/slides/5.png' },
        { order: 6, layout: 'closing', thumbnail: '/templates/slides/6.png' },
      ],
      theme: {
        primaryColor: '#2563eb',
        secondaryColor: '#1e40af',
        fontFamily: 'Inter',
      },
      reviews: [
        {
          userId: 'u1',
          userName: 'John D.',
          rating: 5,
          comment: 'Perfect template for my investor pitch!',
          createdAt: new Date('2025-12-01'),
        },
        {
          userId: 'u2',
          userName: 'Sarah M.',
          rating: 4,
          comment: 'Great design, easy to customize.',
          createdAt: new Date('2025-11-28'),
        },
      ],
    };

    return template;
  }

  async useTemplate(userId: string, templateId: string): Promise<{ projectId: string }> {
    const template = await this.getTemplateById(templateId);

    if (template.isPremium) {
      // Check if user has purchased or has premium subscription
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true },
      });

      if (!user?.subscription || user.subscription.status !== 'ACTIVE') {
        throw new ForbiddenException('Premium subscription required for this template');
      }
    }

    // Create a new project from template
    const project = await this.prisma.project.create({
      data: {
        title: `${template.title} - Copy`,
        description: template.description,
        ownerId: userId,
        generatedFromPrompt: `Template: ${template.id}`,
      },
    });

    // Create slides from template
    for (const slide of template.slides) {
      await this.prisma.slide.create({
        data: {
          projectId: project.id,
          order: slide.order,
          layout: slide.layout,
        },
      });
    }

    // Track template usage
    this.logger.log(`User ${userId} used template ${templateId}`);

    return { projectId: project.id };
  }

  async likeTemplate(userId: string, templateId: string): Promise<void> {
    // In production, store in database
    this.logger.log(`User ${userId} liked template ${templateId}`);
  }

  async reviewTemplate(
    userId: string,
    templateId: string,
    data: { rating: number; comment: string }
  ): Promise<void> {
    if (data.rating < 1 || data.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // In production, store in database
    this.logger.log(`User ${userId} reviewed template ${templateId}: ${data.rating} stars`);
  }

  async publishTemplate(
    userId: string,
    projectId: string,
    data: {
      title: string;
      description: string;
      category: string;
      tags: string[];
      isPremium: boolean;
      price?: number;
    }
  ): Promise<{ templateId: string }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { slides: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException('You can only publish your own projects as templates');
    }

    // In production, create template in database
    const templateId = `tpl-${Date.now()}`;
    this.logger.log(`User ${userId} published template ${templateId} from project ${projectId}`);

    return { templateId };
  }

  async getFeaturedTemplates(): Promise<TemplatePreview[]> {
    const { templates } = await this.searchTemplates({ sortBy: 'popular', limit: 8 });
    return templates;
  }

  async getTrendingTemplates(): Promise<TemplatePreview[]> {
    const { templates } = await this.searchTemplates({ sortBy: 'newest', limit: 6 });
    return templates;
  }
}
