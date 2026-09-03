import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { VersionControlService } from './version-control.service';
import { VersionControlController } from './version-control.controller';
import { AIModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';
import { SlidesModule } from '../slides/slides.module';
import { ThinkingAgentModule } from '../ai/thinking-agent/thinking-agent.module';

@Module({
  imports: [
    AIModule,
    UsersModule,
    SlidesModule,
    forwardRef(() => ThinkingAgentModule),
    BullModule.registerQueue({
      name: 'generation',
      defaultJobOptions: {
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: { age: 86400, count: 50 },
      },
    }),
  ],
  controllers: [ProjectsController, VersionControlController],
  providers: [ProjectsService, VersionControlService],
  exports: [ProjectsService, VersionControlService],
})
export class ProjectsModule {}
