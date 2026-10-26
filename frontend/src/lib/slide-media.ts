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
  hasQuote: boolean;
  hasStats: boolean;
  isOpening?: boolean;
}): string {
  const {
    preferred,
    hasValidImage,
    bulletCount,
    bodyTextLength,
    hasComparison,
    hasQuote,
    hasStats,
    isOpening,
  } = input;

  let layout = preferred || 'single-column';

  if (MEDIA_DEPENDENT_LAYOUTS.has(layout) && !hasValidImage) {
    if (isOpening) {
      layout = 'title-subtitle';
    } else if (hasQuote) {
      layout = 'quote-highlight';
    } else if (hasStats) {
      layout = 'stats-grid';
    } else if (hasComparison) {
      layout = 'comparison';
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

  if (
    hasComparison &&
    hasValidImage &&
    (layout === 'stats-grid' || layout === 'bento-grid')
  ) {
    // Avoid dumping comparison cards + image into one crowded grid
    layout = 'comparison';
  }

  return layout;
}
