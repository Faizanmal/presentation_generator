import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { VersionControlService } from './version-control.service';
import { VersionControlController } from './version-control.controller';
import { AIModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    AIModule,
    UsersModule,
    BullModule.registerQueue({
      name: 'generation',
    }),
  ],
  controllers: [ProjectsController, VersionControlController],
  providers: [ProjectsService, VersionControlService],
  exports: [ProjectsService, VersionControlService],
})
export class ProjectsModule {}
