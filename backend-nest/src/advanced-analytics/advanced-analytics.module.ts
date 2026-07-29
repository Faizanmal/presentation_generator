import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdvancedAnalyticsService } from './advanced-analytics.service';
import { AudienceInsightsService } from './audience-insights.service';
import { PredictiveAnalyticsService } from './predictive-analytics.service';
import { AdvancedAnalyticsController } from './advanced-analytics.controller';
import { optionalBullQueue } from '../common/config/optional-bull-queue';

@Module({
  imports: [PrismaModule, ...optionalBullQueue('analytics-processing')],
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
