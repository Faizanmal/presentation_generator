import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UniversalDesignService } from './universal-design.service';
import { UniversalDesignController } from './universal-design.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [ConfigModule, PrismaModule, AIModule],
  controllers: [UniversalDesignController],
  providers: [UniversalDesignService],
  exports: [UniversalDesignService],
})
export class UniversalDesignModule {}
