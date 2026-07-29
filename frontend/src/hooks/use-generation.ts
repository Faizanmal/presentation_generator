/**
 * useGeneration — React hook for triggering and monitoring AI presentation generation.
 *
 * Features:
 * - API call with loading/error state
 * - SSE subscription for real-time progress
 * - Edit memory integration
 * - Partial regeneration (pin-aware)
 */
'use client';

import { useCallback, useRef } from 'react';
import { useGenerationStore, type EditMemoryEntry } from '@/stores/generation-store';

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
  brandKitId?: string;
  projectId?: string;
  regenerateSlideIds?: string[];
  brandGuidelines?: {
    colors?: string[];
    fonts?: string[];
    tone?: string;
    logos?: string[];
    restrictions?: string[];
  };
}

export interface PartialRegenerateOptions extends Omit<GenerateOptions, 'topic'> {
  topic?: string;
  slideIds: string[];
  existingDocumentId?: string;
  existingDocument?: unknown;
  projectId?: string;
  editMemory?: EditMemoryEntry[];
}

function authHeaders(token?: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function useGeneration() {
  const store = useGenerationStore();
  const abortRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const generate = useCallback(
    async (options: GenerateOptions, token?: string) => {
      abortRef.current?.abort();
      eventSourceRef.current?.close();

      const abortController = new AbortController();
      abortRef.current = abortController;

      store.reset();

      try {
        const response = await fetch(`${API_BASE}/api/v2/generate`, {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify({
            ...options,
            projectId: options.projectId,
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
        if ((error as Error).name === 'AbortError') {
          return null;
        }
        const message = (error as Error).message || 'Generation failed';
        store.setError(message);
        throw error;
      }
    },
    [store],
  );

  /**
   * Regenerate unlocked slides while preserving pinned edit memory.
   */
  const regeneratePartial = useCallback(
    async (options: PartialRegenerateOptions, token?: string) => {
      abortRef.current?.abort();

      const abortController = new AbortController();
      abortRef.current = abortController;

      const projectId =
        options.projectId ||
        options.existingDocumentId ||
        (store.generatedDocument as { id?: string } | null)?.id;

      const existingDocument =
        options.existingDocument || store.generatedDocument;

      if (!existingDocument && !projectId) {
        const message = 'No generated document available to regenerate';
        store.setError(message);
        throw new Error(message);
      }

      store.startGeneration(projectId || 'partial');

      try {
        const response = await fetch(`${API_BASE}/api/v2/generate/partial`, {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify({
            topic:
              options.topic ||
              (existingDocument as { title?: string })?.title ||
              'Presentation',
            audience: options.audience,
            tone: options.tone,
            length: options.length,
            style: options.style,
            templateType: options.templateType,
            generateImages: options.generateImages,
            imageSource: options.imageSource,
            qualityTier: options.qualityTier,
            brandKitId: options.brandKitId,
            brandGuidelines: options.brandGuidelines,
            slideIds: options.slideIds,
            projectId,
            existingDocumentId: projectId,
            existingDocument,
            editMemory: options.editMemory || store.editMemory,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({
            message: 'Partial regeneration failed',
          }));
          throw new Error(error.message || `HTTP ${response.status}`);
        }

        const result = await response.json();
        store.setResult(result.document, result.quality);
        return result;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return null;
        }
        const message = (error as Error).message || 'Partial regeneration failed';
        store.setError(message);
        throw error;
      }
    },
    [store],
  );

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
    regeneratePartial,
    subscribeToProgress,
    cancel,
    status: store.status,
    progress: store.progress,
    currentAgent: store.currentAgent,
    message: store.message,
    document: store.generatedDocument,
    quality: store.qualityReport,
    error: store.error,
    isGenerating:
      store.status !== 'idle' &&
      store.status !== 'complete' &&
      store.status !== 'failed',
    editMemory: store.editMemory,
    addEditMemory: store.addEditMemory,
    pinEditMemory: store.pinEditMemory,
  };
}
