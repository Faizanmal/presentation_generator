import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { EmailTemplateCacheService } from './email-template-cache.service';
import { EmailProviderService } from './email-provider.service';
import { EmailTrackingService } from './email-tracking.service';
import { SendgridMailerService } from './sendgrid-mailer.service';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'email',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          count: 100, // Keep last 100 completed jobs
          age: 86400, // Remove jobs older than 24 hours
        },
        removeOnFail: {
          count: 200, // Keep last 200 failed jobs
          age: 604800, // Remove jobs older than 7 days
        },
      },
    }),
  ],
  providers: [
    EmailService,
    EmailProcessor,
    EmailTemplateCacheService,
    EmailProviderService,
    EmailTrackingService,
    SendgridMailerService,
  ],
  exports: [
    EmailService,
    EmailTemplateCacheService,
    EmailProviderService,
    EmailTrackingService,
  ],
})
export class EmailModule {}
