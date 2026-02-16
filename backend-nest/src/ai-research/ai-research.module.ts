import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIResearchService } from './ai-research.service';
import { AIResearchController } from './ai-research.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [ConfigModule, PrismaModule, AIModule],
  controllers: [AIResearchController],
  providers: [AIResearchService],
  exports: [AIResearchService],
})
export class AIResearchModule {}
