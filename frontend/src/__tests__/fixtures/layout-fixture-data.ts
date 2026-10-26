/**
 * Visual / layout fixtures for AI slide layouts.
 * Use with component tests or future Playwright snapshots:
 * long vs short copy, with vs without a real image URL.
 */

export type LayoutFixture = {
  id: string;
  layout: string;
  title: string;
  body: string[];
  bullets?: string[];
  imageUrl?: string;
};

const SHORT = 'Fresh roast. Local beans.';
const LONG =
  'Our neighborhood coffee shop grew from a single espresso cart into a gathering place where baristas know every regular by name, seasonal single-origin lots rotate weekly, and the back bar still smells like caramelized sugar at six in the morning when the first pour-over hits the scale.';

const IMAGE = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085';

export const LAYOUT_FIXTURES: LayoutFixture[] = [
  {
    id: 'title-hero-short-with-image',
    layout: 'title-hero',
    title: 'Morning Ritual',
    body: [SHORT],
    imageUrl: IMAGE,
  },
  {
    id: 'title-hero-long-no-image',
    layout: 'title-hero',
    title: 'Morning Ritual',
    body: [LONG, LONG],
  },
  {
    id: 'three-column-short',
    layout: 'three-column',
    title: 'What we stand for',
    body: ['Craft', 'Community', 'Care'],
  },
  {
    id: 'three-column-long',
    layout: 'three-column',
    title: 'What we stand for',
    body: [LONG, LONG, LONG],
  },
  {
    id: 'image-right-with-image',
    layout: 'image-right',
    title: 'The pour',
    body: [SHORT],
    bullets: ['Fresh grounds', '98°C water', '30-second bloom'],
    imageUrl: IMAGE,
  },
  {
    id: 'image-right-no-image',
    layout: 'image-right',
    title: 'The pour',
    body: [LONG],
    bullets: [
      'Fresh grounds every morning',
      'Water held at ninety-eight degrees',
      'A thirty-second bloom before the main pour',
      'Served in ceramic that keeps heat',
      'Never rushed, never burnt',
      'Seasonal syrups on the side bar',
      'Extra shot available on request',
    ],
  },
  {
    id: 'stats-grid-crowded',
    layout: 'stats-grid',
    title: 'Proof in the cup',
    body: ['A vs B comparison of roast profiles with result notes', LONG],
    imageUrl: IMAGE,
  },
  {
    id: 'quote-highlight-long',
    layout: 'quote-highlight',
    title: `"${LONG}"`,
    body: ['Visit us this weekend — first latte on the house for new neighbors.'],
  },
  {
    id: 'bento-grid-cta',
    layout: 'bento-grid',
    title: 'Come sit with us',
    body: [LONG, SHORT, 'Book a cupping', 'Join the membership'],
  },
  {
    id: 'single-column-short',
    layout: 'single-column',
    title: 'Open daily',
    body: [SHORT],
    bullets: ['7am–6pm', 'Wifi', 'Pastries'],
  },
];
