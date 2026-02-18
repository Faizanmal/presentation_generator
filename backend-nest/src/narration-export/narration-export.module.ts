import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NarrationExportService } from './narration-export.service';
import { NarrationExportController } from './narration-export.controller';
import { NarrationExportProcessor } from './narration-export.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';

import { AIModule } from '../ai/ai.module';

@Module({
  imports: [
    PrismaModule,
    UploadModule,
    AIModule,
    BullModule.registerQueue({ name: 'narration' }),
  ],
  controllers: [NarrationExportController],
  providers: [NarrationExportService, NarrationExportProcessor],
  exports: [NarrationExportService],
})
export class NarrationExportModule {}
