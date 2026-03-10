import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { MicrosoftOfficeService } from './microsoft-office.service';
import { MicrosoftOfficeController } from './microsoft-office.controller';
import { PowerPointImportWorker } from './powerpoint-import.worker';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullModule.registerQueue({
      name: 'powerpoint-processing',
    }),
  ],
  controllers: [MicrosoftOfficeController],
  providers: [MicrosoftOfficeService, PowerPointImportWorker],
  exports: [MicrosoftOfficeService],
})
export class MicrosoftOfficeModule {}
