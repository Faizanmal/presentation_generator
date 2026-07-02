/**
 * Presentation DSL (Domain-Specific Language)
 * 
 * The canonical type system for the AI presentation engine.
 * All agents, renderers, and storage layers conform to these interfaces.
 */

// ============================================
// GENERATION STATE MACHINE
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

export interface GenerationState {
  status: GenerationStatus;
  progress: number; // 0-100
  currentAgent: string | null;
  currentSlideIndex: number | null;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  /** Token usage per agent for cost tracking */
  tokenUsage: Record<string, number>;
  /** Which slides have been individually regenerated */
  regeneratedSlides: string[];
}

// ============================================
// PRESENTATION ROOT
// ============================================

export interface PresentationDocument {
  id: string;
  version: number;
  title: string;
  subtitle?: string;
  sections: PresentationSection[];
  theme: PresentationTheme;
  metadata: PresentationMeta;
  generationState: GenerationState;
  /** Edit memory — stores user corrections so regeneration respects them */
  editMemory: EditMemoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface EditMemoryEntry {
  slideId: string;
  blockId?: string;
  field: string;
  previousValue: string;
  newValue: string;
  timestamp: string;
  /** If true, the AI should never override this value */
  pinned: boolean;
}

// ============================================
// SECTIONS & SLIDES
// ============================================

export interface PresentationSection {
  id: string;
  order: number;
  title: string;
  narrativeRole: NarrativeRole;
  slides: PresentationSlide[];
  /** Storytelling arc metadata */
  storybeat?: StoryBeat;
}

export type NarrativeRole =
  | 'hook'
  | 'context'
  | 'problem'
  | 'solution'
  | 'evidence'
  | 'transformation'
  | 'call-to-action'
  | 'recap'
  | 'transition';

export interface StoryBeat {
  emotionalTone: 'curiosity' | 'tension' | 'revelation' | 'inspiration' | 'urgency' | 'confidence';
  energyLevel: number; // 1-10
  keyMessage: string;
  transitionHint?: string;
}

export interface PresentationSlide {
  id: string;
  sectionId: string;
  order: number;
  layout: SlideLayout;
  blocks: SlideBlock[];
  speakerNotes?: string;
  transition: SlideTransition;
  duration?: number; // seconds
  /** AI confidence score for this slide (0-1) */
  aiConfidence: number;
  /** Whether user has manually edited this slide */
  userEdited: boolean;
  /** Thumbnail URL for slide panel */
  thumbnailUrl?: string;
}

// ============================================
// LAYOUTS
// ============================================

export type LayoutPreset =
  | 'title-hero'
  | 'title-subtitle'
  | 'single-column'
  | 'two-column'
  | 'two-column-image'
  | 'three-column'
  | 'image-left'
  | 'image-right'
  | 'image-full'
  | 'stats-grid'
  | 'comparison'
  | 'timeline'
  | 'quote-centered'
  | 'chart-focus'
  | 'bento-grid'
  | 'blank';

export interface SlideLayout {
  preset: LayoutPreset;
  /** Grid template areas for CSS Grid rendering */
  gridTemplate?: string;
  /** Number of content zones */
  zones: number;
  /** Content density: how packed the slide should be */
  density: 'sparse' | 'balanced' | 'dense';
  /** Padding override */
  padding?: LayoutPadding;
}

export interface LayoutPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ============================================
// BLOCKS (Content Units)
// ============================================

export type BlockKind =
  | 'heading'
  | 'subheading'
  | 'paragraph'
  | 'bullet-list'
  | 'numbered-list'
  | 'quote'
  | 'statistic'
  | 'image'
  | 'chart'
  | 'table'
  | 'code'
  | 'embed'
  | 'callout'
  | 'divider'
  | 'spacer'
  | 'icon-row'
  | 'timeline-item'
  | 'comparison-row';

export interface SlideBlock {
  id: string;
  slideId: string;
  kind: BlockKind;
  content: BlockContent;
  style: BlockStyle;
  order: number;
  /** Layout zone this block occupies (for multi-zone layouts) */
  zone?: number;
  /** AI-generated or user-created */
  source: 'ai' | 'user';
  /** Whether this block is pinned (AI won't modify on regeneration) */
  pinned: boolean;
}

export interface BlockContent {
  text?: string;
  html?: string;
  items?: string[];
  url?: string;
  alt?: string;
  caption?: string;
  author?: string;
  label?: string;
  value?: string | number;
  rows?: string[][];
  code?: string;
  language?: string;
  chartData?: ChartConfig;
  embedType?: EmbedType;
  embedUrl?: string;
  iconName?: string;
  /** Raw AI prompt used to generate this content */
  generationPrompt?: string;
}

export type EmbedType = 'youtube' | 'vimeo' | 'figma' | 'miro' | 'twitter' | 'codepen' | 'loom' | 'generic';

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'area' | 'radar' | 'scatter';
  labels: string[];
  datasets: ChartDataset[];
  options?: Record<string, unknown>;
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
}

// ============================================
// BLOCK STYLING
// ============================================

export interface BlockStyle {
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  padding?: string;
  borderRadius?: string;
  border?: string;
  opacity?: number;
  /** Absolute positioning (canvas mode) */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  zIndex?: number;
}

// ============================================
// TRANSITIONS
// ============================================

export interface SlideTransition {
  type: 'none' | 'fade' | 'slide-left' | 'slide-up' | 'zoom' | 'flip' | 'morph';
  duration: number; // ms
  easing?: string;
}

// ============================================
// THEME
// ============================================

export interface PresentationTheme {
  id: string;
  name: string;
  colors: ThemeColorPalette;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  effects: ThemeEffects;
}

export interface ThemeColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  /** Semantic colors for charts/data */
  chart: string[];
}

export interface ThemeTypography {
  headingFont: string;
  bodyFont: string;
  monoFont: string;
  baseSize: number;
  scale: number; // typographic scale ratio (e.g., 1.25)
}

export interface ThemeSpacing {
  base: number; // base unit in px
  scale: number;
}

export interface ThemeEffects {
  borderRadius: string;
  shadow: string;
  glassmorphism: boolean;
  gradientOverlay?: string;
}

// ============================================
// METADATA
// ============================================

export interface PresentationMeta {
  estimatedDuration: number; // minutes
  totalSlides: number;
  keywords: string[];
  summary: string;
  audience: string;
  tone: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  /** AI model/provider that generated this */
  aiModel?: string;
  aiProvider?: string;
  /** Quality score from QA agent */
  qualityScore?: number;
}

// ============================================
// AGENT I/O CONTRACTS
// ============================================

/** Input to the entire generation pipeline */
export interface GenerationRequest {
  topic: string;
  audience?: string;
  tone?: string;
  length?: number;
  style?: 'professional' | 'creative' | 'academic' | 'casual' | 'bold';
  templateType?: 'pitch-deck' | 'training' | 'report' | 'sales' | 'product-launch' | 'case-study' | 'keynote';
  generateImages?: boolean;
  imageSource?: 'ai' | 'stock';
  themeId?: string;
  additionalContext?: string;
  brandGuidelines?: BrandGuidelines;
  /** Quality tier determines iteration count and token budget */
  qualityTier?: 'fast' | 'balanced' | 'premium';
  /** IDs of slides to regenerate (partial regeneration) */
  regenerateSlideIds?: string[];
  /** Edit memory from previous generation */
  editMemory?: EditMemoryEntry[];
  userId: string;
  projectId?: string;
}

export interface BrandGuidelines {
  colors?: string[];
  fonts?: string[];
  tone?: string;
  logos?: string[];
  restrictions?: string[];
}

/** Output from ResearchAgent */
export interface ResearchOutput {
  summary: string;
  keyFacts: string[];
  statistics: StatisticFact[];
  sources: SourceReference[];
  competitorInsights?: string[];
  trendData?: string[];
}

export interface StatisticFact {
  label: string;
  value: string;
  source: string;
  confidence: number;
}

export interface SourceReference {
  title: string;
  url: string;
  snippet: string;
  credibilityScore: number;
}

/** Output from OutlineAgent */
export interface OutlineOutput {
  title: string;
  subtitle?: string;
  sections: SectionOutline[];
  estimatedSlides: number;
  narrativeArc: string;
}

export interface SectionOutline {
  title: string;
  narrativeRole: NarrativeRole;
  keyPoints: string[];
  suggestedSlideCount: number;
  suggestedLayouts: LayoutPreset[];
  dataVisualization?: string;
}

/** Output from NarrativeAgent */
export interface NarrativeOutput {
  sections: NarrativeSection[];
  overallStoryArc: string;
  emotionalJourney: string;
}

export interface NarrativeSection {
  sectionId: string;
  title: string;
  slides: NarrativeSlide[];
  storybeat: StoryBeat;
}

export interface NarrativeSlide {
  heading: string;
  bodyContent: string;
  bulletPoints?: string[];
  speakerNotes: string;
  suggestedVisual?: string;
  calloutText?: string;
  statisticHighlight?: { label: string; value: string };
}

/** Output from LayoutAgent */
export interface LayoutOutput {
  slides: LayoutDecision[];
}

export interface LayoutDecision {
  slideIndex: number;
  layout: SlideLayout;
  blockPlacements: BlockPlacement[];
  /** Score indicating how well this layout fits the content (0-1) */
  fitScore: number;
}

export interface BlockPlacement {
  blockKind: BlockKind;
  zone: number;
  suggestedSize: 'small' | 'medium' | 'large' | 'full';
}

/** Output from DesignAgent */
export interface DesignOutput {
  theme: PresentationTheme;
  slideStyles: SlideDesign[];
}

export interface SlideDesign {
  slideIndex: number;
  backgroundStyle?: string;
  colorOverrides?: Partial<ThemeColorPalette>;
  emphasisBlocks?: number[]; // block indices to visually emphasize
}

/** Output from ImageAgent */
export interface ImageOutput {
  images: GeneratedImage[];
}

export interface GeneratedImage {
  slideIndex: number;
  blockId: string;
  imageUrl: string;
  prompt: string;
  revisedPrompt?: string;
  provider: 'dall-e-3' | 'pollinations' | 'huggingface' | 'replicate' | 'stock';
  width: number;
  height: number;
  style: string;
}

/** Output from QAAgent */
export interface QAOutput {
  overallScore: number; // 0-100
  passed: boolean;
  issues: QAIssue[];
  suggestions: string[];
  breakdown: QABreakdown;
}

export interface QAIssue {
  severity: 'critical' | 'warning' | 'info';
  slideIndex?: number;
  blockId?: string;
  category: 'content' | 'design' | 'structure' | 'accessibility' | 'grammar';
  message: string;
  autoFixable: boolean;
  suggestedFix?: string;
}

export interface QABreakdown {
  contentQuality: number;
  structureFlow: number;
  visualConsistency: number;
  audienceAlignment: number;
  grammarSpelling: number;
  accessibilityScore: number;
}
