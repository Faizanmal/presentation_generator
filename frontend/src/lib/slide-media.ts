/**
 * Helpers for slide media presence — keep URL rules aligned with
 * backend-nest presentation-block-mapper / layout selection.
 */

const HTTP_URL = /^https?:\/\/\S+/i;

const TOPIC_IMAGE_POOLS: Array<{
  keywords: RegExp;
  urls: string[];
}> = [
  {
    keywords: /\b(coffee|cafe|café|espresso|roast|roastery|barista|latte|cappuccino|brew|beans|coffeeshop)\b/i,
    urls: [
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1600&q=80',
    ],
  },
  {
    keywords: /\b(meal|prep|nutrition|nutritious|food|healthy|diet|cooking|kitchen|recipe|grocery|culinary|lunch|dinner|protein|vegan|organic)\b/i,
    urls: [
      'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1600&q=80',
    ],
  },
  {
    keywords: /\b(remote\s*work|hybrid\s*work|distributed|telecommut|home\s*office|workspace|coworking|async|collaboration|workforce|nomad|virtual\s*team)\b/i,
    urls: [
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1600&q=80',
    ],
  },
  {
    keywords: /\b(ai|artificial\s*intelligence|machine\s*learning|software|saas|cloud|cyber|data|automation|algorithm|neural|developer|tech)\b/i,
    urls: [
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80',
    ],
  },
  {
    keywords: /\b(finance|fintech|invest|revenue|banking|market|economy|startup|pitch|venture|growth|sales|enterprise)\b/i,
    urls: [
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1600&q=80',
    ],
  },
  {
    keywords: /\b(health|medical|clinical|patient|hospital|wellness|fitness|therapy|biotech|pharma)\b/i,
    urls: [
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1600&q=80',
    ],
  },
];

/**
 * Pick a topic-matched image URL from deck topic + slide title + content keywords.
 * Never falls back to random landscape Picsum seeds.
 */
export function resolveTopicImageUrl(contextText: string, slideIndex = 0): string {
  const normalized = (contextText || '').trim();
  for (const pool of TOPIC_IMAGE_POOLS) {
    if (pool.keywords.test(normalized)) {
      return pool.urls[Math.abs(slideIndex) % pool.urls.length];
    }
  }
  const cleanKeywords = normalized
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
  if (cleanKeywords) {
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(
      `${cleanKeywords} professional editorial photography`,
    )}?width=1600&height=900&nologo=true`;
  }
  return 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80';
}

/**
 * If an image URL is a legacy random landscape seed (e.g. picsum.photos),
 * upgrade it to a topic-matched image using the deck/slide context.
 */
export function upgradeLegacyImageUrl(
  rawUrl: string | undefined | null,
  contextText: string,
  slideIndex = 0,
): string | undefined {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return undefined;
  }
  const trimmed = rawUrl.trim();
  if (!isValidMediaUrl(trimmed)) {
    return undefined;
  }
  if (/picsum\.photos|source\.unsplash\.com|placehold\.co/i.test(trimmed)) {
    // Also extract any seed words embedded in picsum.photos/seed/<words>/...
    const seedMatch = trimmed.match(/\/seed\/([^/]+)/i);
    const seedWords = seedMatch ? seedMatch[1].replace(/[-_]+/g, ' ') : '';
    return resolveTopicImageUrl(`${contextText} ${seedWords}`.trim(), slideIndex);
  }
  return trimmed;
}

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
  contextText = '',
  slideIndex = 0,
): string | undefined {
  if (!content) {
    return undefined;
  }
  const candidates = [content.url, content.src, content.embedUrl, content.text];
  const blockContext = [
    contextText,
    typeof content.alt === 'string' ? content.alt : '',
    typeof content.label === 'string' ? content.label : '',
    typeof content.caption === 'string' ? content.caption : '',
  ]
    .filter(Boolean)
    .join(' ');
  for (const c of candidates) {
    if (isValidMediaUrl(c)) {
      return upgradeLegacyImageUrl(String(c).trim(), blockContext, slideIndex);
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
