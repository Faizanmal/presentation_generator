import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { PresentationCoachService } from './presentation-coach.service';
import { PresentationCoachController } from './presentation-coach.controller';
import { SmartSuggestionsService } from './smart-suggestions.service';
import { TranslationService } from './translation.service';
import { PresentationInsightsService } from './presentation-insights.service';
import { BackgroundLibraryService } from './background-library.service';
import { AutoLayoutService } from './auto-layout.service';
import { AIChatService } from './ai-chat.service';
import { URLImportService } from './url-import.service';
import { ThinkingAgentModule } from './thinking-agent/thinking-agent.module';
import { ProjectsModule } from '../projects/projects.module';
import { GenerationProcessor } from './generation.processor';
import { RealTimeDataService } from './realtime-data.service';
import { DataImportService } from './data-import.service';
import { DataImportController } from './data-import.controller';
import { ImageRecognitionService } from './image-recognition.service';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    forwardRef(() => ThinkingAgentModule),
    forwardRef(() => ProjectsModule),
  ],
  controllers: [
    AIController,
    PresentationCoachController,
    DataImportController,
  ],
  providers: [
    AIService,
    PresentationCoachService,
    SmartSuggestionsService,
    TranslationService,
    PresentationInsightsService,
    BackgroundLibraryService,
    AutoLayoutService,
    AIChatService,
    URLImportService,
    GenerationProcessor,
    RealTimeDataService,
    DataImportService,
    ImageRecognitionService,
  ],
  exports: [
    AIService,
    PresentationCoachService,
    SmartSuggestionsService,
    TranslationService,
    PresentationInsightsService,
    BackgroundLibraryService,
    AutoLayoutService,
    AIChatService,
    URLImportService,
    RealTimeDataService,
    DataImportService,
    ImageRecognitionService,
  ],
})
export class AIModule {}
