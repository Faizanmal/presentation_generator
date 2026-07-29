import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DataVisualizationService } from './data-visualization.service';
import { DataConnectorService } from './data-connector.service';
import { ChartGeneratorService } from './chart-generator.service';
import { DataVisualizationController } from './data-visualization.controller';
import { optionalBullQueue } from '../common/config/optional-bull-queue';

@Module({
  imports: [PrismaModule, ...optionalBullQueue('data-sync')],
  controllers: [DataVisualizationController],
  providers: [
    DataVisualizationService,
    DataConnectorService,
    ChartGeneratorService,
  ],
  exports: [
    DataVisualizationService,
    DataConnectorService,
    ChartGeneratorService,
  ],
})
export class DataVisualizationModule {}
