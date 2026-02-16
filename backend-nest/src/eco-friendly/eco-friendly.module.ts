import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EcoFriendlyService } from './eco-friendly.service';
import { EcoFriendlyController } from './eco-friendly.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [EcoFriendlyController],
  providers: [EcoFriendlyService],
  exports: [EcoFriendlyService],
})
export class EcoFriendlyModule {}
