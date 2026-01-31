import { Module } from '@nestjs/common';
import { MultilingualService } from './multilingual.service';
import { MultilingualController } from './multilingual.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AIModule],
  controllers: [MultilingualController],
  providers: [MultilingualService],
  exports: [MultilingualService],
})
export class MultilingualModule {}
