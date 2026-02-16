import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StoryboardingService } from './storyboarding.service';
import { StoryboardingController } from './storyboarding.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [ConfigModule, PrismaModule, AIModule],
  controllers: [StoryboardingController],
  providers: [StoryboardingService],
  exports: [StoryboardingService],
})
export class StoryboardingModule {}
