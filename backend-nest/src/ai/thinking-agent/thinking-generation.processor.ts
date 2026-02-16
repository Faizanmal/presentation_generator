import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { UsersService } from '../../users/users.service';
import { ThinkingAgentOrchestratorService } from './thinking-agent-orchestrator.service';
import { ThinkingProjectService } from './thinking-project.service';
import { ThinkingGenerationJobData } from './thinking-jobs.types';
import { transformThinkingGenerationResult } from './thinking-response.mapper';
import { ConcurrencyConfig } from '../../common/config/concurrency.config';

@Processor('thinking-generation', {
  concurrency: ConcurrencyConfig.thinkingGeneration.concurrency,
  limiter: ConcurrencyConfig.thinkingGeneration.limiter,
})
export class ThinkingGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ThinkingGenerationProcessor.name);

  constructor(
    private readonly orchestrator: ThinkingAgentOrchestratorService,
    private readonly thinkingProjectService: ThinkingProjectService,
    private readonly usersService: UsersService,
  ) {
    super();
  }

  async process(job: Job<ThinkingGenerationJobData>) {
    const { userId, action, params, aiGenerationCost, createProjectOptions } =
      job.data;
    this.logger.log(
      `Processing thinking job ${job.id} (${action}) for user ${userId}`,
    );

    const thinkingResult = await this.orchestrator.generateWithThinking(params);

    if (action === 'generate') {
      await this.usersService.incrementAIGenerations(userId, aiGenerationCost);
      return {
        kind: 'generate',
        result: transformThinkingGenerationResult(thinkingResult),
      };
    }

    const projectResult =
      await this.thinkingProjectService.createProjectFromThinkingResult(
        userId,
        thinkingResult.presentation,
        {
          title:
            createProjectOptions?.title || thinkingResult.presentation.title,
          description:
            createProjectOptions?.description ||
            thinkingResult.presentation.metadata.summary,
          themeId: createProjectOptions?.themeId,
          generateImages: params.generateImages,
        },
      );

    await this.usersService.incrementAIGenerations(userId, aiGenerationCost);

    return {
      kind: 'generate-and-create',
      result: {
        projectId: projectResult.projectId,
        slideCount: projectResult.slideCount,
        blockCount: projectResult.blockCount,
        qualityScore: thinkingResult.qualityReport.overallScore,
        generationTimeMs: thinkingResult.metadata.totalTimeMs,
        tokensUsed: thinkingResult.metadata.totalTokensUsed,
      },
    };
  }
}
