import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
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
    // Query distinct categories from marketplace templates
    const categoryData = await this.prisma.marketplaceTemplate.groupBy({
      by: ['category'],
      where: { status: 'PUBLISHED' },
      _count: { id: true },
    });

    const categoryMap: Record<string, { icon: string; description: string }> = {
      business: {
        icon: 'briefcase',
        description: 'Professional templates for business presentations',
      },
      education: {
        icon: 'graduation-cap',
        description: 'Templates for educators and students',
      },
      marketing: {
        icon: 'megaphone',
        description: 'Eye-catching templates for marketing campaigns',
      },
      startup: {
        icon: 'rocket',
        description: 'Pitch deck templates for startups',
      },
      creative: {
        icon: 'palette',
        description: 'Artistic and creative presentation templates',
      },
      technology: {
        icon: 'cpu',
        description: 'Modern templates for tech presentations',
      },
      minimal: {
        icon: 'minus-square',
        description: 'Clean and minimal design templates',
      },
      portfolio: {
        icon: 'image',
        description: 'Showcase your work with portfolio templates',
      },
    };

    return categoryData.map((cat) => {
      const slug = cat.category.toLowerCase();
      const meta = categoryMap[slug] || {
        icon: 'folder',
        description: `${cat.category} templates`,
      };
      return {
        id: slug,
        name: cat.category,
        slug,
        description: meta.description,
        icon: meta.icon,
        templateCount: cat._count.id,
      };
    });
  }

  async searchTemplates(params: {
    query?: string;
    category?: string;
    isPremium?: boolean;
    sortBy?: 'popular' | 'newest' | 'rating';
    page?: number;
    limit?: number;
  }): Promise<{ templates: TemplatePreview[]; total: number; pages: number }> {
    const {
      query,
      category,
      isPremium,
      sortBy = 'popular',
      page = 1,
      limit = 20,
    } = params;

    const where: Record<string, unknown> = {
      status: 'PUBLISHED',
    };

    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { tags: { hasSome: [query.toLowerCase()] } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (isPremium !== undefined) {
      where.pricing = isPremium ? 'premium' : 'free';
    }

    // determine order-by selection without creating a union type
    // that contains undefined values. assign to a mutable variable so
    // TypeScript can track the narrowed type on each branch.
    let orderBy: Record<string, string>;
    switch (sortBy) {
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'rating':
        orderBy = { rating: 'desc' };
        break;
      case 'popular':
      default:
        orderBy = { downloadCount: 'desc' };
        break;
    }

    const skip = (page - 1) * limit;

    const [dbTemplates, total] = await Promise.all([
      this.prisma.marketplaceTemplate.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          // only author is required for the preview; additional fields come
          // via templateData when necessary
          author: { select: { id: true, name: true, image: true } },
        },
      }) as any, // cast to any to work around Prisma inference oddities
      this.prisma.marketplaceTemplate.count({ where }),
    ]);

    // the query above is cast to any so we re-type here for clarity
    const templates: TemplatePreview[] = dbTemplates.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description ?? '',
      thumbnail: t.thumbnail ?? '',
      category: t.category,
      author: {
        id: t.author.id,
        name: t.author.name ?? '',
        avatar: t.author.image ?? undefined,
      },
      stats: {
        uses: t.downloadCount,
        likes: 0,
        rating: t.rating ?? 0,
        reviews: t.reviewCount,
      },
      isPremium: t.pricing === 'premium',
      price: t.price > 0 ? t.price : undefined,
      tags: t.tags,
      createdAt: t.createdAt,
    }));

    const pages = Math.ceil(total / limit);

    return { templates, total, pages };
  }

  async getTemplateById(templateId: string): Promise<TemplateDetails> {
    const t = (await this.prisma.marketplaceTemplate.findUnique({
      where: { id: templateId },
      include: {
        author: { select: { id: true, name: true, image: true } },
        reviews: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })) as any; // cast to any so that downstream property access works

    if (!t) {
      throw new NotFoundException(`Template ${templateId} not found`);
    }

    // Parse slide layouts (and other metadata) from the JSON blob
    const templateData = t.templateData || t.content || {};
    const slideLayouts = Array.isArray(templateData?.slides)
      ? templateData.slides
      : [];

    return {
      id: t.id,
      title: t.title,
      description: t.description ?? '',
      thumbnail: t.thumbnail ?? '',
      category: t.category,
      author: {
        id: t.author.id,
        name: t.author.name ?? '',
        avatar: t.author.image ?? undefined,
      },
      stats: {
        uses: t.downloadCount,
        likes: 0,
        rating: t.rating ?? 0,
        reviews: t.reviewCount,
      },
      isPremium: t.pricing === 'premium',
      price: t.price > 0 ? t.price : undefined,
      tags: t.tags,
      createdAt: t.createdAt,
      slides: (slideLayouts as Array<any>).map((s: any, i: number) => ({
        order: s.order ?? i + 1,
        layout: s.layout ?? s.layout ?? 'default',
        thumbnail: s.thumbnail ?? '',
      })),
      theme: {
        primaryColor:
          (templateData?.colorPalette as string[])?.[0] ?? '#2563eb',
        secondaryColor:
          (templateData?.colorPalette as string[])?.[1] ?? '#1e40af',
        fontFamily: (templateData?.fonts as string[])?.[0] ?? 'Inter',
      },
      reviews: (t.reviews || []).map((r: any) => ({
        userId: r.user?.id,
        userName: r.user?.name ?? 'Anonymous',
        rating: r.rating,
        comment: r.comment ?? '',
        createdAt: r.createdAt,
      })),
    };
  }

  async useTemplate(
    userId: string,
    templateId: string,
  ): Promise<{ projectId: string }> {
    const template = await this.getTemplateById(templateId);

    if (template.isPremium) {
      // Check if user has purchased or has premium subscription
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true },
      });

      if (!user?.subscription || user.subscription.status !== 'ACTIVE') {
        throw new ForbiddenException(
          'Premium subscription required for this template',
        );
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
    // Verify template exists
    const template = await this.prisma.marketplaceTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      throw new NotFoundException(`Template ${templateId} not found`);
    }
    // Increment the download count as a proxy for engagement
    await this.prisma.marketplaceTemplate.update({
      where: { id: templateId },
      data: { downloadCount: { increment: 1 } },
    });
    this.logger.log(`User ${userId} liked template ${templateId}`);
  }

  async reviewTemplate(
    userId: string,
    templateId: string,
    data: { rating: number; comment: string },
  ): Promise<void> {
    if (data.rating < 1 || data.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Verify template exists
    const template = await this.prisma.marketplaceTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      throw new NotFoundException(`Template ${templateId} not found`);
    }

    // Create review in database
    await this.prisma.templateReview.create({
      data: {
        templateId,
        userId,
        rating: data.rating,
        comment: data.comment,
      },
    });

    // Update template aggregate rating
    const reviews = await this.prisma.templateReview.aggregate({
      where: { templateId },
      _avg: { rating: true },
      _count: { id: true },
    });

    await this.prisma.marketplaceTemplate.update({
      where: { id: templateId },
      data: {
        rating: reviews._avg.rating ?? 0,
        reviewCount: reviews._count.id,
      },
    });

    this.logger.log(
      `User ${userId} reviewed template ${templateId}: ${data.rating} stars`,
    );
  }

  async publishTemplate(
    userId: string,
    projectId: string,
  ): Promise<{ templateId: string }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { slides: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException(
        'You can only publish your own projects as templates',
      );
    }

    // Build minimal JSON payload for templateData
    const content = {
      slides: project.slides.map((s) => ({
        order: s.order,
        layout: s.layout ?? 'default',
        thumbnail: '',
      })),
    };

    // Create template in database
    const template = await this.prisma.marketplaceTemplate.create({
      data: {
        title: project.title,
        description: project.description ?? '',
        category: 'general',
        authorId: userId,
        status: 'PENDING_REVIEW',
        pricing: 'free',
        price: 0,
        tags: [],
        slideCount: project.slides.length,
        templateData: content as any,
      },
    });

    this.logger.log(
      `User ${userId} published template ${template.id} from project ${projectId}`,
    );

    return { templateId: template.id };
  }

  async getFeaturedTemplates(): Promise<TemplatePreview[]> {
    const { templates } = await this.searchTemplates({
      sortBy: 'popular',
      limit: 8,
    });
    return templates;
  }

  async getTrendingTemplates(): Promise<TemplatePreview[]> {
    const { templates } = await this.searchTemplates({
      sortBy: 'newest',
      limit: 6,
    });
    return templates;
  }
}
