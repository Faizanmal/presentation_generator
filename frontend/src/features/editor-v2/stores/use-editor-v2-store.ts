import { create } from "zustand";
import { EDITOR_LIMITS } from "../constants/editor";
import type {
  EditorBlock,
  EditorDocument,
  EditorSlide,
  EditorTool,
  PresentationPlaybackState,
  SelectionState,
  ViewportState,
} from "../types";

interface EditorV2State {
  document: EditorDocument | null;
  activeSlideId: string | null;
  selection: SelectionState;
  tool: EditorTool;
  viewport: ViewportState;
  showLeftRail: boolean;
  showRightRail: boolean;
  playback: PresentationPlaybackState;

  loadDocument: (document: EditorDocument) => void;
  setTool: (tool: EditorTool) => void;
  setActiveSlide: (slideId: string) => void;
  selectBlock: (slideId: string, blockId: string | null) => void;
  setViewport: (partial: Partial<ViewportState>) => void;
  zoomBy: (delta: number) => void;
  panBy: (deltaX: number, deltaY: number) => void;
  toggleLeftRail: () => void;
  toggleRightRail: () => void;

  updateTitle: (title: string) => void;
  addSlide: (slide: EditorSlide) => void;
  reorderSlides: (slideIds: string[]) => void;
  updateBlockContent: (slideId: string, blockId: string, text: string) => void;
  updateBlockFrame: (slideId: string, blockId: string, frame: Partial<EditorBlock["frame"]>) => void;
  addBlock: (slideId: string, block: EditorBlock) => void;

  setPresenterMode: (enabled: boolean) => void;
  setFullscreen: (enabled: boolean) => void;
  setShowNotes: (enabled: boolean) => void;
  setLaserEnabled: (enabled: boolean) => void;
  setPlaybackSlide: (index: number) => void;
}

const clampZoom = (zoom: number): number =>
  Math.min(EDITOR_LIMITS.maxZoom, Math.max(EDITOR_LIMITS.minZoom, zoom));

const updateSlide = (
  slides: EditorSlide[],
  slideId: string,
  updater: (slide: EditorSlide) => EditorSlide,
): EditorSlide[] => slides.map((slide) => (slide.id === slideId ? updater(slide) : slide));

export const useEditorV2Store = create<EditorV2State>()((set) => ({
  document: null,
  activeSlideId: null,
  selection: { slideId: null, blockId: null },
  tool: "select",
  viewport: {
    zoom: EDITOR_LIMITS.defaultZoom,
    panX: 0,
    panY: 0,
  },
  showLeftRail: true,
  showRightRail: true,
  playback: {
    isFullscreen: false,
    isPresenterMode: false,
    showNotes: false,
    laserEnabled: false,
    currentSlideIndex: 0,
  },

  loadDocument: (document) =>
    set(() => ({
      document,
      activeSlideId: document.slides[0]?.id ?? null,
      selection: { slideId: document.slides[0]?.id ?? null, blockId: null },
      viewport: {
        zoom: EDITOR_LIMITS.defaultZoom,
        panX: 0,
        panY: 0,
      },
      playback: {
        isFullscreen: false,
        isPresenterMode: false,
        showNotes: false,
        laserEnabled: false,
        currentSlideIndex: 0,
      },
    })),

  setTool: (tool) => set(() => ({ tool })),

  setActiveSlide: (slideId) =>
    set((state) => ({
      activeSlideId: slideId,
      selection: { slideId, blockId: state.selection.slideId === slideId ? state.selection.blockId : null },
    })),

  selectBlock: (slideId, blockId) =>
    set(() => ({
      selection: { slideId, blockId },
      activeSlideId: slideId,
    })),

  setViewport: (partial) =>
    set((state) => ({
      viewport: {
        zoom: clampZoom(partial.zoom ?? state.viewport.zoom),
        panX: partial.panX ?? state.viewport.panX,
        panY: partial.panY ?? state.viewport.panY,
      },
    })),

  zoomBy: (delta) =>
    set((state) => ({
      viewport: {
        ...state.viewport,
        zoom: clampZoom(state.viewport.zoom + delta),
      },
    })),

  panBy: (deltaX, deltaY) =>
    set((state) => ({
      viewport: {
        ...state.viewport,
        panX: state.viewport.panX + deltaX,
        panY: state.viewport.panY + deltaY,
      },
    })),

  toggleLeftRail: () => set((state) => ({ showLeftRail: !state.showLeftRail })),
  toggleRightRail: () => set((state) => ({ showRightRail: !state.showRightRail })),

  updateTitle: (title) =>
    set((state) => {
      if (!state.document) {
        return state;
      }

      return {
        document: {
          ...state.document,
          title,
          updatedAt: new Date().toISOString(),
        },
      };
    }),

  addSlide: (slide) =>
    set((state) => {
      if (!state.document) {
        return state;
      }

      const slides = [...state.document.slides, slide].sort((a, b) => a.order - b.order);
      return {
        document: {
          ...state.document,
          slides,
          updatedAt: new Date().toISOString(),
        },
        activeSlideId: slide.id,
        selection: { slideId: slide.id, blockId: null },
      };
    }),

  reorderSlides: (slideIds) =>
    set((state) => {
      if (!state.document) {
        return state;
      }

      const lookup = new Map(state.document.slides.map((slide) => [slide.id, slide]));
      const reordered = slideIds
        .map((slideId, order) => {
          const slide = lookup.get(slideId);
          if (!slide) {
            return null;
          }

          return { ...slide, order };
        })
        .filter((slide): slide is EditorSlide => Boolean(slide));

      if (reordered.length !== state.document.slides.length) {
        return state;
      }

      return {
        document: {
          ...state.document,
          slides: reordered,
          updatedAt: new Date().toISOString(),
        },
      };
    }),

  updateBlockContent: (slideId, blockId, text) =>
    set((state) => {
      if (!state.document) {
        return state;
      }

      return {
        document: {
          ...state.document,
          slides: updateSlide(state.document.slides, slideId, (slide) => ({
            ...slide,
            blocks: slide.blocks.map((block) =>
              block.id === blockId ? { ...block, content: { ...block.content, text } } : block,
            ),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    }),

  updateBlockFrame: (slideId, blockId, frame) =>
    set((state) => {
      if (!state.document) {
        return state;
      }

      return {
        document: {
          ...state.document,
          slides: updateSlide(state.document.slides, slideId, (slide) => ({
            ...slide,
            blocks: slide.blocks.map((block) =>
              block.id === blockId
                ? {
                    ...block,
                    frame: {
                      ...block.frame,
                      ...frame,
                    },
                  }
                : block,
            ),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    }),

  addBlock: (slideId, block) =>
    set((state) => {
      if (!state.document) {
        return state;
      }

      return {
        document: {
          ...state.document,
          slides: updateSlide(state.document.slides, slideId, (slide) => ({
            ...slide,
            blocks: [...slide.blocks, block],
          })),
          updatedAt: new Date().toISOString(),
        },
        selection: {
          slideId,
          blockId: block.id,
        },
      };
    }),

  setPresenterMode: (enabled) =>
    set((state) => ({
      playback: {
        ...state.playback,
        isPresenterMode: enabled,
      },
    })),

  setFullscreen: (enabled) =>
    set((state) => ({
      playback: {
        ...state.playback,
        isFullscreen: enabled,
      },
    })),

  setShowNotes: (enabled) =>
    set((state) => ({
      playback: {
        ...state.playback,
        showNotes: enabled,
      },
    })),

  setLaserEnabled: (enabled) =>
    set((state) => ({
      playback: {
        ...state.playback,
        laserEnabled: enabled,
      },
    })),

  setPlaybackSlide: (index) =>
    set((state) => {
      const slidesLength = state.document?.slides.length ?? 0;
      if (slidesLength === 0) {
        return state;
      }

      return {
        playback: {
          ...state.playback,
          currentSlideIndex: Math.min(slidesLength - 1, Math.max(0, index)),
        },
      };
    }),
}));

export const getActiveSlide = (): EditorSlide | null => {
  const state = useEditorV2Store.getState();
  if (!state.document || !state.activeSlideId) {
    return null;
  }

  return state.document.slides.find((slide) => slide.id === state.activeSlideId) ?? null;
};

export const getSelectedBlock = (): EditorBlock | null => {
  const state = useEditorV2Store.getState();
  if (!state.document || !state.selection.slideId || !state.selection.blockId) {
    return null;
  }

  const slide = state.document.slides.find((item) => item.id === state.selection.slideId);
  if (!slide) {
    return null;
  }

  return slide.blocks.find((item) => item.id === state.selection.blockId) ?? null;
};

