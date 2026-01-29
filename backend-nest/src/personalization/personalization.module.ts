import { Module } from '@nestjs/common';
import { PersonalizationController } from './personalization.controller';
import { PersonalizationService } from './personalization.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [PrismaModule, UploadModule],
  controllers: [PersonalizationController],
  providers: [PersonalizationService],
  exports: [PersonalizationService],
})
export class PersonalizationModule {}
