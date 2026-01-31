import { Module } from '@nestjs/common';
import { DataChartsService } from './data-charts.service';
import { DataChartsController } from './data-charts.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AIModule],
  controllers: [DataChartsController],
  providers: [DataChartsService],
  exports: [DataChartsService],
})
export class DataChartsModule {}
