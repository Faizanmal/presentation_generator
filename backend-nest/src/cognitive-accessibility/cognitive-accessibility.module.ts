import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CognitiveAccessibilityService } from './cognitive-accessibility.service';
import { CognitiveAccessibilityController } from './cognitive-accessibility.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [ConfigModule, PrismaModule, AIModule],
  controllers: [CognitiveAccessibilityController],
  providers: [CognitiveAccessibilityService],
  exports: [CognitiveAccessibilityService],
})
export class CognitiveAccessibilityModule {}
