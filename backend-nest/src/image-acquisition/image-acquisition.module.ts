import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { ImageAcquisitionService } from './image-acquisition.service';
import { ImageAcquisitionController } from './image-acquisition.controller';
import { ImageAcquisitionProcessor } from './image-acquisition.processor';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullModule.registerQueue({
      name: 'image-acquisition',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100,
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    }),
  ],
  controllers: [ImageAcquisitionController],
  providers: [ImageAcquisitionService, ImageAcquisitionProcessor],
  exports: [ImageAcquisitionService],
})
export class ImageAcquisitionModule {}
