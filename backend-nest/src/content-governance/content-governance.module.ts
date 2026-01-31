import { Module } from '@nestjs/common';
import { ContentGovernanceService } from './content-governance.service';
import { ContentGovernanceController } from './content-governance.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ContentGovernanceController],
  providers: [ContentGovernanceService],
  exports: [ContentGovernanceService],
})
export class ContentGovernanceModule {}
