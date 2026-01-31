import { Module } from '@nestjs/common';
import { TeamAnalyticsService } from './team-analytics.service';
import { TeamAnalyticsController } from './team-analytics.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TeamAnalyticsController],
  providers: [TeamAnalyticsService],
  exports: [TeamAnalyticsService],
})
export class TeamAnalyticsModule {}
