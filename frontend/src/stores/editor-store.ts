import { create } from 'zustand';
import type { Project, Slide, Block, Theme } from '@/types';

interface EditorState {
  // Project state
  project: Project | null;
  currentSlideIndex: number;
  isDirty: boolean;

  // Actions - Project
  loadProject: (project: Project) => void;
  updateProject: (data: Partial<Project>) => void;
  setCurrentSlideIndex: (index: number) => void;
  setTheme: (theme: Theme) => void;

  // Actions - Slides
  addSlide: (slide: Slide) => void;
  updateSlide: (slideId: string, data: Partial<Slide>) => void;
  deleteSlide: (slideId: string) => void;
  duplicateSlide: (slideId: string) => void;
  reorderSlides: (fromIndex: number, toIndex: number) => void;

  // Actions - Blocks
  addBlock: (slideId: string, block: Block) => void;
  updateBlock: (slideId: string, blockId: string, data: Partial<Block>) => void;
  deleteBlock: (slideId: string, blockId: string) => void;
  reorderBlocks: (slideId: string, fromIndex: number, toIndex: number) => void;

  // Actions - Reset
  reset: () => void;
}

// Debounce save timeout
let saveTimeout: NodeJS.Timeout | null = null;

export const useEditorStore = create<EditorState>()((set, get) => ({
  project: null,
  currentSlideIndex: 0,
  isDirty: false,

  loadProject: (project: Project) => {
    set({
      project,
      currentSlideIndex: 0,
      isDirty: false,
    });
  },

  updateProject: (data: Partial<Project>) => {
    const { project } = get();
    if (!project) { return; }

    set({
      project: { ...project, ...data },
      isDirty: true,
    });

    // Auto-save after 2 seconds
    if (saveTimeout) { clearTimeout(saveTimeout); }
    saveTimeout = setTimeout(() => {
      set({ isDirty: false });
    }, 2000);
  },

  setCurrentSlideIndex: (index: number) => {
    set({ currentSlideIndex: index });
  },

  setTheme: (theme: Theme) => {
    const { project } = get();
    if (!project) { return; }

    set({
      project: { ...project, theme, themeId: theme.id },
      isDirty: true,
    });
  },

  addSlide: (slide: Slide) => {
    const { project } = get();
    if (!project) { return; }

    const updatedSlides = [...(project.slides || []), slide].sort(
      (a, b) => a.order - b.order
    );

    set({
      project: { ...project, slides: updatedSlides },
      isDirty: true,
    });
  },

  updateSlide: (slideId: string, data: Partial<Slide>) => {
    const { project } = get();
    if (!project || !project.slides) { return; }

    const updatedSlides = project.slides.map((s) =>
      s.id === slideId ? { ...s, ...data } : s
    );

    set({
      project: { ...project, slides: updatedSlides },
      isDirty: true,
    });
  },


  deleteSlide: (slideId: string) => {
    const { project, currentSlideIndex } = get();
    if (!project) { return; }

    const slideIndex = project.slides?.findIndex((s) => s.id === slideId) ?? -1;
    const updatedSlides = project.slides?.filter((s) => s.id !== slideId) || [];

    // Adjust current slide index if needed
    let newIndex = currentSlideIndex;
    if (slideIndex <= currentSlideIndex && currentSlideIndex > 0) {
      newIndex = currentSlideIndex - 1;
    }
    if (newIndex >= updatedSlides.length) {
      newIndex = Math.max(0, updatedSlides.length - 1);
    }

    set({
      project: { ...project, slides: updatedSlides },
      currentSlideIndex: newIndex,
      isDirty: true,
    });
  },

  duplicateSlide: (slideId: string) => {
    const { project } = get();
    if (!project) { return; }

    const slideIndex = project.slides?.findIndex((s) => s.id === slideId) ?? -1;
    if (slideIndex === -1) { return; }

    const slideToDuplicate = project.slides?.[slideIndex];
    if (!slideToDuplicate) { return; }
    const newSlide: Slide = {
      ...slideToDuplicate,
      id: `${slideId}-copy-${Date.now()}`,
      title: `${slideToDuplicate.title} (copy)`,
      order: slideToDuplicate.order + 0.5,
    };

    const updatedSlides = [...(project.slides || []), newSlide]
      .sort((a, b) => a.order - b.order)
      .map((s, i) => ({ ...s, order: i }));

    set({
      project: { ...project, slides: updatedSlides },
      isDirty: true,
    });
  },

  reorderSlides: (fromIndex: number, toIndex: number) => {
    const { project } = get();
    if (!project || !project.slides) { return; }

    const slides = [...project.slides];
    const [movedSlide] = slides.splice(fromIndex, 1);
    slides.splice(toIndex, 0, movedSlide);

    const updatedSlides = slides.map((s, i) => ({ ...s, order: i }));

    set({
      project: { ...project, slides: updatedSlides },
      currentSlideIndex: toIndex,
      isDirty: true,
    });
  },

  addBlock: (slideId: string, block: Block) => {
    const { project } = get();
    if (!project) { return; }

    const updatedSlides = project.slides?.map((slide) => {
      if (slide.id !== slideId) { return slide; }
      const updatedBlocks = [...(slide.blocks || []), block].sort(
        (a, b) => a.order - b.order
      );
      return { ...slide, blocks: updatedBlocks };
    });

    set({
      project: { ...project, slides: updatedSlides },
      isDirty: true,
    });
  },

  updateBlock: (slideId: string, blockId: string, data: Partial<Block>) => {
    const { project } = get();
    if (!project) { return; }

    const updatedSlides = project.slides?.map((slide) => {
      if (slide.id !== slideId) { return slide; }
      const updatedBlocks = slide.blocks?.map((block) =>
        block.id === blockId ? { ...block, ...data } : block
      );
      return { ...slide, blocks: updatedBlocks };
    });

    set({
      project: { ...project, slides: updatedSlides },
      isDirty: true,
    });
  },

  deleteBlock: (slideId: string, blockId: string) => {
    const { project } = get();
    if (!project) { return; }

    const updatedSlides = project.slides?.map((slide) => {
      if (slide.id !== slideId) { return slide; }
      const updatedBlocks = slide.blocks?.filter((b) => b.id !== blockId) || [];
      return { ...slide, blocks: updatedBlocks };
    });

    set({
      project: { ...project, slides: updatedSlides },
      isDirty: true,
    });
  },

  reorderBlocks: (slideId: string, fromIndex: number, toIndex: number) => {
    const { project } = get();
    if (!project) { return; }

    const updatedSlides = project.slides?.map((slide) => {
      if (slide.id !== slideId || !slide.blocks) { return slide; }

      const blocks = [...slide.blocks];
      const [movedBlock] = blocks.splice(fromIndex, 1);
      blocks.splice(toIndex, 0, movedBlock);

      const updatedBlocks = blocks.map((b, i) => ({ ...b, order: i }));
      return { ...slide, blocks: updatedBlocks };
    });

    set({
      project: { ...project, slides: updatedSlides },
      isDirty: true,
    });
  },

  reset: () => {
    if (saveTimeout) { clearTimeout(saveTimeout); }
    set({
      project: null,
      currentSlideIndex: 0,
      isDirty: false,
    });
  },
}));
