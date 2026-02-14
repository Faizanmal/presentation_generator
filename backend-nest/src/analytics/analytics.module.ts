import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AudienceAnalyticsService } from './audience-analytics.service';
import { PrismaModule } from '../prisma/prisma.module';

import { AIModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), AIModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AudienceAnalyticsService],
  exports: [AnalyticsService, AudienceAnalyticsService],
})
export class AnalyticsModule {}
