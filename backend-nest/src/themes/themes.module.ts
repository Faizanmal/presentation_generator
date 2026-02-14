import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThemesService } from './themes.service';
import { ThemesController } from './themes.controller';
import { TemplateMarketplaceService } from './template-marketplace.service';
import { TemplateMarketplaceController } from './template-marketplace.controller';
import { BrandKitService } from './brand-kit.service';
import { ColorPaletteService } from './color-palette.service';

import { AIModule } from '../ai/ai.module';

@Module({
  imports: [ConfigModule, AIModule],
  controllers: [ThemesController, TemplateMarketplaceController],
  providers: [
    ThemesService,
    TemplateMarketplaceService,
    BrandKitService,
    ColorPaletteService,
  ],
  exports: [
    ThemesService,
    TemplateMarketplaceService,
    BrandKitService,
    ColorPaletteService,
  ],
})
export class ThemesModule {}
