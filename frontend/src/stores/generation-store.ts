/**
 * AI Generation Store — Zustand store for managing AI generation state on the frontend.
 * 
 * Tracks:
 * - Generation progress and agent stages
 * - Generated document
 * - Quality report
 * - Edit memory for partial regeneration
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ============================================
// TYPES (mirrors shared/presentation-dsl.ts)
// ============================================

export type GenerationStatus =
  | 'idle'
  | 'researching'
  | 'outlining'
  | 'narrating'
  | 'layouting'
  | 'designing'
  | 'imaging'
  | 'validating'
  | 'complete'
  | 'failed';

export interface GenerationProgress {
  sessionId: string;
  status: GenerationStatus;
  progress: number;
  agent: string;
  message: string;
  timestamp: string;
}

export interface QualityReport {
  overallScore: number;
  passed: boolean;
  issues: Array<{
    severity: 'critical' | 'warning' | 'info';
    slideIndex?: number;
    category: string;
    message: string;
    autoFixable: boolean;
    suggestedFix?: string;
  }>;
  breakdown: {
    contentQuality: number;
    structureFlow: number;
    visualConsistency: number;
    audienceAlignment: number;
    grammarSpelling: number;
    accessibilityScore: number;
  };
}

export interface EditMemoryEntry {
  slideId: string;
  blockId?: string;
  field: string;
  previousValue: string;
  newValue: string;
  timestamp: string;
  pinned: boolean;
}

// ============================================
// STORE
// ============================================

interface GenerationState {
  // Status
  status: GenerationStatus;
  progress: number;
  currentAgent: string | null;
  message: string;
  sessionId: string | null;

  // Result
  generatedDocument: unknown | null; // PresentationDocument
  qualityReport: QualityReport | null;

  // Edit memory
  editMemory: EditMemoryEntry[];

  // Error
  error: string | null;

  // History
  progressHistory: GenerationProgress[];

  // Actions
  startGeneration: (sessionId: string) => void;
  updateProgress: (event: GenerationProgress) => void;
  setResult: (document: unknown, quality: QualityReport) => void;
  setError: (error: string) => void;
  reset: () => void;
  addEditMemory: (entry: EditMemoryEntry) => void;
  removeEditMemory: (slideId: string, field: string) => void;
  pinEditMemory: (slideId: string, field: string) => void;
}

const INITIAL_STATE = {
  status: 'idle' as GenerationStatus,
  progress: 0,
  currentAgent: null as string | null,
  message: '',
  sessionId: null as string | null,
  generatedDocument: null,
  qualityReport: null,
  editMemory: [] as EditMemoryEntry[],
  error: null as string | null,
  progressHistory: [] as GenerationProgress[],
};

export const useGenerationStore = create<GenerationState>()(
  devtools(
    (set, get) => ({
      ...INITIAL_STATE,

      startGeneration: (sessionId: string) => {
        set({
          ...INITIAL_STATE,
          status: 'researching',
          sessionId,
          editMemory: get().editMemory, // preserve edit memory across generations
        });
      },

      updateProgress: (event: GenerationProgress) => {
        set({
          status: event.status,
          progress: event.progress,
          currentAgent: event.agent,
          message: event.message,
          progressHistory: [...get().progressHistory, event],
        });
      },

      setResult: (document: unknown, quality: QualityReport) => {
        set({
          status: 'complete',
          progress: 100,
          generatedDocument: document,
          qualityReport: quality,
          currentAgent: null,
          message: `Complete! Quality: ${quality.overallScore}/100`,
        });
      },

      setError: (error: string) => {
        set({
          status: 'failed',
          error,
          currentAgent: null,
          message: `Error: ${error}`,
        });
      },

      reset: () => {
        set(INITIAL_STATE);
      },

      addEditMemory: (entry: EditMemoryEntry) => {
        const existing = get().editMemory;
        const filtered = existing.filter(
          (e) => !(e.slideId === entry.slideId && e.field === entry.field),
        );
        set({ editMemory: [...filtered, entry] });
      },

      removeEditMemory: (slideId: string, field: string) => {
        set({
          editMemory: get().editMemory.filter(
            (e) => !(e.slideId === slideId && e.field === field),
          ),
        });
      },

      pinEditMemory: (slideId: string, field: string) => {
        set({
          editMemory: get().editMemory.map((e) =>
            e.slideId === slideId && e.field === field
              ? { ...e, pinned: !e.pinned }
              : e,
          ),
        });
      },
    }),
    { name: 'generation-store' },
  ),
);

// ============================================
// AGENT STAGE LABELS (for UI)
// ============================================

export const AGENT_LABELS: Record<GenerationStatus, { label: string; icon: string; color: string }> = {
  idle: { label: 'Ready', icon: '⏸️', color: '#94A3B8' },
  researching: { label: 'Researching', icon: '🔍', color: '#3B82F6' },
  outlining: { label: 'Structuring', icon: '📋', color: '#8B5CF6' },
  narrating: { label: 'Writing Content', icon: '✍️', color: '#F59E0B' },
  layouting: { label: 'Designing Layouts', icon: '📐', color: '#10B981' },
  designing: { label: 'Creating Theme', icon: '🎨', color: '#EC4899' },
  imaging: { label: 'Generating Images', icon: '🖼️', color: '#6366F1' },
  validating: { label: 'Quality Check', icon: '✅', color: '#14B8A6' },
  complete: { label: 'Complete!', icon: '🎉', color: '#22C55E' },
  failed: { label: 'Failed', icon: '❌', color: '#EF4444' },
};
