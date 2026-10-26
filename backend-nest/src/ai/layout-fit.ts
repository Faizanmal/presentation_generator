/**
 * Content-aware layout selection + lightweight overflow heuristics for AI decks.
 * Keep pick rules aligned with frontend/src/lib/slide-media.ts.
 */

import { isValidMediaUrl } from './presentation-block-mapper';
import type { GeneratedPresentation } from './ai.service';

const MEDIA_DEPENDENT = new Set([
  'title-hero',
  'image-left',
  'image-right',
  'two-column-image',
  'image-full',
]);

const SIMPLE_FALLBACKS = [
  'single-column',
  'title-subtitle',
  'two-column',
  'quote-highlight',
] as const;

export interface SectionContentSignals {
  hasValidImage: boolean;
  bulletCount: number;
  bodyTextLength: number;
  hasComparison: boolean;
  hasQuote: boolean;
  hasStats: boolean;
  blockCount: number;
}

export function analyzeSectionContent(
  section: GeneratedPresentation['sections'][number],
): SectionContentSignals {
  let bulletCount = 0;
  let bodyTextLength = 0;
  let hasValidImage = false;
  let hasComparison = false;
  let hasQuote = false;
  let hasStats = false;

  for (const block of section.blocks || []) {
    const type = (block.type || '').toLowerCase();
    const text = String(block.content || '');
    bodyTextLength += text.length;
    if (Array.isArray(block.items)) {
      bulletCount += block.items.length;
      bodyTextLength += block.items.join(' ').length;
    }
    if (type === 'bullet' || type === 'bullet-list' || type === 'numbered-list') {
      bulletCount += block.items?.length || (text ? 1 : 0);
    }
    if (
      (type === 'image' || type === 'image-placeholder') &&
      (isValidMediaUrl(block.embedUrl) || isValidMediaUrl(block.content))
    ) {
      hasValidImage = true;
    }
    if (type === 'comparison' || type === 'comparison-item') {
      hasComparison = true;
    }
    if (type === 'quote') {
      hasQuote = true;
    }
    if (type === 'statistic' || type === 'stats-grid') {
      hasStats = true;
    }
  }

  if (section.suggestedImage && isValidMediaUrl(section.suggestedImage)) {
    hasValidImage = true;
  }

  return {
    hasValidImage,
    bulletCount,
    bodyTextLength,
    hasComparison,
    hasQuote,
    hasStats,
    blockCount: section.blocks?.length || 0,
  };
}

export function pickLayoutForContent(
  preferred: string,
  signals: SectionContentSignals,
  options?: { isOpening?: boolean },
): string {
  let layout = preferred || 'single-column';
  const { isOpening } = options || {};

  if (MEDIA_DEPENDENT.has(layout) && !signals.hasValidImage) {
    if (isOpening) {
      layout = 'title-subtitle';
    } else if (signals.hasQuote) {
      layout = 'quote-highlight';
    } else if (signals.hasStats) {
      layout = 'stats-grid';
    } else if (signals.hasComparison) {
      layout = 'comparison';
    } else {
      layout = 'single-column';
    }
  }

  if (
    signals.bulletCount > 6 &&
    (layout === 'three-column' || layout === 'bento-grid')
  ) {
    layout = 'single-column';
  }

  if (signals.bodyTextLength > 900 && layout === 'three-column') {
    layout = 'two-column';
  }

  if (signals.bodyTextLength > 1200 && MEDIA_DEPENDENT.has(layout)) {
    layout = 'single-column';
  }

  if (
    signals.hasComparison &&
    signals.hasValidImage &&
    (layout === 'stats-grid' || layout === 'bento-grid')
  ) {
    layout = 'comparison';
  }

  // Dense mixed content → prefer simpler column layouts
  if (
    signals.blockCount > 7 &&
    (layout === 'bento-grid' || layout === 'stats-grid')
  ) {
    layout = signals.hasComparison ? 'comparison' : 'single-column';
  }

  return layout;
}

/**
 * Heuristic overflow/overlap flag used as a post-generation fallback trigger.
 * (DOM measurement happens in the editor; this catches obvious overcrowding.)
 */
export function sectionLikelyOverflows(
  layout: string,
  signals: SectionContentSignals,
): boolean {
  if (signals.bulletCount > 8) return true;
  if (signals.bodyTextLength > 1400 && layout !== 'single-column') return true;
  if (
    MEDIA_DEPENDENT.has(layout) &&
    !signals.hasValidImage &&
    signals.bodyTextLength > 400
  ) {
    return true;
  }
  if (
    (layout === 'bento-grid' || layout === 'stats-grid') &&
    signals.hasComparison &&
    signals.blockCount >= 5
  ) {
    return true;
  }
  if (layout === 'three-column' && signals.bodyTextLength > 700) return true;
  if (
    layout === 'quote-highlight' &&
    signals.bodyTextLength + (signals.hasQuote ? 0 : 200) > 600
  ) {
    return true;
  }
  return false;
}

export function simplerLayoutFallback(
  layout: string,
  signals: SectionContentSignals,
): string {
  if (sectionLikelyOverflows(layout, signals)) {
    if (signals.hasQuote) return 'quote-highlight';
    if (signals.hasComparison) return 'comparison';
    if (signals.hasStats) return 'two-column';
    return SIMPLE_FALLBACKS[0];
  }
  return layout;
}
