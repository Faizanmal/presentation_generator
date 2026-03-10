import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SocialSharingService } from './social-sharing.service';
import { SocialSharingController } from './social-sharing.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [SocialSharingController],
  providers: [SocialSharingService],
  exports: [SocialSharingService],
})
export class SocialSharingModule {}
