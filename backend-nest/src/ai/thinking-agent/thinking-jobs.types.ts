import { EnhancedGenerationParams } from './thinking-agent.types';

export interface ThinkingCreateProjectOptions {
  title?: string;
  description?: string;
  themeId?: string;
}

export interface ThinkingGenerationJobData {
  userId: string;
  action: 'generate' | 'generate-and-create';
  params: EnhancedGenerationParams;
  aiGenerationCost: number;
  createProjectOptions?: ThinkingCreateProjectOptions;
}

export interface ThinkingQueuedResponse {
  status: 'queued';
  jobId: string;
  message: string;
}
