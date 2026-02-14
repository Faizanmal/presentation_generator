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
import { AccessibilityModule } from './accessibility/accessibility.module';
import { MultilingualModule } from './multilingual/multilingual.module';
import { NarrationExportModule } from './narration-export/narration-export.module';
import { ContentGovernanceModule } from './content-governance/content-governance.module';
import { TeamAnalyticsModule } from './team-analytics/team-analytics.module';
import { ContentLibraryModule } from './library/content-library.module';

// Common modules for production
import { CacheModule } from './common/cache/cache.module';
import { SecurityModule } from './common/security/security.module';
import { MonitoringModule } from './common/monitoring/monitoring.module';
import { CsrfModule } from './common/csrf/csrf.module';

// Services for seeding
import { ThemesService } from './themes/themes.service';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from './common/redis/redis.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
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
    AccessibilityModule,
    MultilingualModule,
    NarrationExportModule,
    ContentGovernanceModule,
    TeamAnalyticsModule,
    ContentLibraryModule,

    // Production modules
    CacheModule,
    SecurityModule,
    MonitoringModule,
    CsrfModule,
  ],
  providers: [
    // Global rate limiting
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
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
