import { Module } from '@nestjs/common';
import { StockImageAcquisitionWorker } from './stock-image-acquisition.worker';
import { ImageAcquisitionModule } from '../image-acquisition/image-acquisition.module';

@Module({
  imports: [ImageAcquisitionModule],
  providers: [StockImageAcquisitionWorker],
})
export class WorkersModule {}
