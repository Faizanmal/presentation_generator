import { Module } from '@nestjs/common';
import { DesignSystemService } from './design-system.service';
import { DesignSystemController } from './design-system.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DesignSystemController],
  providers: [DesignSystemService],
  exports: [DesignSystemService],
})
export class DesignSystemModule {}
