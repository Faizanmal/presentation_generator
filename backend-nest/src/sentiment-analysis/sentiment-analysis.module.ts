import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SentimentAnalysisService } from './sentiment-analysis.service';
import { SentimentAnalysisController } from './sentiment-analysis.controller';
import { SentimentAnalysisGateway } from './sentiment-analysis.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [ConfigModule, PrismaModule, AIModule],
  controllers: [SentimentAnalysisController],
  providers: [SentimentAnalysisService, SentimentAnalysisGateway],
  exports: [SentimentAnalysisService],
})
export class SentimentAnalysisModule {}
