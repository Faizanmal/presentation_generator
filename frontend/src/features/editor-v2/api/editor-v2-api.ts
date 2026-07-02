import { api } from "@/lib/api";
import type { Block, Project } from "@/types";
import { DEFAULT_THEME } from "../constants/editor";
import type { EditorBlock, EditorBlockType, EditorDocument, EditorSlide } from "../types";

const mapBlockType = (type: string): EditorBlockType => {
  switch (type.toUpperCase()) {
    case "HEADING":
      return "heading";
    case "IMAGE":
      return "image";
    case "QUOTE":
      return "quote";
    case "CHART":
      return "chart";
    case "STATS_GRID":
      return "stat";
    default:
      return "paragraph";
  }
};

const toEditorBlock = (block: Block): EditorBlock => {
  const style = block.style ?? {};

  return {
    id: block.id,
    type: mapBlockType(block.type),
    frame: {
      x: typeof style.x === "number" ? style.x : 80,
      y: typeof style.y === "number" ? style.y : 80,
      width: typeof style.width === "number" ? style.width : 520,
      height: typeof style.height === "number" ? style.height : 160,
      rotation: typeof style.rotation === "number" ? style.rotation : 0,
    },
    locked: Boolean(style.locked),
    content: {
      text: typeof block.content.text === "string" ? block.content.text : "",
      url: typeof block.content.url === "string" ? block.content.url : undefined,
      alt: typeof block.content.alt === "string" ? block.content.alt : undefined,
    },
  };
};

const toEditorSlide = (slide: Project["slides"][number]): EditorSlide => ({
  id: slide.id,
  title: slide.title ?? "Untitled Slide",
  notes: slide.speakerNotes ?? "",
  order: slide.order,
  transition: slide.transition === "zoom" ? "zoom" : "fade",
  durationMs: 6000,
  blocks: (slide.blocks ?? []).map(toEditorBlock),
});

export const editorV2Api = {
  async loadProject(projectId: string): Promise<EditorDocument> {
    const project = await api.projects.getById(projectId);

    return {
      id: project.id,
      title: project.title,
      subtitle: project.description ?? "AI-crafted narrative",
      updatedAt: project.updatedAt,
      theme: project.theme
        ? {
            id: project.theme.id,
            name: project.theme.name,
            palette: {
              bg: project.theme.colors.background,
              surface: project.theme.colors.surface,
              text: project.theme.colors.text,
              accent: project.theme.colors.accent,
              accentSoft: project.theme.colors.secondary,
            },
            typography: {
              heading: project.theme.fonts.heading,
              body: project.theme.fonts.body,
            },
          }
        : DEFAULT_THEME,
      slides: (project.slides ?? []).sort((a, b) => a.order - b.order).map(toEditorSlide),
    };
  },

  async saveTitle(projectId: string, title: string): Promise<void> {
    await api.projects.update(projectId, { title });
  },

  async saveBlock(projectId: string, slideId: string, block: EditorBlock): Promise<void> {
    await api.blocks.update(projectId, slideId, block.id, {
      content: {
        text: block.content.text,
        url: block.content.url,
        alt: block.content.alt,
      },
      style: {
        x: Math.round(block.frame.x),
        y: Math.round(block.frame.y),
        width: Math.round(block.frame.width),
        height: Math.round(block.frame.height),
        rotation: Math.round(block.frame.rotation),
        locked: block.locked,
      },
    });
  },

  async addSlide(projectId: string, order: number): Promise<EditorSlide> {
    const slide = await api.slides.create(projectId, {
      title: `Slide ${order + 1}`,
      order,
      layout: "AUTO",
    });

    return {
      id: slide.id,
      title: slide.title ?? `Slide ${order + 1}`,
      notes: slide.speakerNotes ?? "",
      order: slide.order,
      transition: "fade",
      durationMs: 6000,
      blocks: [],
    };
  },

  async addParagraphBlock(projectId: string, slideId: string, order: number, text: string): Promise<EditorBlock> {
    const block = await api.blocks.create(projectId, slideId, {
      projectId,
      blockType: "PARAGRAPH",
      order,
      content: { text },
      style: {
        x: 120,
        y: 180,
        width: 620,
        height: 180,
      },
    });

    return toEditorBlock(block as Block);
  },
};

