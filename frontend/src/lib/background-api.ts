import { api } from './api';

export interface GenerateBackgroundParams {
    prompt: string;
    style?: 'abstract' | 'gradient' | 'geometric' | 'minimal' | 'nature' | 'professional' | 'creative';
    colorScheme?: string;
}

export interface GeneratedBackground {
    url: string;
    revisedPrompt: string;
    originalPrompt: string;
    enhancedPrompt: string;
    style: string;
}

export const backgroundApi = {
    /**
     * Generate a custom background using AI
     */
    async generateBackground(params: GenerateBackgroundParams): Promise<GeneratedBackground> {
        const response = await api.post<GeneratedBackground>('/ai/generate-background', params);
        return response.data;
    },
};
