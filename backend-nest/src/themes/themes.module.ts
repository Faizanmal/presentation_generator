import { Module } from '@nestjs/common';
import { ThemesService } from './themes.service';
import { ThemesController } from './themes.controller';
import { TemplateMarketplaceService } from './template-marketplace.service';
import { TemplateMarketplaceController } from './template-marketplace.controller';
import { BrandKitService } from './brand-kit.service';

@Module({
  controllers: [ThemesController, TemplateMarketplaceController],
  providers: [ThemesService, TemplateMarketplaceService, BrandKitService],
  exports: [ThemesService, TemplateMarketplaceService, BrandKitService],
})
export class ThemesModule {}
