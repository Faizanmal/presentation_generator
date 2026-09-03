import type { LayoutType } from '@shared/index';

export type SlideRecipeId =
  | 'title-hero'
  | 'foundation-cards'
  | 'three-up-proof'
  | 'stats-grid'
  | 'timeline-rail'
  | 'image-story'
  | 'comparison'
  | 'quote-close'
  | 'cta-grid';

export interface SlideRecipe {
  id: SlideRecipeId;
  layout: LayoutType;
  role: string;
  requiredBlockTypes: string[];
  wantsImage: boolean;
}

export const SLIDE_RECIPES: Record<SlideRecipeId, SlideRecipe> = {
  'title-hero': {
    id: 'title-hero',
    layout: 'title-hero',
    role: 'hook',
    requiredBlockTypes: ['kicker', 'paragraph', 'image'],
    wantsImage: true,
  },
  'foundation-cards': {
    id: 'foundation-cards',
    layout: 'three-column',
    role: 'context',
    requiredBlockTypes: ['kicker', 'card', 'image'],
    wantsImage: true,
  },
  'three-up-proof': {
    id: 'three-up-proof',
    layout: 'comparison',
    role: 'evidence',
    requiredBlockTypes: ['kicker', 'comparison'],
    wantsImage: true,
  },
  'stats-grid': {
    id: 'stats-grid',
    layout: 'stats-grid',
    role: 'evidence',
    requiredBlockTypes: ['statistic'],
    wantsImage: false,
  },
  'timeline-rail': {
    id: 'timeline-rail',
    layout: 'timeline',
    role: 'transformation',
    requiredBlockTypes: ['timeline'],
    wantsImage: true,
  },
  'image-story': {
    id: 'image-story',
    layout: 'image-right',
    role: 'context',
    requiredBlockTypes: ['paragraph', 'image'],
    wantsImage: true,
  },
  comparison: {
    id: 'comparison',
    layout: 'comparison',
    role: 'evidence',
    requiredBlockTypes: ['comparison'],
    wantsImage: false,
  },
  'quote-close': {
    id: 'quote-close',
    layout: 'quote-highlight',
    role: 'call-to-action',
    requiredBlockTypes: ['quote', 'call-to-action'],
    wantsImage: false,
  },
  'cta-grid': {
    id: 'cta-grid',
    layout: 'bento-grid',
    role: 'call-to-action',
    requiredBlockTypes: ['card', 'call-to-action'],
    wantsImage: true,
  },
};

/** Default 10-slide Gamma-style arc */
export const DEFAULT_DECK_ARC: SlideRecipeId[] = [
  'title-hero',
  'foundation-cards',
  'image-story',
  'stats-grid',
  'three-up-proof',
  'image-story',
  'timeline-rail',
  'comparison',
  'quote-close',
  'cta-grid',
];

export function recipeForSlideIndex(index: number, total: number): SlideRecipe {
  if (index === 0) {
    return SLIDE_RECIPES['title-hero'];
  }
  if (index === total - 1) {
    return SLIDE_RECIPES['cta-grid'];
  }
  if (index === total - 2) {
    return SLIDE_RECIPES['quote-close'];
  }
  const middle = DEFAULT_DECK_ARC.slice(1, -1);
  return SLIDE_RECIPES[middle[(index - 1) % middle.length]];
}

export const BANNED_FILLER_PHRASES = [
  'why this matters now: clear outcome and audience value',
  'key takeaway: focus on one decisive insight before moving on',
  "in today's world",
  "it's important to note",
  'unlock potential',
  'innovative solutions',
  'leverage synergies',
];

export const MOCK_STAT_FINGERPRINTS = [
  '$1.2b',
  '$1.2 b',
  '2.5m active users',
  '2.5 m active',
  '15% annual growth',
];

export function isBannedFiller(text: string): boolean {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  return BANNED_FILLER_PHRASES.some((phrase) => normalized.includes(phrase));
}

export function looksLikeMockStatistic(text: string): boolean {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ');
  return MOCK_STAT_FINGERPRINTS.some((fp) => normalized.includes(fp));
}

/** Design-style names that leaked into kickers as "EDITORIAL | EDITORIAL". */
export function isGenericKicker(text: string): boolean {
  return /^(editorial|executive|bold|manifesto|comparison|quote|timeline|history|basics|evidence|use cases|look ahead|call to action|cta|hook|context|transformation|foundation|proof)$/i.test(
    text.trim(),
  );
}
