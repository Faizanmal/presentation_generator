import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

// Core modules
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { SlidesModule } from './slides/slides.module';
import { BlocksModule } from './blocks/blocks.module';
import { ThemesModule } from './themes/themes.module';
import { AIModule } from './ai/ai.module';
import { PaymentsModule } from './payments/payments.module';
import { ExportModule } from './export/export.module';
import { UploadModule } from './upload/upload.module';
import { EmailModule } from './email/email.module';
import { SmsModule } from './sms/sms.module';
import { OtpModule } from './otp/otp.module';

// New feature modules
import { CollaborationModule } from './collaboration/collaboration.module';
import { VoiceModule } from './voice/voice.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { PersonalizationModule } from './personalization/personalization.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { SyncModule } from './sync/sync.module';
import { TagsModule } from './tags/tags.module';

// Advanced feature modules
import { AudienceAdaptationModule } from './audience-adaptation/audience-adaptation.module';
import { InteractiveEmbedsModule } from './interactive-embeds/interactive-embeds.module';
import { DataChartsModule } from './data-charts/data-charts.module';
import { TemplateMarketplaceModule } from './template-marketplace/template-marketplace.module';
import { DesignSystemModule } from './design-system/design-system.module';
import { BrandKitModule } from './brand-kit/brand-kit.module';
import { AccessibilityModule } from './accessibility/accessibility.module';
import { MultilingualModule } from './multilingual/multilingual.module';
import { NarrationExportModule } from './narration-export/narration-export.module';
import { ContentGovernanceModule } from './content-governance/content-governance.module';
import { TeamAnalyticsModule } from './team-analytics/team-analytics.module';
import { ContentLibraryModule } from './library/content-library.module';
import { ImageAcquisitionModule } from './image-acquisition/image-acquisition.module';
import { ImageRecognitionModule } from './image-recognition/image-recognition.module';

// New AI-Enhanced Creativity & Immersive Tech modules
import { AIResearchModule } from './ai-research/ai-research.module';
import { StoryboardingModule } from './storyboarding/storyboarding.module';
import { ABTestingModule } from './ab-testing/ab-testing.module';
import { VRARModule } from './vr-ar/vr-ar.module';
import { HolographicModule } from './holographic/holographic.module';
import { BlockchainModule } from './blockchain/blockchain.module';

// Advanced Collaboration & Analytics modules
import { AICopilotModule } from './ai-copilot/ai-copilot.module';
import { LiveQAModule } from './live-qa/live-qa.module';
import { CrossPlatformSyncModule } from './cross-platform-sync/cross-platform-sync.module';
import { PredictiveAnalyticsModule } from './predictive-analytics/predictive-analytics.module';
import { SentimentAnalysisModule } from './sentiment-analysis/sentiment-analysis.module';
import { LearningPathsModule } from './learning-paths/learning-paths.module';

// Accessibility & Enterprise modules
import { SignLanguageModule } from './sign-language/sign-language.module';
import { CognitiveAccessibilityModule } from './cognitive-accessibility/cognitive-accessibility.module';
import { UniversalDesignModule } from './universal-design/universal-design.module';
import { PublicApiModule } from './public-api/public-api.module';
import { WhiteLabelSdkModule } from './white-label-sdk/white-label-sdk.module';

// Sustainability & Wellness modules
import { IoTIntegrationModule } from './iot-integration/iot-integration.module';
import { EcoFriendlyModule } from './eco-friendly/eco-friendly.module';
import { PresenterWellnessModule } from './presenter-wellness/presenter-wellness.module';
import { CarbonFootprintModule } from './carbon-footprint/carbon-footprint.module';

// Common modules for production
import { CacheModule } from './common/cache/cache.module';
import { SecurityModule } from './common/security/security.module';
import { MonitoringModule } from './common/monitoring/monitoring.module';
import { CsrfModule } from './common/csrf/csrf.module';
import { AdvancedRateLimitModule } from './common/rate-limit/advanced-rate-limit.module';

import { WorkersModule } from './workers/workers.module';

// Services for seeding
import { ThemesService } from './themes/themes.service';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from './common/redis/redis.module';
import { PerformanceInterceptor } from './common/monitoring/performance.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import featureFlagsConfig from './common/config/feature-flags.config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [featureFlagsConfig],
    }),

    // Redis
    RedisModule,

    // BullMQ (Async Jobs)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: configService.get('REDIS_PORT') || 6379,
        },
      }),
      inject: [ConfigService],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 10, // 10 requests per second
      },
      {
        name: 'medium',
        ttl: 10000, // 10 seconds
        limit: 50, // 50 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Database
    PrismaModule,

    // Scheduling
    ScheduleModule.forRoot(),

    // Feature modules
    AuthModule,
    UsersModule,
    ProjectsModule,
    SlidesModule,
    BlocksModule,
    ThemesModule,
    AIModule,
    PaymentsModule,
    ExportModule,
    UploadModule,

    // New feature modules
    CollaborationModule,
    VoiceModule,
    AnalyticsModule,
    IntegrationsModule,
    PersonalizationModule,
    OrganizationsModule,
    SyncModule,
    TagsModule,

    // Communication & Auth
    EmailModule,
    SmsModule,
    OtpModule,

    // Advanced feature modules
    AudienceAdaptationModule,
    InteractiveEmbedsModule,
    DataChartsModule,
    TemplateMarketplaceModule,
    DesignSystemModule,
    BrandKitModule,
    AccessibilityModule,
    MultilingualModule,
    NarrationExportModule,
    ContentGovernanceModule,
    TeamAnalyticsModule,
    ContentLibraryModule,
    ImageAcquisitionModule,
    ImageRecognitionModule,

    // AI-Enhanced Creativity & Immersive Tech
    AIResearchModule,
    StoryboardingModule,
    ABTestingModule,
    VRARModule,
    HolographicModule,
    BlockchainModule,

    // Advanced Collaboration & Analytics
    AICopilotModule,
    LiveQAModule,
    CrossPlatformSyncModule,
    PredictiveAnalyticsModule,
    SentimentAnalysisModule,
    LearningPathsModule,

    // Accessibility & Enterprise
    SignLanguageModule,
    CognitiveAccessibilityModule,
    UniversalDesignModule,
    PublicApiModule,
    WhiteLabelSdkModule,

    // Sustainability & Wellness
    IoTIntegrationModule,
    EcoFriendlyModule,
    PresenterWellnessModule,
    CarbonFootprintModule,

    // Production modules
    CacheModule,
    SecurityModule,
    MonitoringModule,
    CsrfModule,
    AdvancedRateLimitModule,
    WorkersModule,
  ],
  providers: [
    // Global rate limiting
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global performance monitoring
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly themesService: ThemesService) {}

  async onModuleInit() {
    // Seed default themes on startup
    await this.themesService.seedThemes();
  }
}
