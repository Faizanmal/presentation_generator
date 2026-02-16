import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PublicApiService } from './public-api.service';
import { PublicApiController } from './public-api.controller';
import { PublicApiGuard } from './public-api.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [PublicApiController],
  providers: [PublicApiService, PublicApiGuard],
  exports: [PublicApiService],
})
export class PublicApiModule {}
