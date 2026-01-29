import { Module } from '@nestjs/common';
import { SlidesService } from './slides.service';
import { SlidesController } from './slides.controller';
import { TransitionsService } from './transitions.service';

@Module({
  controllers: [SlidesController],
  providers: [SlidesService, TransitionsService],
  exports: [SlidesService, TransitionsService],
})
export class SlidesModule {}
