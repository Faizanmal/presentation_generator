import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MobilePwaService } from './mobile-pwa.service';
import { PushNotificationService } from './push-notification.service';
import { OfflineSyncService } from './offline-sync.service';
import { MobilePwaController } from './mobile-pwa.controller';
import { optionalBullQueue } from '../common/config/optional-bull-queue';

@Module({
  imports: [
    PrismaModule,
    ...optionalBullQueue('push-notifications'),
    ...optionalBullQueue('offline-sync'),
  ],
  controllers: [MobilePwaController],
  providers: [MobilePwaService, PushNotificationService, OfflineSyncService],
  exports: [MobilePwaService, PushNotificationService, OfflineSyncService],
})
export class MobilePwaModule {}
