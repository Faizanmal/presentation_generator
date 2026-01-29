import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

// New feature modules
import { CollaborationModule } from './collaboration/collaboration.module';
import { VoiceModule } from './voice/voice.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { PersonalizationModule } from './personalization/personalization.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { SyncModule } from './sync/sync.module';

// Services for seeding
import { ThemesService } from './themes/themes.service';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
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
