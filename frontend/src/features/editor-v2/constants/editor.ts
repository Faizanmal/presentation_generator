import type { EditorTheme } from "../types";

/* ═══════════════════════════════════════════════════════════════════════
   Editor Constants — Premium Presentation Designer
   ═══════════════════════════════════════════════════════════════════════ */

// ── Default Theme ──────────────────────────────────────────────────
export const DEFAULT_THEME: EditorTheme = {
  id: "cinema-slate",
  name: "Cinema Slate",
  palette: {
    bg: "var(--pd-sys-bg-canvas)",
    surface: "var(--pd-sys-bg-elevated)",
    text: "var(--pd-sys-text-primary)",
    accent: "var(--pd-sys-accent)",
    accentSoft: "var(--pd-sys-accent-soft)",
  },
  typography: {
    heading: "var(--font-space-grotesk)",
    body: "var(--font-dm-sans)",
  },
};

// ── Editor Limits & Viewport Constraints ───────────────────────────
export const EDITOR_LIMITS = {
  minZoom: 0.25,
  maxZoom: 3.0,
  defaultZoom: 0.88,
  zoomStep: 0.08,
  canvasWidth: 1600,
  canvasHeight: 900,
  canvasAspectRatio: 16 / 9,
  snapGridSize: 8,
  snapThreshold: 6,
  maxBlocksPerSlide: 64,
  maxSlidesPerDeck: 200,
  autosaveDelayMs: 1500,
  titlePersistDelayMs: 700,
} as const;

// ── Keyboard Shortcut Documentation ────────────────────────────────
export const PRESENTATION_SHORTCUT_HINTS = [
  "Cmd/Ctrl + K",
  "Space",
  "G",
  "Shift + A",
  "Alt + 1",
] as const;

export const SHORTCUT_MAP = {
  commandPalette: { key: "k", mod: true, label: "⌘K" },
  present: { key: "Space", mod: false, label: "Space" },
  aiCompose: { key: "a", shift: true, label: "⇧A" },
  addSlide: { key: "n", alt: true, label: "⌥N" },
  zoomIn: { key: "=", mod: true, label: "⌘+" },
  zoomOut: { key: "-", mod: true, label: "⌘−" },
  zoomReset: { key: "0", mod: true, label: "⌘0" },
  undo: { key: "z", mod: true, label: "⌘Z" },
  redo: { key: "z", mod: true, shift: true, label: "⌘⇧Z" },
  delete: { key: "Backspace", label: "⌫" },
  duplicate: { key: "d", mod: true, label: "⌘D" },
  selectAll: { key: "a", mod: true, label: "⌘A" },
  escape: { key: "Escape", label: "Esc" },
  toggleLeftRail: { key: "[", mod: true, label: "⌘[" },
  toggleRightRail: { key: "]", mod: true, label: "⌘]" },
  save: { key: "s", mod: true, label: "⌘S" },
  nextSlide: { key: "ArrowRight", label: "→" },
  prevSlide: { key: "ArrowLeft", label: "←" },
} as const;

// ── AI Phase Labels ────────────────────────────────────────────────
export const AI_PHASE_LABELS = {
  idle: "Ready",
  briefing: "Analyzing brief",
  research: "Collecting structure",
  writing: "Writing key points",
  layouting: "Balancing layout",
  styling: "Styling visuals",
  completed: "Draft ready",
  error: "Generation interrupted",
} as const;

export const AI_PHASE_ICONS = {
  idle: "sparkles",
  briefing: "scan",
  research: "search",
  writing: "pen-tool",
  layouting: "layout",
  styling: "palette",
  completed: "check-circle",
  error: "alert-triangle",
} as const;

// ── Block Type Configuration ───────────────────────────────────────
export const BLOCK_TYPE_CONFIG = {
  heading: {
    label: "Heading",
    icon: "type",
    defaultWidth: 920,
    defaultHeight: 132,
    defaultY: 96,
    fontClass: "font-display text-[2.1rem] font-semibold leading-[1.04]",
    placeholder: "Compelling section title",
  },
  paragraph: {
    label: "Paragraph",
    icon: "pilcrow",
    defaultWidth: 640,
    defaultHeight: 180,
    defaultY: 300,
    fontClass: "text-base leading-relaxed",
    placeholder: "Add the supporting narrative and key proof points.",
  },
  image: {
    label: "Image",
    icon: "image",
    defaultWidth: 640,
    defaultHeight: 320,
    defaultY: 300,
    fontClass: "",
    placeholder: "",
  },
  stat: {
    label: "Statistic",
    icon: "hash",
    defaultWidth: 320,
    defaultHeight: 200,
    defaultY: 320,
    fontClass: "font-display text-5xl font-bold",
    placeholder: "42%",
  },
  quote: {
    label: "Quote",
    icon: "quote",
    defaultWidth: 720,
    defaultHeight: 200,
    defaultY: 300,
    fontClass: "font-editorial text-2xl italic leading-relaxed",
    placeholder: "Add an impactful quote here.",
  },
  chart: {
    label: "Chart",
    icon: "bar-chart-3",
    defaultWidth: 640,
    defaultHeight: 360,
    defaultY: 300,
    fontClass: "",
    placeholder: "",
  },
} as const;

// ── Slide Transition Options ───────────────────────────────────────
export const SLIDE_TRANSITIONS = [
  { id: "fade", label: "Fade", icon: "layers" },
  { id: "slide", label: "Slide", icon: "arrow-right" },
  { id: "zoom", label: "Zoom", icon: "maximize-2" },
  { id: "cinematic", label: "Cinematic", icon: "film" },
] as const;

// ── Presence Colors (for multiplayer cursors) ──────────────────────
export const PRESENCE_COLORS = [
  "oklch(0.74 0.18 252)",  // Blue
  "oklch(0.74 0.15 164)",  // Green
  "oklch(0.72 0.14 28)",   // Coral
  "oklch(0.72 0.18 295)",  // Violet
  "oklch(0.8 0.13 85)",    // Amber
  "oklch(0.7 0.16 330)",   // Pink
  "oklch(0.76 0.14 200)",  // Teal
  "oklch(0.7 0.16 120)",   // Lime
] as const;
