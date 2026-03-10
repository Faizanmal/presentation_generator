import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MobileApiService } from './mobile-api.service';
import { MobileApiController } from './mobile-api.controller';

@Module({
  imports: [PrismaModule],
  controllers: [MobileApiController],
  providers: [MobileApiService],
  exports: [MobileApiService],
})
export class MobileApiModule {}
