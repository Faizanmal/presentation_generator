import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DocumentIngestionService } from './document-ingestion.service';
import { DocumentIngestionController } from './document-ingestion.controller';

@Module({
  imports: [ConfigModule],
  controllers: [DocumentIngestionController],
  providers: [DocumentIngestionService],
  exports: [DocumentIngestionService],
})
export class DocumentIngestionModule {}
