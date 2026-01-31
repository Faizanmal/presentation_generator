import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TemplateMarketplaceService } from './template-marketplace.service';

@Controller('templates')
export class TemplateMarketplaceController {
  constructor(
    private readonly marketplaceService: TemplateMarketplaceService,
  ) {}

  @Get('categories')
  async getCategories() {
    return this.marketplaceService.getCategories();
  }

  @Get('featured')
  async getFeatured() {
    return this.marketplaceService.getFeaturedTemplates();
  }

  @Get('trending')
  async getTrending() {
    return this.marketplaceService.getTrendingTemplates();
  }

  @Get('search')
  async search(
    @Query('q') query?: string,
    @Query('category') category?: string,
    @Query('premium') premium?: string,
    @Query('sort') sortBy?: 'popular' | 'newest' | 'rating',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketplaceService.searchTemplates({
      query,
      category,
      isPremium: premium ? premium === 'true' : undefined,
      sortBy,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  async getTemplate(@Param('id') id: string) {
    return this.marketplaceService.getTemplateById(id);
  }

  @Post(':id/use')
  @UseGuards(JwtAuthGuard)
  async useTemplate(
    @Param('id') templateId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.marketplaceService.useTemplate(user.id, templateId);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  async likeTemplate(
    @Param('id') templateId: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.marketplaceService.likeTemplate(user.id, templateId);
    return { success: true };
  }

  @Post(':id/review')
  @UseGuards(JwtAuthGuard)
  async reviewTemplate(
    @Param('id') templateId: string,
    @Body() body: { rating: number; comment: string },
    @CurrentUser() user: { id: string },
  ) {
    await this.marketplaceService.reviewTemplate(user.id, templateId, body);
    return { success: true };
  }

  @Post('publish')
  @UseGuards(JwtAuthGuard)
  async publishTemplate(
    @Body()
    body: {
      projectId: string;
      title: string;
      description: string;
      category: string;
      tags: string[];
      isPremium: boolean;
      price?: number;
    },
    @CurrentUser() user: { id: string },
  ) {
    return this.marketplaceService.publishTemplate(
      user.id,
      body.projectId,
      body,
    );
  }
}
