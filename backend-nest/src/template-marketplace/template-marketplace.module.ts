import { Module } from '@nestjs/common';
import { TemplateMarketplaceService } from './template-marketplace.service';
import { TemplateMarketplaceController } from './template-marketplace.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TemplateMarketplaceController],
  providers: [TemplateMarketplaceService],
  exports: [TemplateMarketplaceService],
})
export class TemplateMarketplaceModule {}
