import { Module } from '@nestjs/common';
import { NarrationExportService } from './narration-export.service';
import { NarrationExportController } from './narration-export.controller';
import { NarrationExportProcessor } from './narration-export.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';
import { AIModule } from '../ai/ai.module';
import { optionalBullQueue } from '../common/config/optional-bull-queue';
import { shouldRegisterProcessor } from '../common/config/redis-load.config';

@Module({
  imports: [
    PrismaModule,
    UploadModule,
    AIModule,
    ...optionalBullQueue('narration'),
  ],
  controllers: [NarrationExportController],
  providers: [
    NarrationExportService,
    ...(shouldRegisterProcessor('narration') ? [NarrationExportProcessor] : []),
  ],
  exports: [NarrationExportService],
})
export class NarrationExportModule {}
