import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SignLanguageService } from './sign-language.service';
import { SignLanguageController } from './sign-language.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [ConfigModule, PrismaModule, AIModule],
  controllers: [SignLanguageController],
  providers: [SignLanguageService],
  exports: [SignLanguageService],
})
export class SignLanguageModule {}
