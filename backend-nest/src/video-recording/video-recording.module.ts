import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { VideoRecordingService } from './video-recording.service';
import { VideoRecordingController } from './video-recording.controller';
import { VideoProcessingWorker } from './video-processing.worker';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullModule.registerQueue({
      name: 'video-processing',
    }),
  ],
  controllers: [VideoRecordingController],
  providers: [VideoRecordingService, VideoProcessingWorker],
  exports: [VideoRecordingService],
})
export class VideoRecordingModule {}
