import { create } from "zustand";
import type { AIGenerationPhase, AIGenerationState, AIMessage, AISuggestion } from "../types";

interface AIGenerationStore {
  state: AIGenerationState;
  open: () => void;
  close: () => void;
  setPhase: (phase: AIGenerationPhase, progress?: number) => void;
  appendStream: (chunk: string) => void;
  resetStream: () => void;
  addMessage: (message: AIMessage) => void;
  setSuggestions: (suggestions: AISuggestion[]) => void;
  hydrateDraft: (text: string) => void;
}

const initialState: AIGenerationState = {
  phase: "idle",
  progress: 0,
  streamText: "",
  messages: [],
  suggestions: [],
  isOpen: false,
};

export const useAIGenerationStore = create<AIGenerationStore>()((set) => ({
  state: initialState,

  open: () =>
    set((store) => ({
      state: {
        ...store.state,
        isOpen: true,
      },
    })),

  close: () =>
    set((store) => ({
      state: {
        ...store.state,
        isOpen: false,
      },
    })),

  setPhase: (phase, progress) =>
    set((store) => ({
      state: {
        ...store.state,
        phase,
        progress: progress ?? store.state.progress,
      },
    })),

  appendStream: (chunk) =>
    set((store) => ({
      state: {
        ...store.state,
        streamText: `${store.state.streamText}${chunk}`,
      },
    })),

  resetStream: () =>
    set((store) => ({
      state: {
        ...store.state,
        streamText: "",
        progress: 0,
      },
    })),

  addMessage: (message) =>
    set((store) => ({
      state: {
        ...store.state,
        messages: [...store.state.messages, message],
      },
    })),

  setSuggestions: (suggestions) =>
    set((store) => ({
      state: {
        ...store.state,
        suggestions,
      },
    })),

  hydrateDraft: (text) =>
    set((store) => ({
      state: {
        ...store.state,
        streamText: text,
        phase: "completed",
        progress: 100,
      },
    })),
}));

