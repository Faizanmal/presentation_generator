import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VideoRecordingService } from './video-recording.service';
import { VideoRecordingController } from './video-recording.controller';
import { VideoProcessingWorker } from './video-processing.worker';
import { PrismaModule } from '../prisma/prisma.module';
import { optionalBullQueue } from '../common/config/optional-bull-queue';
import { shouldRegisterProcessor } from '../common/config/redis-load.config';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ...optionalBullQueue('video-processing'),
  ],
  controllers: [VideoRecordingController],
  providers: [
    VideoRecordingService,
    ...(shouldRegisterProcessor('video-processing')
      ? [VideoProcessingWorker]
      : []),
  ],
  exports: [VideoRecordingService],
})
export class VideoRecordingModule {}
