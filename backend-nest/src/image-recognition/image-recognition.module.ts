import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ImageRecognitionService } from './image-recognition.service';
import { ImageRecognitionController } from './image-recognition.controller';

@Module({
  imports: [ConfigModule],
  controllers: [ImageRecognitionController],
  providers: [ImageRecognitionService],
  exports: [ImageRecognitionService],
})
export class ImageRecognitionModule {}
