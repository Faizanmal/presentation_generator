/**
 * Agents Module — NestJS module for the multi-agent generation pipeline.
 *
 * Registers all agents, the pipeline orchestrator, and the controller.
 * Depends on AIModule for the underlying AIService and
 * ThinkingAgentModule for the ResearchAgentService.
 */
import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AIModule } from '../ai.module';
import { ThinkingAgentModule } from '../thinking-agent/thinking-agent.module';
import { OutlineAgentService } from './outline-agent.service';
import { NarrativeAgentService } from './narrative-agent.service';
import { LayoutAgentService } from './layout-agent.service';
import { DesignAgentService } from './design-agent.service';
import { ImageAgentService } from './image-agent.service';
import { QAAgentService } from './qa-agent.service';
import { GenerationPipelineService } from './generation-pipeline.service';
import { GenerationPipelineController } from './generation-pipeline.controller';
import {
  GenerationQueueProcessor,
  GENERATION_QUEUE,
} from './generation-queue.processor';

@Module({
  imports: [
    forwardRef(() => AIModule),
    forwardRef(() => ThinkingAgentModule),
    BullModule.registerQueue({
      name: GENERATION_QUEUE,
    }),
  ],
  controllers: [GenerationPipelineController],
  providers: [
    OutlineAgentService,
    NarrativeAgentService,
    LayoutAgentService,
    DesignAgentService,
    ImageAgentService,
    QAAgentService,
    GenerationPipelineService,
    GenerationQueueProcessor,
  ],
  exports: [GenerationPipelineService],
})
export class AgentsModule {}
