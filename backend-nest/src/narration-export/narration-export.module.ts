import { Module } from '@nestjs/common';
import { NarrationExportService } from './narration-export.service';
import { NarrationExportController } from './narration-export.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [PrismaModule, UploadModule],
  controllers: [NarrationExportController],
  providers: [NarrationExportService],
  exports: [NarrationExportService],
})
export class NarrationExportModule {}
