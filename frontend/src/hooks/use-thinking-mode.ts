'use client';

import { useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import type {
    ThinkingGenerationResult,
    ThinkingStep,
    ThinkingState,
    ThinkingPresentation,
    ThinkingPhase,
} from '@/types';

export interface UseThinkingModeOptions {
    onStep?: (step: ThinkingStep) => void;
    onStateChange?: (state: ThinkingState) => void;
    onComplete?: (result: ThinkingGenerationResult) => void;
    onError?: (error: Error) => void;
}

export interface ThinkingModeGenerationParams {
    topic: string;
    tone?: 'professional' | 'casual' | 'academic' | 'creative';
    audience?: string;
    length?: number;
    type?: 'presentation' | 'document' | 'pitch-deck' | 'report';
    style?: 'professional' | 'creative' | 'academic' | 'casual';
    generateImages?: boolean;
    smartLayout?: boolean;
    qualityLevel?: 'standard' | 'high' | 'premium';
    additionalContext?: string;
    brandGuidelines?: {
        colors?: string[];
        fonts?: string[];
        tone?: string;
        restrictions?: string[];
    };
}

export function useThinkingMode(options: UseThinkingModeOptions = {}) {
    const { onStep, onStateChange, onComplete, onError } = options;

    // State
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentPhase, setCurrentPhase] = useState<ThinkingPhase | null>(null);
    const [progress, setProgress] = useState(0);
    const [steps, setSteps] = useState<ThinkingStep[]>([]);
    const [result, setResult] = useState<ThinkingGenerationResult | null>(null);
    const [error, setError] = useState<Error | null>(null);

    // Cleanup ref for streaming
    const cleanupRef = useRef<(() => void) | null>(null);

    /**
     * Generate with full thinking loop (non-streaming)
     */
    const generate = useCallback(
        async (params: ThinkingModeGenerationParams) => {
            setIsGenerating(true);
            setError(null);
            setSteps([]);
            setResult(null);
            setProgress(0);
            setCurrentPhase('planning');

            try {
                // Simulate progress updates
                const progressInterval = setInterval(() => {
                    setProgress((prev) => {
                        if (prev >= 90) { return prev; }
                        const increment = Math.random() * 5 + 2;
                        const newProgress = Math.min(prev + increment, 90);

                        // Update phase based on progress
                        if (newProgress < 20) { setCurrentPhase('planning'); }
                        else if (newProgress < 50) { setCurrentPhase('generation'); }
                        else if (newProgress < 70) { setCurrentPhase('reflection'); }
                        else if (newProgress < 90) { setCurrentPhase('refinement'); }

                        return newProgress;
                    });
                }, 500);

                const generationResult = await api.generateWithThinking({
                    topic: params.topic,
                    tone: params.tone,
                    audience: params.audience,
                    length: params.length,
                    type: params.type,
                    style: params.style,
                    generateImages: params.generateImages,
                    smartLayout: params.smartLayout ?? true,
                    qualityLevel: params.qualityLevel || 'high',
                    additionalContext: params.additionalContext,
                    brandGuidelines: params.brandGuidelines,
                });

                clearInterval(progressInterval);
                setProgress(100);
                setCurrentPhase('complete');
                setResult(generationResult);
                // Normalize thinking steps: support older/newer backend shapes
                setSteps(
                    generationResult.thinkingSteps ?? []
                );
                onComplete?.(generationResult);

                return generationResult;
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Generation failed');
                setError(error);
                onError?.(error);
                throw error;
            } finally {
                setIsGenerating(false);
            }
        },
        [onComplete, onError]
    );

    /**
     * Quick generation without thinking loop
     */
    const generateQuick = useCallback(
        async (params: Pick<ThinkingModeGenerationParams, 'topic' | 'tone' | 'audience' | 'length' | 'type'>) => {
            setIsGenerating(true);
            setError(null);
            setResult(null);
            setCurrentPhase('generation');

            try {
                const generationResult = await api.generateQuick({
                    topic: params.topic,
                    tone: params.tone,
                    audience: params.audience,
                    length: params.length,
                    type: params.type,
                });

                setProgress(100);
                setCurrentPhase('complete');
                setResult(generationResult);
                onComplete?.(generationResult);

                return generationResult;
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Generation failed');
                setError(error);
                onError?.(error);
                throw error;
            } finally {
                setIsGenerating(false);
            }
        },
        [onComplete, onError]
    );

    /**
     * Stream generation with real-time updates
     */
    const generateWithStreaming = useCallback(
        (params: ThinkingModeGenerationParams) => {
            // Clean up any existing stream
            cleanupRef.current?.();

            setIsGenerating(true);
            setError(null);
            setSteps([]);
            setResult(null);
            setProgress(0);
            setCurrentPhase('planning');

            const cleanup = api.streamThinkingGeneration(
                {
                    topic: params.topic,
                    tone: params.tone,
                    audience: params.audience,
                    length: params.length,
                    type: params.type,
                    qualityLevel: params.qualityLevel,
                },
                (step: ThinkingStep) => {
                    setSteps((prev) => [...prev, step]);
                    setCurrentPhase(step.phase);
                    onStep?.(step);
                },
                (state: ThinkingState) => {
                    setProgress(state.overallProgress);
                    setCurrentPhase(state.currentPhase);
                    onStateChange?.(state);
                },
                (_presentation: ThinkingPresentation) => {
                    // When streaming completes, fetch full result
                    generate(params).catch(() => { });
                },
                (err: Error) => {
                    setError(err);
                    setIsGenerating(false);
                    onError?.(err);
                }
            );

            cleanupRef.current = cleanup;
            return cleanup;
        },
        [generate, onStep, onStateChange, onError]
    );

    /**
     * Compare quality between thinking and quick modes
     */
    const compareQuality = useCallback(
        async (topic: string, audience?: string) => {
            return api.compareThinkingQuality(topic, audience);
        },
        []
    );

    /**
     * Cancel ongoing generation
     */
    const cancel = useCallback(() => {
        cleanupRef.current?.();
        cleanupRef.current = null;
        setIsGenerating(false);
        setCurrentPhase(null);
    }, []);

    /**
     * Reset state
     */
    const reset = useCallback(() => {
        cancel();
        setSteps([]);
        setResult(null);
        setError(null);
        setProgress(0);
        setCurrentPhase(null);
    }, [cancel]);

    return {
        // State
        isGenerating,
        currentPhase,
        progress,
        steps,
        result,
        error,

        // Actions
        generate,
        generateQuick,
        generateWithStreaming,
        compareQuality,
        cancel,
        reset,

        // Helpers
        phaseProgress: {
            planning: currentPhase === 'planning' || progress < 20,
            generation: currentPhase === 'generation' || (progress >= 20 && progress < 50),
            reflection: currentPhase === 'reflection' || (progress >= 50 && progress < 70),
            refinement: currentPhase === 'refinement' || (progress >= 70 && progress < 100),
            complete: currentPhase === 'complete' || progress >= 100,
        },
    };
}

export default useThinkingMode;
