import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/roles.guard';
import {
  TemplateMarketplaceService,
  TemplateCategory,
  TemplatePricing,
} from './template-marketplace.service';

// DTOs
class ListTemplatesDto {
  category?: TemplateCategory;
  pricing?: TemplatePricing;
  search?: string;
  featured?: boolean;
  sortBy?: 'downloads' | 'rating' | 'newest' | 'popular';
  page?: number;
  limit?: number;
}

class SubmitTemplateDto {
  projectId: string;
  title: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  pricing: TemplatePricing;
  price?: number;
  thumbnail?: string;
  previewImages?: string[];
}

class UseTemplateDto {
  newTitle?: string;
}

class PurchaseTemplateDto {
  paymentIntentId: string;
}

class AddReviewDto {
  rating: number;
  comment?: string;
}

class ModerateTemplateDto {
  action: 'approve' | 'reject';
  feedback?: string;
}

@Controller('marketplace')
export class TemplateMarketplaceController {
  constructor(
    private readonly marketplaceService: TemplateMarketplaceService,
  ) {}

  @Get('templates')
  async listTemplates(@Query() query: ListTemplatesDto) {
    return this.marketplaceService.listTemplates({
      category: query.category,
      pricing: query.pricing,
      search: query.search,
      sortBy: query.sortBy,
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
    });
  }

  @Get('templates/:templateId')
  async getTemplate(@Param('templateId') templateId: string) {
    return this.marketplaceService.getTemplate(templateId);
  }

  @Get('categories')
  async getCategories() {
    return this.marketplaceService.getCategories();
  }

  @Post('templates/submit')
  @UseGuards(JwtAuthGuard)
  async submitTemplate(
    @Body() dto: SubmitTemplateDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.marketplaceService.submitTemplate(req.user.id, dto.projectId, {
      title: dto.title,
      description: dto.description,
      category: dto.category,
      tags: dto.tags,
      pricing: dto.pricing,
      price: dto.price,
      thumbnail: dto.thumbnail,
      previewImages: dto.previewImages,
    });
  }

  @Post('templates/:templateId/use')
  @UseGuards(JwtAuthGuard)
  async useTemplate(
    @Param('templateId') templateId: string,
    @Body() dto: UseTemplateDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.marketplaceService.useTemplate(
      req.user.id,
      templateId,
      dto.newTitle,
    );
  }

  @Post('templates/:templateId/purchase')
  @UseGuards(JwtAuthGuard)
  async purchaseTemplate(
    @Param('templateId') templateId: string,
    @Body() dto: PurchaseTemplateDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.marketplaceService.purchaseTemplate(
      req.user.id,
      templateId,
      dto.paymentIntentId,
    );
  }

  @Post('templates/:templateId/review')
  @UseGuards(JwtAuthGuard)
  async addReview(
    @Param('templateId') templateId: string,
    @Body() dto: AddReviewDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.marketplaceService.addReview(
      req.user.id,
      templateId,
      dto.rating,
      dto.comment,
    );
  }

  @Get('templates/:templateId/reviews')
  async getReviews(
    @Param('templateId') templateId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.marketplaceService.getReviews(
      templateId,
      Number(page) || 1,
      Number(limit) || 10,
    );
  }

  @Get('author/dashboard')
  @UseGuards(JwtAuthGuard)
  async getAuthorDashboard(@Request() req: { user: { id: string } }) {
    return this.marketplaceService.getAuthorDashboard(req.user.id);
  }

  @Post('admin/templates/:templateId/moderate')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async moderateTemplate(
    @Param('templateId') templateId: string,
    @Body() dto: ModerateTemplateDto,
  ) {
    return this.marketplaceService.moderateTemplate(
      templateId,
      dto.action,
      dto.feedback,
    );
  }
}
