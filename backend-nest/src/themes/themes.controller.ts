import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ThemesService } from './themes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('themes')
export class ThemesController {
  constructor(private readonly themesService: ThemesService) {}

  /**
   * Get all available themes
   */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async findAll(@CurrentUser() user: any) {
    // Include premium themes if user is authenticated
    // (availability check happens when applying theme)
    return this.themesService.findAll(true);
  }

  /**
   * Get a single theme
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.themesService.findOne(id);
  }

  /**
   * Get the default theme
   */
  @Get('default')
  async getDefault() {
    return this.themesService.getDefault();
  }
}
