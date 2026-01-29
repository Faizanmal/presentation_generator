import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { PresentationCoachService } from './presentation-coach.service';
import { PresentationCoachController } from './presentation-coach.controller';
import { SmartSuggestionsService } from './smart-suggestions.service';
import { TranslationService } from './translation.service';
import { PresentationInsightsService } from './presentation-insights.service';

@Module({
  imports: [ConfigModule, UsersModule],
  controllers: [AIController, PresentationCoachController],
  providers: [
    AIService,
    PresentationCoachService,
    SmartSuggestionsService,
    TranslationService,
    PresentationInsightsService,
  ],
  exports: [
    AIService,
    PresentationCoachService,
    SmartSuggestionsService,
    TranslationService,
    PresentationInsightsService,
  ],
})
export class AIModule {}
