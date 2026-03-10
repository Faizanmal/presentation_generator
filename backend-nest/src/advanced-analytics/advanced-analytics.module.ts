import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { AdvancedAnalyticsService } from './advanced-analytics.service';
import { AudienceInsightsService } from './audience-insights.service';
import { PredictiveAnalyticsService } from './predictive-analytics.service';
import { AdvancedAnalyticsController } from './advanced-analytics.controller';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'analytics-processing',
    }),
  ],
  controllers: [AdvancedAnalyticsController],
  providers: [
    AdvancedAnalyticsService,
    AudienceInsightsService,
    PredictiveAnalyticsService,
  ],
  exports: [
    AdvancedAnalyticsService,
    AudienceInsightsService,
    PredictiveAnalyticsService,
  ],
})
export class AdvancedAnalyticsModule {}
