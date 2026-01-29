import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { AdvancedIntegrationsController } from './advanced-integrations.controller';
import { AdvancedIntegrationsService } from './advanced-integrations.service';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IntegrationsController, AdvancedIntegrationsController, WebhooksController],
  providers: [IntegrationsService, AdvancedIntegrationsService, WebhooksService],
  exports: [IntegrationsService, AdvancedIntegrationsService, WebhooksService],
})
export class IntegrationsModule {}

