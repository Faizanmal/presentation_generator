export type EditorTool =
  | "select"
  | "text"
  | "image"
  | "shape"
  | "chart"
  | "comment"
  | "ai"
  | "laser";

export type EditorBlockType = "heading" | "paragraph" | "image" | "stat" | "quote" | "chart";

export type PresentationTransition = "fade" | "slide" | "zoom" | "cinematic";

export interface BlockFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface EditorBlock {
  id: string;
  type: EditorBlockType;
  frame: BlockFrame;
  locked?: boolean;
  /** Layout zone from DSL (multi-column / media) */
  zone?: number;
  content: {
    text?: string;
    url?: string;
    alt?: string;
    statValue?: string;
    statLabel?: string;
    quoteAuthor?: string;
  };
}

export interface EditorSlide {
  id: string;
  title: string;
  notes: string;
  order: number;
  transition: PresentationTransition;
  durationMs: number;
  /** DSL layout preset when available */
  layoutPreset?: string;
  blocks: EditorBlock[];
}

export interface EditorTheme {
  id: string;
  name: string;
  palette: {
    bg: string;
    surface: string;
    text: string;
    accent: string;
    accentSoft: string;
  };
  typography: {
    heading: string;
    body: string;
  };
}

export interface EditorDocument {
  id: string;
  title: string;
  subtitle: string;
  updatedAt: string;
  theme: EditorTheme;
  slides: EditorSlide[];
}

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

export interface SelectionState {
  slideId: string | null;
  blockId: string | null;
}

export type AIGenerationPhase =
  | "idle"
  | "briefing"
  | "research"
  | "writing"
  | "layouting"
  | "styling"
  | "completed"
  | "error";

export interface AISuggestion {
  id: string;
  title: string;
  rationale: string;
  actionLabel: string;
  type: "content" | "layout" | "tone" | "design";
}

export interface AIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface AIGenerationState {
  phase: AIGenerationPhase;
  progress: number;
  streamText: string;
  messages: AIMessage[];
  suggestions: AISuggestion[];
  isOpen: boolean;
}

export interface CommandDefinition {
  id: string;
  group: "Global" | "Insert" | "AI" | "Navigation" | "View";
  label: string;
  keywords: string[];
  shortcut?: string;
  run: () => void;
}

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
  avatar: string;
  cursor: { x: number; y: number; slideId: string | null };
  isTyping: boolean;
  activeTool: EditorTool;
}

export interface EditorComment {
  id: string;
  authorName: string;
  authorColor: string;
  slideId: string;
  blockId?: string;
  content: string;
  createdAt: string;
  resolved: boolean;
}

export interface PresentationPlaybackState {
  isFullscreen: boolean;
  isPresenterMode: boolean;
  showNotes: boolean;
  laserEnabled: boolean;
  currentSlideIndex: number;
}

export interface SlideLayoutBlueprint {
  titleArea: BlockFrame;
  bodyArea: BlockFrame;
  mediaArea: BlockFrame;
}

export interface LayoutScore {
  whitespace: number;
  hierarchy: number;
  visualBalance: number;
  overall: number;
}

