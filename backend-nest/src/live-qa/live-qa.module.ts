import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LiveQAService } from './live-qa.service';
import { LiveQAController } from './live-qa.controller';
import { LiveQAGateway } from './live-qa.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [ConfigModule, PrismaModule, AIModule],
  controllers: [LiveQAController],
  providers: [LiveQAService, LiveQAGateway],
  exports: [LiveQAService],
})
export class LiveQAModule {}
