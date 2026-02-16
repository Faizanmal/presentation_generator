import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CrossPlatformSyncService } from './cross-platform-sync.service';
import { CrossPlatformSyncController } from './cross-platform-sync.controller';
import { CrossPlatformSyncGateway } from './cross-platform-sync.gateway';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [CrossPlatformSyncController],
  providers: [CrossPlatformSyncService, CrossPlatformSyncGateway],
  exports: [CrossPlatformSyncService],
})
export class CrossPlatformSyncModule {}
