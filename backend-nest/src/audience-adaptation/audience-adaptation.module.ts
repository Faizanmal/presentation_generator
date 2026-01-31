import { Module } from '@nestjs/common';
import { AudienceAdaptationService } from './audience-adaptation.service';
import { AudienceAdaptationController } from './audience-adaptation.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AIModule],
  controllers: [AudienceAdaptationController],
  providers: [AudienceAdaptationService],
  exports: [AudienceAdaptationService],
})
export class AudienceAdaptationModule {}
