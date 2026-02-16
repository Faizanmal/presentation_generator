import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhiteLabelSdkService } from './white-label-sdk.service';
import { WhiteLabelSdkController } from './white-label-sdk.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [WhiteLabelSdkController],
  providers: [WhiteLabelSdkService],
  exports: [WhiteLabelSdkService],
})
export class WhiteLabelSdkModule {}
