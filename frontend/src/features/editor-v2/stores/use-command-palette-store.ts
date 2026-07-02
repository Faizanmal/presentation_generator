import { create } from "zustand";

interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  contextSlideId: string | null;
  open: (contextSlideId?: string) => void;
  close: () => void;
  toggle: (contextSlideId?: string) => void;
  setQuery: (query: string) => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>()((set) => ({
  isOpen: false,
  query: "",
  contextSlideId: null,

  open: (contextSlideId) =>
    set(() => ({
      isOpen: true,
      contextSlideId: contextSlideId ?? null,
    })),

  close: () =>
    set(() => ({
      isOpen: false,
      query: "",
      contextSlideId: null,
    })),

  toggle: (contextSlideId) =>
    set((state) => ({
      isOpen: !state.isOpen,
      contextSlideId: contextSlideId ?? state.contextSlideId,
      query: state.isOpen ? "" : state.query,
    })),

  setQuery: (query) => set(() => ({ query })),
}));

