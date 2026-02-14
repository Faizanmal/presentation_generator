import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, BlockType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type TemplateCategory =
  | 'pitch-deck'
  | 'sales'
  | 'marketing'
  | 'business-plan'
  | 'proposal'
  | 'training'
  | 'education'
  | 'portfolio'
  | 'report'
  | 'event'
  | 'personal'
  | 'other';

export type TemplatePricing = 'free' | 'premium' | 'pro-only';

export interface MarketplaceTemplate {
  id: string;
  title: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  thumbnail: string;
  previewImages: string[];
  pricing: TemplatePricing;
  price?: number;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  slideCount: number;
  downloads: number;
  rating: number;
  reviewCount: number;
  content: Prisma.JsonValue; // Full template content
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateReview {
  id: string;
  templateId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment?: string;
  createdAt: Date;
}

interface BlockContent {
  blockType: string;
  content: Prisma.JsonValue;
  style: Prisma.JsonValue;
  order: number;
}

export interface TemplateSubmission {
  id: string;
  templateId: string;
  status: 'pending' | 'approved' | 'rejected';
  feedback?: string;
  submittedAt: Date;
  reviewedAt?: Date;
}

interface TemplateContent {
  title: string;
  description?: string;
  themeId: string;
  slides: Array<{
    layout: string;
    order: number;
    blocks: BlockContent[];
  }>;
}

@Injectable()
export class TemplateMarketplaceService {
  private readonly logger = new Logger(TemplateMarketplaceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List marketplace templates with filtering
   */
  async listTemplates(options: {
    category?: TemplateCategory;
    pricing?: TemplatePricing;
    search?: string;
    sortBy?: 'downloads' | 'rating' | 'newest' | 'popular';
    page?: number;
    limit?: number;
  }): Promise<{
    templates: MarketplaceTemplate[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const {
      category,
      pricing,
      search,
      sortBy = 'popular',
      page = 1,
      limit = 20,
    } = options;

    const where: Prisma.MarketplaceTemplateWhereInput = {
      status: 'PUBLISHED',
    };

    if (category) where.category = category;
    if (pricing) where.pricing = pricing;
    if (search) {
      where.OR = [
        {
          title: { contains: search, mode: 'insensitive' as Prisma.QueryMode },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive' as Prisma.QueryMode,
          },
        },
        { tags: { hasSome: [search.toLowerCase()] } },
      ];
    }

    const orderBy: Prisma.MarketplaceTemplateOrderByWithRelationInput = {};
    switch (sortBy) {
      case 'downloads':
        orderBy.downloadCount = 'desc';
        break;
      case 'rating':
        orderBy.rating = 'desc';
        break;
      case 'newest':
        orderBy.createdAt = 'desc';
        break;
      case 'popular':
      default:
        orderBy.downloadCount = 'desc';
        break;
    }

    const [templates, total] = await Promise.all([
      this.prisma.marketplaceTemplate.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: {
            select: { id: true, name: true, image: true },
          },
        },
      }),
      this.prisma.marketplaceTemplate.count({ where }),
    ]);

    return {
      templates: templates.map((t) => this.mapTemplate(t)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get template details
   */
  async getTemplate(templateId: string): Promise<MarketplaceTemplate> {
    const template = await this.prisma.marketplaceTemplate.findUnique({
      where: { id: templateId },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return this.mapTemplate(template);
  }

  /**
   * Submit a template to the marketplace
   */
  async submitTemplate(
    userId: string,
    projectId: string,
    data: {
      title: string;
      description: string;
      category: TemplateCategory;
      tags: string[];
      pricing: TemplatePricing;
      price?: number;
      thumbnail?: string;
      previewImages?: string[];
    },
  ): Promise<{ templateId: string; submissionId: string }> {
    // Get the project to use as template
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
      include: {
        slides: {
          include: { blocks: true },
          orderBy: { order: 'asc' },
        },
        theme: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Create template content
    const content = {
      title: project.title,
      description: project.description,
      themeId: project.themeId,
      slides: project.slides.map((s) => ({
        layout: s.layout,
        order: s.order,
        blocks: s.blocks.map((b) => ({
          blockType: b.blockType,
          content: b.content as Prisma.InputJsonValue,
          style: b.style as Prisma.InputJsonValue,
          order: b.order,
        })),
      })),
    };

    // Create marketplace template (pending review)
    const template = await this.prisma.marketplaceTemplate.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        tags: data.tags,
        thumbnail: data.thumbnail || '',
        previewImages: data.previewImages || [],
        pricing: data.pricing,
        price: data.price,
        authorId: userId,
        slideCount: project.slides.length,
        content: content as Prisma.InputJsonValue,
        templateData: content as Prisma.InputJsonValue,
        status: 'DRAFT',
      },
    });

    // Create submission record
    const submission = await this.prisma.templateSubmission.create({
      data: {
        templateId: template.id,
        authorId: userId,
        status: 'pending',
      },
    });

    return {
      templateId: template.id,
      submissionId: submission.id,
    };
  }

  /**
   * Use a template to create a new project
   */
  async useTemplate(
    userId: string,
    templateId: string,
    newTitle?: string,
  ): Promise<{ projectId: string }> {
    const template = await this.prisma.marketplaceTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template || template.status !== 'PUBLISHED') {
      throw new NotFoundException('Template not found');
    }

    // Check pricing access
    if (template.pricing !== 'free') {
      const hasAccess = await this.checkTemplateAccess(userId, templateId);
      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this template');
      }
    }

    const content = template.content as unknown as TemplateContent;

    // Create new project from template
    const project = await this.prisma.project.create({
      data: {
        title: newTitle || `${content.title} (Copy)`,
        ownerId: userId,
        themeId: content.themeId,
        status: 'DRAFT',
      },
    });

    // Create slides and blocks
    for (const slideData of content.slides || []) {
      const slide = await this.prisma.slide.create({
        data: {
          projectId: project.id,
          layout: slideData.layout,
          order: slideData.order,
        },
      });

      for (const blockData of slideData.blocks || []) {
        await this.prisma.block.create({
          data: {
            projectId: project.id,
            slideId: slide.id,
            blockType: blockData.blockType as BlockType,
            content: blockData.content || {},
            style: blockData.style || {},
            order: blockData.order,
          },
        });
      }
    }

    // Increment download count
    await this.prisma.marketplaceTemplate.update({
      where: { id: templateId },
      data: { downloadCount: { increment: 1 } },
    });

    // Record the download
    await this.prisma.templateDownload.create({
      data: {
        templateId,
        userId,
        projectId: project.id,
      },
    });

    return { projectId: project.id };
  }

  /**
   * Purchase a premium template
   */
  async purchaseTemplate(
    userId: string,
    templateId: string,
    paymentIntentId: string,
  ): Promise<{ success: boolean }> {
    const template = await this.prisma.marketplaceTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Record the purchase
    await this.prisma.templatePurchase.create({
      data: {
        templateId,
        userId,
        amount: template.price || 0,
        price: template.price || 0,
        paymentIntentId,
      },
    });

    // Pay the author (80% revenue share)
    const authorEarnings = (template.price || 0) * 0.8;
    await this.prisma.authorEarnings.create({
      data: {
        authorId: template.authorId,
        templateId,
        amount: authorEarnings,
        status: 'pending',
      },
    });

    return { success: true };
  }

  /**
   * Add a review to a template
   */
  async addReview(
    userId: string,
    templateId: string,
    rating: number,
    comment?: string,
  ): Promise<TemplateReview> {
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Check if user has downloaded/purchased the template
    const hasAccess = await this.prisma.templateDownload.findFirst({
      where: { templateId, userId },
    });

    if (!hasAccess) {
      throw new ForbiddenException(
        'You must use this template before reviewing',
      );
    }

    // Check for existing review
    const existing = await this.prisma.templateReview.findFirst({
      where: { templateId, userId },
    });

    if (existing) {
      throw new BadRequestException('You have already reviewed this template');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, image: true },
    });

    const review = await this.prisma.templateReview.create({
      data: {
        templateId,
        userId,
        rating,
        comment,
      },
    });

    // Update template rating
    const reviews = await this.prisma.templateReview.findMany({
      where: { templateId },
    });

    const avgRating =
      reviews.reduce((a, r) => a + r.rating, 0) / reviews.length;

    await this.prisma.marketplaceTemplate.update({
      where: { id: templateId },
      data: {
        rating: avgRating,
        reviewCount: reviews.length,
      },
    });

    return {
      id: review.id,
      templateId,
      userId,
      userName: user?.name || 'Anonymous',
      userAvatar: user?.image || undefined,
      rating,
      comment,
      createdAt: review.createdAt,
    };
  }

  /**
   * Get template reviews
   */
  async getReviews(
    templateId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    reviews: TemplateReview[];
    total: number;
  }> {
    const [reviews, total] = await Promise.all([
      this.prisma.templateReview.findMany({
        where: { templateId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, image: true },
          },
        },
      }),
      this.prisma.templateReview.count({ where: { templateId } }),
    ]);

    return {
      reviews: reviews.map((r) => ({
        id: r.id,
        templateId: r.templateId,
        userId: r.userId,
        userName: r.user.name || 'Anonymous',
        userAvatar: r.user.image || undefined,
        rating: r.rating,
        comment: r.comment || undefined,
        createdAt: r.createdAt,
      })),
      total,
    };
  }

  /**
   * Get author's templates and earnings
   */
  async getAuthorDashboard(userId: string): Promise<{
    templates: MarketplaceTemplate[];
    totalDownloads: number;
    totalEarnings: number;
    pendingEarnings: number;
    recentSales: unknown[];
  }> {
    const templates = await this.prisma.marketplaceTemplate.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    const earnings = await this.prisma.authorEarnings.findMany({
      where: { authorId: userId },
    });

    const totalEarnings = earnings
      .filter((e) => e.status === 'paid')
      .reduce((a, e) => a + e.amount, 0);

    const pendingEarnings = earnings
      .filter((e) => e.status === 'pending')
      .reduce((a, e) => a + e.amount, 0);

    const totalDownloads = templates.reduce((a, t) => a + t.downloadCount, 0);

    const recentSales = await this.prisma.templatePurchase.findMany({
      where: {
        templateId: { in: templates.map((t) => t.id) },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        template: { select: { title: true } },
      },
    });

    return {
      templates: templates.map((t) => this.mapTemplate(t)),
      totalDownloads,
      totalEarnings,
      pendingEarnings,
      recentSales,
    };
  }

  /**
   * Moderate template (admin only)
   */
  async moderateTemplate(
    templateId: string,
    action: 'approve' | 'reject',
    feedback?: string,
  ): Promise<void> {
    const template = await this.prisma.marketplaceTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await this.prisma.marketplaceTemplate.update({
      where: { id: templateId },
      data: {
        status: action === 'approve' ? 'PUBLISHED' : 'REJECTED',
      },
    });

    await this.prisma.templateSubmission.updateMany({
      where: { templateId, status: 'pending' },
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        feedback,
        reviewedAt: new Date(),
      },
    });
  }

  /**
   * Get categories with counts
   */
  async getCategories(): Promise<
    Array<{
      category: TemplateCategory;
      count: number;
      name: string;
    }>
  > {
    const categories: TemplateCategory[] = [
      'pitch-deck',
      'sales',
      'marketing',
      'business-plan',
      'proposal',
      'training',
      'education',
      'portfolio',
      'report',
      'event',
      'personal',
      'other',
    ];

    const names: Record<TemplateCategory, string> = {
      'pitch-deck': 'Pitch Deck',
      sales: 'Sales',
      marketing: 'Marketing',
      'business-plan': 'Business Plan',
      proposal: 'Proposal',
      training: 'Training',
      education: 'Education',
      portfolio: 'Portfolio',
      report: 'Report',
      event: 'Event',
      personal: 'Personal',
      other: 'Other',
    };

    const counts = await this.prisma.marketplaceTemplate.groupBy({
      by: ['category'],
      where: { status: 'PUBLISHED' },
      _count: true,
    });

    const countMap = new Map(counts.map((c) => [c.category, c._count]));

    return categories.map((category) => ({
      category,
      count: countMap.get(category) || 0,
      name: names[category],
    }));
  }

  // Helper methods
  private async checkTemplateAccess(
    userId: string,
    templateId: string,
  ): Promise<boolean> {
    // Check if purchased
    const purchase = await this.prisma.templatePurchase.findFirst({
      where: { userId, templateId },
    });

    if (purchase) return true;

    // Check if user has Pro subscription
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    return subscription?.plan === 'PRO' || subscription?.plan === 'ENTERPRISE';
  }

  private mapTemplate(
    t: Prisma.MarketplaceTemplateGetPayload<{
      include: { author: { select: { name: true; image: true } } };
    }>,
  ): MarketplaceTemplate {
    return {
      id: t.id,
      title: t.title,
      description: t.description || '',
      category: t.category as TemplateCategory,
      tags: t.tags,
      thumbnail: t.thumbnail || '',
      previewImages: t.previewImages,
      pricing: t.pricing as TemplatePricing,
      price: t.price || 0,
      authorId: t.authorId,
      authorName: t.author?.name || 'Unknown',
      authorAvatar: t.author?.image || undefined,
      slideCount: t.slideCount,
      downloads: t.downloadCount,
      rating: t.rating || 0,
      reviewCount: t.reviewCount,
      content: t.content,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }
}
