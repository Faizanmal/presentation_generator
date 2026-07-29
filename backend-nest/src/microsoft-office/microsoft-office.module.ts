import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MicrosoftOfficeService } from './microsoft-office.service';
import { MicrosoftOfficeController } from './microsoft-office.controller';
import { PowerPointImportWorker } from './powerpoint-import.worker';
import { PrismaModule } from '../prisma/prisma.module';
import { optionalBullQueue } from '../common/config/optional-bull-queue';
import { shouldRegisterProcessor } from '../common/config/redis-load.config';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ...optionalBullQueue('powerpoint-processing'),
  ],
  controllers: [MicrosoftOfficeController],
  providers: [
    MicrosoftOfficeService,
    ...(shouldRegisterProcessor('powerpoint-processing')
      ? [PowerPointImportWorker]
      : []),
  ],
  exports: [MicrosoftOfficeService],
})
export class MicrosoftOfficeModule {}
