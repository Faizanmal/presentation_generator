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
import { ContentLibraryModule } from './library/content-library.module';
import { ImageAcquisitionModule } from './image-acquisition/image-acquisition.module';
import { ImageRecognitionModule } from './image-recognition/image-recognition.module';

// Document Ingestion (upload documents → AI slides)
import { DocumentIngestionModule } from './document-ingestion/document-ingestion.module';

// New AI-Enhanced Creativity & Immersive Tech modules
import { AIResearchModule } from './ai-research/ai-research.module';
import { StoryboardingModule } from './storyboarding/storyboarding.module';
import { ABTestingModule } from './ab-testing/ab-testing.module';

// Advanced Collaboration & Analytics modules
import { AICopilotModule } from './ai-copilot/ai-copilot.module';

// Accessibility & Enterprise modules
import { UniversalDesignModule } from './universal-design/universal-design.module';
import { PublicApiModule } from './public-api/public-api.module';

// Previously orphaned modules — now registered
import { AdvancedAnalyticsModule } from './advanced-analytics/advanced-analytics.module';
import { DataVisualizationModule } from './data-visualization/data-visualization.module';
import { EnterpriseComplianceModule } from './enterprise-compliance/enterprise-compliance.module';
import { MicrosoftOfficeModule } from './microsoft-office/microsoft-office.module';
import { MobileApiModule } from './mobile-api/mobile-api.module';
import { MobilePwaModule } from './mobile-pwa/mobile-pwa.module';
import { PluginSystemModule } from './plugin-system/plugin-system.module';
import { SocialSharingModule } from './social-sharing/social-sharing.module';
import { VideoRecordingModule } from './video-recording/video-recording.module';

// Common modules for production
import { CacheModule } from './common/cache/cache.module';
import { MonitoringModule } from './common/monitoring/monitoring.module';
import { CsrfModule } from './common/csrf/csrf.module';
import { AdvancedRateLimitModule } from './common/rate-limit/advanced-rate-limit.module';

// Enhanced Security Module (replaces old security module)
import { SecurityModule } from './security/security.module';

// New Infrastructure modules
import { CDNModule } from './common/cdn/cdn.module';
import { ShardingModule } from './common/database/sharding.module';
import { QueueModule } from './common/queue/queue.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';

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
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('REDIS_URL');
        const isProd = process.env.NODE_ENV === 'production';

        const commonOptions = {
          maxRetriesPerRequest: null,
          // Production safety: reduce heartbeat chatter
          // Extension of lock duration and stalled interval reduces periodic checks
          lockDuration: isProd ? 60000 : 30000,
          stalledInterval: isProd ? 60000 : 30000,
          retryStrategy: (times: number) => {
            if (times > 5) return null;
            return 5000;
          },
        };

        const connection = isProd && url ? new (require('ioredis'))(url, {
          ...commonOptions,
          ...(url.startsWith('rediss://') && { tls: { rejectUnauthorized: false } }),
        }) : {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: configService.get('REDIS_PORT') || 6379,
          ...commonOptions,
        };

        // If it's a Redis instance, attach error listener immediately
        if (typeof (connection as any).on === 'function') {
          (connection as any).on('error', (err: any) => {
            const bullLogger = new (require('@nestjs/common').Logger)('BullMQ');
            if (err.code === 'ECONNREFUSED') {
              bullLogger.error(`BullMQ Redis connection failed: ${err.message}`);
            } else {
              bullLogger.error('BullMQ Redis Error:', err);
            }
          });
        }

        return {
          connection: connection as any,
          defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: { count: 100 },
          },
        };
      },
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
    ContentLibraryModule,
    ImageAcquisitionModule,
    ImageRecognitionModule,
    DocumentIngestionModule,

    // AI-Enhanced Creativity & Immersive Tech
    AIResearchModule,
    StoryboardingModule,
    ABTestingModule,

    // Advanced Collaboration & Analytics
    AICopilotModule,

    // Accessibility & Enterprise
    UniversalDesignModule,
    PublicApiModule,

    // Sustainability & Wellness

    // Previously orphaned modules — now registered
    AdvancedAnalyticsModule,
    DataVisualizationModule,
    EnterpriseComplianceModule,
    MicrosoftOfficeModule,
    MobileApiModule,
    MobilePwaModule,
    PluginSystemModule,
    SocialSharingModule,
    VideoRecordingModule,

    // Production modules
    CacheModule,
    SecurityModule,
    MonitoringModule,
    CsrfModule,
    AdvancedRateLimitModule,
    WorkersModule,

    // New Infrastructure modules
    CDNModule,
    ShardingModule,
    QueueModule,
    RateLimitModule,
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
  constructor(private readonly themesService: ThemesService) { }

  async onModuleInit() {
    // Seed default themes on startup
    await this.themesService.seedThemes();
  }
}
