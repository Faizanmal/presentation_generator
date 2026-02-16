import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AICopilotService } from './ai-copilot.service';
import { AICopilotController } from './ai-copilot.controller';
import { AICopilotGateway } from './ai-copilot.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [ConfigModule, PrismaModule, AIModule],
  controllers: [AICopilotController],
  providers: [AICopilotService, AICopilotGateway],
  exports: [AICopilotService],
})
export class AICopilotModule {}
