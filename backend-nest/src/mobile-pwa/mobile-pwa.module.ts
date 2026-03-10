import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { MobilePwaService } from './mobile-pwa.service';
import { PushNotificationService } from './push-notification.service';
import { OfflineSyncService } from './offline-sync.service';
import { MobilePwaController } from './mobile-pwa.controller';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'push-notifications',
    }),
    BullModule.registerQueue({
      name: 'offline-sync',
    }),
  ],
  controllers: [MobilePwaController],
  providers: [MobilePwaService, PushNotificationService, OfflineSyncService],
  exports: [MobilePwaService, PushNotificationService, OfflineSyncService],
})
export class MobilePwaModule {}
