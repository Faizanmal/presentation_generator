import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CarbonFootprintService } from './carbon-footprint.service';
import { CarbonFootprintController } from './carbon-footprint.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [CarbonFootprintController],
  providers: [CarbonFootprintService],
  exports: [CarbonFootprintService],
})
export class CarbonFootprintModule {}
