/**
 * Adaptive Layout Engine
 * 
 * Deterministic (non-AI) layout computation engine that:
 * - Scores content against layout presets
 * - Balances content density across slides
 * - Computes typography scaling
 * - Manages spacing systems
 * - Handles responsive rendering
 */
import type {
  SlideBlock,
  SlideLayout,
  LayoutPreset,
  BlockKind,
  PresentationTheme,
} from './presentation-dsl';

// ============================================
// LAYOUT DEFINITIONS
// ============================================

interface LayoutDefinition {
  preset: LayoutPreset;
  /** CSS Grid template for this layout */
  gridTemplate: string;
  /** Number of content zones */
  zones: number;
  /** What block kinds work best here */
  idealBlockKinds: BlockKind[];
  /** Ideal number of blocks */
  idealBlockCount: { min: number; max: number };
  /** Supports image? */
  hasImageZone: boolean;
  /** Layout category for rhythm analysis */
  category: 'text-heavy' | 'visual' | 'data' | 'mixed' | 'emphasis';
}

export const LAYOUT_DEFINITIONS: Record<LayoutPreset, LayoutDefinition> = {
  'title-hero': {
    preset: 'title-hero',
    gridTemplate: '"content" 1fr',
    zones: 1,
    idealBlockKinds: ['heading', 'subheading'],
    idealBlockCount: { min: 1, max: 3 },
    hasImageZone: false,
    category: 'emphasis',
  },
  'title-subtitle': {
    preset: 'title-subtitle',
    gridTemplate: '"heading" auto "subtitle" auto',
    zones: 1,
    idealBlockKinds: ['heading', 'subheading', 'paragraph'],
    idealBlockCount: { min: 2, max: 4 },
    hasImageZone: false,
    category: 'emphasis',
  },
  'single-column': {
    preset: 'single-column',
    gridTemplate: '"content" 1fr',
    zones: 1,
    idealBlockKinds: ['heading', 'paragraph', 'bullet-list', 'numbered-list'],
    idealBlockCount: { min: 2, max: 6 },
    hasImageZone: false,
    category: 'text-heavy',
  },
  'two-column': {
    preset: 'two-column',
    gridTemplate: '"left right" 1fr / 1fr 1fr',
    zones: 2,
    idealBlockKinds: ['heading', 'paragraph', 'bullet-list'],
    idealBlockCount: { min: 3, max: 8 },
    hasImageZone: false,
    category: 'mixed',
  },
  'two-column-image': {
    preset: 'two-column-image',
    gridTemplate: '"text image" 1fr / 1fr 1fr',
    zones: 2,
    idealBlockKinds: ['heading', 'paragraph', 'bullet-list', 'image'],
    idealBlockCount: { min: 3, max: 6 },
    hasImageZone: true,
    category: 'visual',
  },
  'three-column': {
    preset: 'three-column',
    gridTemplate: '"left center right" 1fr / 1fr 1fr 1fr',
    zones: 3,
    idealBlockKinds: ['heading', 'paragraph', 'statistic'],
    idealBlockCount: { min: 3, max: 9 },
    hasImageZone: false,
    category: 'data',
  },
  'image-left': {
    preset: 'image-left',
    gridTemplate: '"image content" 1fr / 2fr 3fr',
    zones: 2,
    idealBlockKinds: ['image', 'heading', 'paragraph', 'bullet-list'],
    idealBlockCount: { min: 3, max: 6 },
    hasImageZone: true,
    category: 'visual',
  },
  'image-right': {
    preset: 'image-right',
    gridTemplate: '"content image" 1fr / 3fr 2fr',
    zones: 2,
    idealBlockKinds: ['heading', 'paragraph', 'bullet-list', 'image'],
    idealBlockCount: { min: 3, max: 6 },
    hasImageZone: true,
    category: 'visual',
  },
  'image-full': {
    preset: 'image-full',
    gridTemplate: '"image" 1fr',
    zones: 1,
    idealBlockKinds: ['image', 'heading'],
    idealBlockCount: { min: 1, max: 3 },
    hasImageZone: true,
    category: 'visual',
  },
  'stats-grid': {
    preset: 'stats-grid',
    gridTemplate: '"a b" 1fr "c d" 1fr / 1fr 1fr',
    zones: 4,
    idealBlockKinds: ['statistic', 'heading'],
    idealBlockCount: { min: 3, max: 5 },
    hasImageZone: false,
    category: 'data',
  },
  'comparison': {
    preset: 'comparison',
    gridTemplate: '"left divider right" 1fr / 1fr auto 1fr',
    zones: 2,
    idealBlockKinds: ['heading', 'comparison-row', 'bullet-list'],
    idealBlockCount: { min: 3, max: 8 },
    hasImageZone: false,
    category: 'mixed',
  },
  'timeline': {
    preset: 'timeline',
    gridTemplate: '"timeline" 1fr',
    zones: 1,
    idealBlockKinds: ['heading', 'timeline-item'],
    idealBlockCount: { min: 3, max: 7 },
    hasImageZone: false,
    category: 'data',
  },
  'quote-centered': {
    preset: 'quote-centered',
    gridTemplate: '"quote" 1fr',
    zones: 1,
    idealBlockKinds: ['quote', 'heading'],
    idealBlockCount: { min: 1, max: 3 },
    hasImageZone: false,
    category: 'emphasis',
  },
  'chart-focus': {
    preset: 'chart-focus',
    gridTemplate: '"heading" auto "chart" 1fr',
    zones: 1,
    idealBlockKinds: ['heading', 'chart', 'paragraph'],
    idealBlockCount: { min: 2, max: 4 },
    hasImageZone: false,
    category: 'data',
  },
  'bento-grid': {
    preset: 'bento-grid',
    gridTemplate: '"a a b" 1fr "c d d" 1fr / 1fr 1fr 1fr',
    zones: 4,
    idealBlockKinds: ['heading', 'paragraph', 'statistic', 'image', 'callout'],
    idealBlockCount: { min: 4, max: 8 },
    hasImageZone: true,
    category: 'mixed',
  },
  'blank': {
    preset: 'blank',
    gridTemplate: '"content" 1fr',
    zones: 1,
    idealBlockKinds: [],
    idealBlockCount: { min: 0, max: 10 },
    hasImageZone: true,
    category: 'mixed',
  },
};

// ============================================
// LAYOUT SCORING ENGINE
// ============================================

/**
 * Score how well a set of blocks fits a layout preset.
 * Returns 0-1 where 1 is a perfect fit.
 */
export function scoreLayoutFit(
  blocks: SlideBlock[],
  preset: LayoutPreset,
): number {
  const def = LAYOUT_DEFINITIONS[preset];
  if (!def) return 0;

  let score = 0;
  const weights = { blockCount: 0.3, kindMatch: 0.4, imageMatch: 0.3 };

  // 1. Block count fitness
  const count = blocks.length;
  if (count >= def.idealBlockCount.min && count <= def.idealBlockCount.max) {
    score += weights.blockCount;
  } else {
    const distance = count < def.idealBlockCount.min
      ? def.idealBlockCount.min - count
      : count - def.idealBlockCount.max;
    score += weights.blockCount * Math.max(0, 1 - distance * 0.2);
  }

  // 2. Block kind match
  const matchingKinds = blocks.filter((b) =>
    def.idealBlockKinds.includes(b.kind),
  ).length;
  const kindRatio = blocks.length > 0 ? matchingKinds / blocks.length : 0;
  score += weights.kindMatch * kindRatio;

  // 3. Image zone match
  const hasImage = blocks.some((b) => b.kind === 'image');
  if (def.hasImageZone === hasImage) {
    score += weights.imageMatch;
  } else if (def.hasImageZone && !hasImage) {
    score += weights.imageMatch * 0.5; // partial credit
  }

  return Math.min(1, Math.max(0, score));
}

/**
 * Select the best layout for a set of blocks.
 */
export function selectBestLayout(
  blocks: SlideBlock[],
  previousLayout?: LayoutPreset,
): { preset: LayoutPreset; score: number } {
  const presets = Object.keys(LAYOUT_DEFINITIONS) as LayoutPreset[];

  const scored = presets.map((preset) => {
    let score = scoreLayoutFit(blocks, preset);

    // Penalize repeating the same layout
    if (preset === previousLayout) {
      score *= 0.7;
    }

    return { preset, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

// ============================================
// TYPOGRAPHY SCALING
// ============================================

/**
 * Compute typography sizes based on a modular scale.
 */
export function computeTypographyScale(
  baseSize: number,
  ratio: number,
): Record<string, number> {
  return {
    xs: Math.round(baseSize / (ratio * ratio)),
    sm: Math.round(baseSize / ratio),
    base: baseSize,
    lg: Math.round(baseSize * ratio),
    xl: Math.round(baseSize * ratio * ratio),
    '2xl': Math.round(baseSize * ratio * ratio * ratio),
    '3xl': Math.round(baseSize * ratio * ratio * ratio * ratio),
  };
}

/**
 * Get the ideal font size for a block kind and density.
 */
export function getBlockFontSize(
  kind: BlockKind,
  density: SlideLayout['density'],
  theme: PresentationTheme,
): string {
  const scale = computeTypographyScale(theme.typography.baseSize, theme.typography.scale);
  const densityMultiplier = density === 'dense' ? 0.85 : density === 'sparse' ? 1.15 : 1;

  const sizeMap: Record<string, number> = {
    heading: scale['2xl'],
    subheading: scale.xl,
    paragraph: scale.base,
    'bullet-list': scale.base,
    'numbered-list': scale.base,
    quote: scale.lg,
    statistic: scale['3xl'],
    callout: scale.lg,
    code: scale.sm,
  };

  const px = Math.round((sizeMap[kind] || scale.base) * densityMultiplier);
  return `${px}px`;
}

// ============================================
// SPACING SYSTEM
// ============================================

/**
 * Compute spacing values based on theme spacing config.
 */
export function computeSpacing(
  base: number,
  scale: number,
): Record<string, number> {
  return {
    xs: Math.round(base / scale),
    sm: base,
    md: Math.round(base * scale),
    lg: Math.round(base * scale * scale),
    xl: Math.round(base * scale * scale * scale),
    '2xl': Math.round(base * scale * scale * scale * scale),
  };
}

/**
 * Get slide padding based on density.
 */
export function getSlidePadding(
  density: SlideLayout['density'],
  base: number,
): { top: number; right: number; bottom: number; left: number } {
  const multiplier = density === 'sparse' ? 3 : density === 'dense' ? 1.5 : 2;
  const padding = Math.round(base * multiplier);
  return {
    top: padding,
    right: Math.round(padding * 1.5),
    bottom: padding,
    left: Math.round(padding * 1.5),
  };
}

// ============================================
// CONTENT DENSITY ANALYSIS
// ============================================

/**
 * Analyze content density for a slide and recommend adjustments.
 */
export function analyzeContentDensity(blocks: SlideBlock[]): {
  density: SlideLayout['density'];
  totalTextLength: number;
  blockCount: number;
  hasImage: boolean;
  hasChart: boolean;
  recommendation: string;
} {
  const totalTextLength = blocks.reduce(
    (sum, b) =>
      sum +
      (b.content.text?.length || 0) +
      (b.content.items?.join('').length || 0),
    0,
  );

  const hasImage = blocks.some((b) => b.kind === 'image');
  const hasChart = blocks.some((b) => b.kind === 'chart');

  let density: SlideLayout['density'] = 'balanced';
  let recommendation = 'Content density is appropriate.';

  if (blocks.length <= 2 && totalTextLength < 100) {
    density = 'sparse';
    recommendation = 'Very light content — consider a hero or quote layout.';
  } else if (blocks.length >= 6 || totalTextLength > 500) {
    density = 'dense';
    recommendation = 'Dense content — consider splitting into multiple slides or using a two-column layout.';
  }

  return {
    density,
    totalTextLength,
    blockCount: blocks.length,
    hasImage,
    hasChart,
    recommendation,
  };
}
