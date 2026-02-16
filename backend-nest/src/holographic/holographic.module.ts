import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HolographicService } from './holographic.service';
import { HolographicController } from './holographic.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [HolographicController],
  providers: [HolographicService],
  exports: [HolographicService],
})
export class HolographicModule {}
