import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PresenterWellnessService } from './presenter-wellness.service';
import { PresenterWellnessController } from './presenter-wellness.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [PresenterWellnessController],
  providers: [PresenterWellnessService],
  exports: [PresenterWellnessService],
})
export class PresenterWellnessModule {}
