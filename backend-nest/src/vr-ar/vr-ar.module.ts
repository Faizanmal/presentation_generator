import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VRARService } from './vr-ar.service';
import { VRARController } from './vr-ar.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [ConfigModule, PrismaModule, ProjectsModule],
  controllers: [VRARController],
  providers: [VRARService],
  exports: [VRARService],
})
export class VRARModule {}
