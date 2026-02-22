import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ThemesService } from './themes.service';
import { ColorPaletteService, ColorPalette } from './color-palette.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CacheVeryLong } from '../common/decorators/cache.decorator';

@Controller('themes')
export class ThemesController {
  constructor(
    private readonly themesService: ThemesService,
    private readonly colorPaletteService: ColorPaletteService,
  ) {}

  /**
   * Get all available themes
   */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @CacheVeryLong() // Themes rarely change - cache for 1 hour
  async findAll() {
    return this.themesService.findAll(true);
  }

  /**
   * Get a single theme
   */
  @Get(':id')
  @CacheVeryLong()
  async findOne(@Param('id') id: string) {
    return this.themesService.findOne(id);
  }

  /**
   * Get the default theme
   */
  @Get('default')
  @CacheVeryLong()
  async getDefault() {
    return this.themesService.getDefault();
  }

  /**
   * Extract color palette from an image
   */
  @Post('extract-palette')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async extractPalette(
    @Body() body: { imageUrl: string },
  ): Promise<ColorPalette> {
    const palette = await this.colorPaletteService.extractFromImage(
      body.imageUrl,
    );
    return palette;
  }

  /**
   * Create a theme from extracted palette
   */
  @Post('create-from-palette')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createFromPalette(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      themeName: string;
      palette: {
        primary: string;
        secondary: string;
        background: string;
        surface: string;
        text: string;
        textMuted: string;
        accent: string;
      };
    },
  ) {
    const theme = await this.colorPaletteService.createThemeFromPalette(
      user.id,
      { ...body.palette, colors: [] },
      body.themeName,
    );
    return theme;
  }

  /**
   * Generate color harmonies from a base color
   */
  @Post('harmonies')
  @HttpCode(HttpStatus.OK)
  generateHarmonies(@Body() body: { baseColor: string }) {
    const harmonies = this.colorPaletteService.generateHarmonies(
      body.baseColor,
    );
    return harmonies;
  }

  /**
   * Get accessible text colors for a background
   */
  @Post('accessible-text')
  @HttpCode(HttpStatus.OK)
  getAccessibleText(@Body() body: { backgroundColor: string }) {
    const textColors = this.colorPaletteService.getAccessibleTextColor(
      body.backgroundColor,
    );
    return textColors;
  }

  /**
   * Get predefined color palettes
   */
  @Get('palettes/predefined')
  @HttpCode(HttpStatus.OK)
  getPredefinedPalettes() {
    return this.colorPaletteService.getPredefinedPalettes();
  }
}
