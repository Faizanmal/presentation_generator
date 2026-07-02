/**
 * useGeneration — React hook for triggering and monitoring AI presentation generation.
 * 
 * Features:
 * - API call with loading/error state
 * - SSE subscription for real-time progress
 * - Automatic retry on network failure
 * - Edit memory integration
 */
'use client';

import { useCallback, useRef } from 'react';
import { useGenerationStore } from '@/stores/generation-store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface GenerateOptions {
  topic: string;
  audience?: string;
  tone?: string;
  length?: number;
  style?: 'professional' | 'creative' | 'academic' | 'casual' | 'bold';
  templateType?: string;
  generateImages?: boolean;
  imageSource?: 'ai' | 'stock';
  qualityTier?: 'fast' | 'balanced' | 'premium';
  additionalContext?: string;
  themeId?: string;
  regenerateSlideIds?: string[];
  brandGuidelines?: {
    colors?: string[];
    fonts?: string[];
    tone?: string;
  };
}

export function useGeneration() {
  const store = useGenerationStore();
  const abortRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const generate = useCallback(
    async (options: GenerateOptions, token?: string) => {
      // Cancel any existing generation
      abortRef.current?.abort();
      eventSourceRef.current?.close();

      const abortController = new AbortController();
      abortRef.current = abortController;

      store.reset();

      try {
        const response = await fetch(`${API_BASE}/api/v2/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            ...options,
            editMemory: store.editMemory,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Generation failed' }));
          throw new Error(error.message || `HTTP ${response.status}`);
        }

        const result = await response.json();

        store.setResult(result.document, result.quality);

        return result;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {return null;}
        const message = (error as Error).message || 'Generation failed';
        store.setError(message);
        throw error;
      }
    },
    [store],
  );

  /**
   * Subscribe to SSE stream for real-time progress updates.
   * Call this BEFORE starting generation if you want live updates.
   */
  const subscribeToProgress = useCallback(
    (sessionId: string) => {
      eventSourceRef.current?.close();

      const es = new EventSource(
        `${API_BASE}/api/v2/generate/${sessionId}/stream`,
      );

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          store.updateProgress(data);
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
      };

      eventSourceRef.current = es;

      return () => es.close();
    },
    [store],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    eventSourceRef.current?.close();
    store.reset();
  }, [store]);

  return {
    generate,
    subscribeToProgress,
    cancel,
    // Expose store state
    status: store.status,
    progress: store.progress,
    currentAgent: store.currentAgent,
    message: store.message,
    document: store.generatedDocument,
    quality: store.qualityReport,
    error: store.error,
    isGenerating: store.status !== 'idle' && store.status !== 'complete' && store.status !== 'failed',
    // Edit memory
    editMemory: store.editMemory,
    addEditMemory: store.addEditMemory,
    pinEditMemory: store.pinEditMemory,
  };
}
