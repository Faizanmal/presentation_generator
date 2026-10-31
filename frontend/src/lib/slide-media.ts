/**
 * Helpers for slide media presence — keep URL rules aligned with
 * backend-nest presentation-block-mapper / layout selection.
 */

const HTTP_URL = /^https?:\/\/\S+/i;

/** True when a string is a usable image/media URL (not a prompt or relative path). */
export function isValidMediaUrl(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) {
    return false;
  }
  // Reject common AI prompt leftovers mistaken for URLs
  if (/\s/.test(trimmed) && !HTTP_URL.test(trimmed)) {
    return false;
  }
  return HTTP_URL.test(trimmed);
}

export function mediaUrlFromBlockContent(
  content: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!content) {
    return undefined;
  }
  const candidates = [content.url, content.src, content.embedUrl, content.text];
  for (const c of candidates) {
    if (isValidMediaUrl(c)) {
      return String(c).trim();
    }
  }
  return undefined;
}

/** Layouts that reserve a dedicated media column/panel. */
export const MEDIA_DEPENDENT_LAYOUTS = new Set([
  'title-hero',
  'image-left',
  'image-right',
  'two-column-image',
  'image-full',
]);

/**
 * Pick a safe layout when content length / image presence don't match the recipe.
 */
export function pickLayoutForContent(input: {
  preferred: string;
  hasValidImage: boolean;
  bulletCount: number;
  bodyTextLength: number;
  hasComparison: boolean;
  hasTimeline?: boolean;
  hasQuote: boolean;
  hasStats: boolean;
  hasCards?: boolean;
  cardCount?: number;
  blockCount?: number;
  isOpening?: boolean;
}): string {
  const {
    preferred,
    hasValidImage,
    bulletCount,
    bodyTextLength,
    hasComparison,
    hasTimeline,
    hasQuote,
    hasStats,
    cardCount = 0,
    blockCount = 0,
    isOpening,
  } = input;

  let layout = preferred || 'single-column';

  if (isOpening) {
    return hasValidImage ? 'title-hero' : 'title-subtitle';
  }

  if (hasTimeline) {
    return 'timeline';
  }

  if (hasComparison) {
    return 'comparison';
  }

  if ((layout === 'stats-grid' || layout === 'bento-grid') && !hasStats) {
    if (cardCount >= 3) {
      return 'three-column';
    }
    if (cardCount === 2) {
      return 'two-column';
    }
    if (hasQuote && bodyTextLength < 400) {
      return 'quote-highlight';
    }
    if (hasValidImage) {
      return 'image-right';
    }
    return 'two-column';
  }

  if (MEDIA_DEPENDENT_LAYOUTS.has(layout) && !hasValidImage) {
    if (hasStats) {
      layout = 'stats-grid';
    } else if (hasQuote && bodyTextLength < 400) {
      layout = 'quote-highlight';
    } else if (cardCount >= 3) {
      layout = 'three-column';
    } else if (cardCount === 2) {
      layout = 'two-column';
    } else {
      layout = 'single-column';
    }
  }

  if (bulletCount > 6 && (layout === 'three-column' || layout === 'bento-grid')) {
    layout = 'single-column';
  }

  if (bodyTextLength > 900 && layout === 'three-column') {
    layout = 'two-column';
  }

  if (bodyTextLength > 1200 && MEDIA_DEPENDENT_LAYOUTS.has(layout)) {
    layout = 'single-column';
  }

  if (blockCount > 7 && (layout === 'bento-grid' || layout === 'stats-grid')) {
    layout = 'two-column';
  }

  return layout;
}
