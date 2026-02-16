import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { AIModule } from '../ai.module';
import { UsersModule } from '../../users/users.module';
import { PlannerAgentService } from './planner-agent.service';
import { GeneratorAgentService } from './generator-agent.service';
import { CriticAgentService } from './critic-agent.service';
import { ThinkingAgentOrchestratorService } from './thinking-agent-orchestrator.service';
import { ThinkingProjectService } from './thinking-project.service';
import { ThinkingAgentController } from './thinking-agent.controller';
import { ResearchAgentService } from './research-agent.service';
import { ThinkingGenerationProcessor } from './thinking-generation.processor';
import { ImageGenerationProcessor } from './image-generation.processor';

/**
 * Thinking Agent Module
 *
 * A multi-agent AI system for generating high-quality presentations
 * through iterative thinking loops with planning, generation,
 * reflection, and refinement phases.
 *
 * Components:
 * - PlannerAgentService: Deep topic analysis, audience profiling, content strategy
 * - ResearchAgentService: Web search and data synthesis for factual accuracy
 * - GeneratorAgentService: Section-by-section content generation with context awareness
 * - CriticAgentService: Multi-criteria quality evaluation and improvement suggestions
 * - ThinkingAgentOrchestratorService: Coordinates the thinking loop
 * - ThinkingProjectService: Converts thinking results to database projects
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    UsersModule,
    forwardRef(() => AIModule),
    BullModule.registerQueue({
      name: 'thinking-generation',
    }),
    BullModule.registerQueue({
      name: 'image-generation',
    }),
  ],
  controllers: [ThinkingAgentController],
  providers: [
    PlannerAgentService,
    ResearchAgentService,
    GeneratorAgentService,
    CriticAgentService,
    ThinkingAgentOrchestratorService,
    ThinkingProjectService,
    ThinkingProjectService,
    ThinkingGenerationProcessor,
    ImageGenerationProcessor,
  ],
  exports: [
    ThinkingAgentOrchestratorService,
    PlannerAgentService,
    ResearchAgentService,
    GeneratorAgentService,
    CriticAgentService,
    ThinkingProjectService,
  ],
})
export class ThinkingAgentModule {}
