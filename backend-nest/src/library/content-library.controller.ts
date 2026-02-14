import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ContentLibraryService } from './content-library.service';

@Controller('library')
@UseGuards(JwtAuthGuard)
export class ContentLibraryController {
  constructor(private readonly libraryService: ContentLibraryService) {}

  /**
   * Save slide or block to library
   */
  @Post('save')
  @HttpCode(HttpStatus.CREATED)
  async saveToLibrary(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      name: string;
      description?: string;
      type: 'slide' | 'block';
      content: unknown;
      tags?: string[];
      category?: string;
    },
  ) {
    const item = await this.libraryService.saveToLibrary(user.id, body);
    return item;
  }

  /**
   * Get user's library items
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getLibrary(
    @CurrentUser() user: { id: string },
    @Query('type') type?: 'slide' | 'block',
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    const items = await this.libraryService.getLibrary(user.id, {
      type,
      category,
      search,
    });
    return { items };
  }

  /**
   * Get built-in templates
   */
  @Get('templates')
  @HttpCode(HttpStatus.OK)
  getTemplates(@Query('type') type?: 'slide' | 'block') {
    if (type === 'block') {
      return { templates: this.libraryService.getBlockTemplates() };
    }
    if (type === 'slide') {
      return { templates: this.libraryService.getBuiltInTemplates() };
    }
    return {
      templates: [
        ...this.libraryService.getBuiltInTemplates(),
        ...this.libraryService.getBlockTemplates(),
      ],
    };
  }

  /**
   * Delete from library
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteFromLibrary(
    @CurrentUser() user: { id: string },
    @Param('id') itemId: string,
  ) {
    await this.libraryService.deleteFromLibrary(user.id, itemId);
    return { success: true };
  }
}
