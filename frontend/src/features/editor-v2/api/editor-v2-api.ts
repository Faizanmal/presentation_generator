import { api } from "@/lib/api";
import type { Block, Project } from "@/types";
import { DEFAULT_THEME, EDITOR_LIMITS } from "../constants/editor";
import { buildLayoutBlueprint, computeBalancedFrames } from "../lib/slide-design-engine";
import type { EditorBlock, EditorBlockType, EditorDocument, EditorSlide } from "../types";

type DslBlock = {
  id: string;
  kind: string;
  pinned?: boolean;
  zone?: number;
  content?: {
    text?: string;
    url?: string;
    alt?: string;
    value?: string | number;
    label?: string;
  };
  style?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    zone?: number;
  };
};

type DslSlide = {
  id: string;
  order: number;
  speakerNotes?: string;
  blocks: DslBlock[];
  transition?: { type?: string };
  layout?: {
    preset?: string;
    zones?: number;
    density?: string;
    padding?: { top?: number; right?: number; bottom?: number; left?: number };
  };
};

type DslDocument = {
  id: string;
  title: string;
  subtitle?: string;
  updatedAt?: string;
  editMemory?: unknown[];
  theme?: {
    id?: string;
    name?: string;
    colors?: {
      background?: string;
      surface?: string;
      text?: string;
      accent?: string;
      secondary?: string;
      primary?: string;
    };
    typography?: {
      headingFont?: string;
      bodyFont?: string;
    };
  };
  sections: Array<{ slides: DslSlide[] }>;
};

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
    case "STATISTIC":
    case "STAT":
      return "stat";
    default:
      return "paragraph";
  }
};

const mapDslKind = (kind: string): EditorBlockType => {
  switch (kind) {
    case "heading":
    case "subheading":
      return "heading";
    case "image":
      return "image";
    case "quote":
      return "quote";
    case "chart":
      return "chart";
    case "statistic":
      return "stat";
    default:
      return "paragraph";
  }
};

const hasAbsoluteFrame = (style?: DslBlock["style"]) =>
  typeof style?.x === "number" && typeof style?.y === "number";

const toEditorBlock = (block: Block): EditorBlock => {
  const style = block.style ?? {};
  const zone =
    typeof block.zone === "number"
      ? block.zone
      : typeof style.zone === "number"
        ? style.zone
        : undefined;

  return {
    id: block.id,
    type: mapBlockType(block.type),
    zone,
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

const dslBlockToEditor = (block: DslBlock, index: number): EditorBlock => {
  const text =
    block.content?.text ||
    (block.content?.value != null
      ? `${block.content.value}${block.content.label ? ` — ${block.content.label}` : ""}`
      : "");

  const zone =
    typeof block.zone === "number"
      ? block.zone
      : typeof block.style?.zone === "number"
        ? block.style.zone
        : undefined;

  return {
    id: block.id,
    type: mapDslKind(block.kind),
    zone,
    frame: {
      x: block.style?.x ?? 80,
      y: block.style?.y ?? 80 + index * 40,
      width: block.style?.width ?? 520,
      height: block.style?.height ?? 140,
      rotation: block.style?.rotation ?? 0,
    },
    locked: Boolean(block.pinned),
    content: {
      text,
      url: block.content?.url,
      alt: block.content?.alt,
      statValue:
        block.kind === "statistic" && block.content?.value != null
          ? String(block.content.value)
          : undefined,
      statLabel:
        block.kind === "statistic" ? block.content?.label : undefined,
    },
  };
};

/** Apply professional frame placement when blocks lack absolute coords */
const applyBalancedLayout = (slide: EditorSlide): EditorSlide => {
  const looksStacked =
    slide.blocks.length === 0 ||
    slide.blocks.every((b, i) => b.frame.x === 80 && b.frame.y === 80 + i * 40) ||
    slide.blocks.every((b) => b.frame.x === 80 && b.frame.y === 80);

  if (!looksStacked) {return slide;}

  const blueprint = buildLayoutBlueprint(
    EDITOR_LIMITS.canvasWidth,
    EDITOR_LIMITS.canvasHeight,
    slide.layoutPreset,
  );
  const frames = computeBalancedFrames(slide.blocks, blueprint, slide.layoutPreset);
  return {
    ...slide,
    blocks: slide.blocks.map((block) => ({
      ...block,
      frame: frames[block.id] ?? block.frame,
    })),
  };
};

const toEditorSlide = (slide: Project["slides"][number]): EditorSlide => {
  const mapped: EditorSlide = {
    id: slide.id,
    title: slide.title ?? "Untitled Slide",
    notes: slide.speakerNotes ?? "",
    order: slide.order,
    transition: slide.transition === "zoom" ? "zoom" : "fade",
    durationMs: 6000,
    layoutPreset: slide.layout,
    blocks: (slide.blocks ?? []).map(toEditorBlock),
  };
  return applyBalancedLayout(mapped);
};

const dslToEditorDocument = (project: Project, dsl: DslDocument): EditorDocument => {
  const slides = dsl.sections
    .flatMap((section) => section.slides)
    .sort((a, b) => a.order - b.order)
    .map((slide) => {
      const hasAbsolute = slide.blocks.some((b) => hasAbsoluteFrame(b.style));
      const mapped: EditorSlide = {
        id: slide.id,
        title:
          slide.blocks.find((b) => b.kind === "heading")?.content?.text ||
          `Slide ${slide.order + 1}`,
        notes: slide.speakerNotes ?? "",
        order: slide.order,
        transition: slide.transition?.type === "zoom" ? ("zoom" as const) : ("fade" as const),
        durationMs: 6000,
        layoutPreset: slide.layout?.preset,
        blocks: slide.blocks.map(dslBlockToEditor),
      };
      return hasAbsolute ? mapped : applyBalancedLayout(mapped);
    });

  return {
    id: project.id,
    title: dsl.title || project.title,
    subtitle: dsl.subtitle || project.description || "AI-crafted narrative",
    updatedAt: dsl.updatedAt || project.updatedAt,
    theme: dsl.theme
      ? {
          id: dsl.theme.id || "dsl-theme",
          name: dsl.theme.name || "Generated",
          palette: {
            bg: dsl.theme.colors?.background || DEFAULT_THEME.palette.bg,
            surface: dsl.theme.colors?.surface || DEFAULT_THEME.palette.surface,
            text: dsl.theme.colors?.text || DEFAULT_THEME.palette.text,
            accent:
              dsl.theme.colors?.primary ||
              dsl.theme.colors?.accent ||
              DEFAULT_THEME.palette.accent,
            accentSoft:
              dsl.theme.colors?.secondary || DEFAULT_THEME.palette.accentSoft,
          },
          typography: {
            heading:
              dsl.theme.typography?.headingFont || DEFAULT_THEME.typography.heading,
            body: dsl.theme.typography?.bodyFont || DEFAULT_THEME.typography.body,
          },
        }
      : project.theme
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
    slides,
  };
};

export const editorV2Api = {
  async loadProject(projectId: string): Promise<EditorDocument> {
    const project = await api.projects.getById(projectId);
    const dsl = project.dslDocument as DslDocument | null | undefined;

    if (dsl?.sections?.length) {
      return dslToEditorDocument(project, dsl);
    }

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

  async getDslDocument(projectId: string): Promise<DslDocument | null> {
    const { data } = await api.get<{
      projectId: string;
      dslDocument: DslDocument | null;
    }>(`/projects/${projectId}/dsl`);
    return data.dslDocument;
  },

  async saveDslDocument(projectId: string, dslDocument: unknown): Promise<void> {
    await api.patch(`/projects/${projectId}/dsl`, { dslDocument });
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
