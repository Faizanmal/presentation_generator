import { LAYOUT_FIXTURES } from './layout-fixture-data';
import { pickLayoutForContent } from '@/lib/slide-media';

describe('layout fixtures', () => {
  it('covers key layouts with long/short and with/without image cases', () => {
    const layouts = new Set(LAYOUT_FIXTURES.map((f) => f.layout));
    expect(layouts.has('title-hero')).toBe(true);
    expect(layouts.has('three-column')).toBe(true);
    expect(layouts.has('image-right')).toBe(true);
    expect(layouts.has('stats-grid')).toBe(true);
    expect(layouts.has('quote-highlight')).toBe(true);
    expect(layouts.has('bento-grid')).toBe(true);

    const withImage = LAYOUT_FIXTURES.filter((f) => f.imageUrl);
    const withoutImage = LAYOUT_FIXTURES.filter((f) => !f.imageUrl);
    expect(withImage.length).toBeGreaterThan(0);
    expect(withoutImage.length).toBeGreaterThan(0);
  });

  it('resolves no-image media layouts to non-media fallbacks', () => {
    for (const fixture of LAYOUT_FIXTURES) {
      if (fixture.imageUrl) {
        continue;
      }
      if (!['title-hero', 'image-right', 'image-left'].includes(fixture.layout)) {
        continue;
      }
      const resolved = pickLayoutForContent({
        preferred: fixture.layout,
        hasValidImage: false,
        bulletCount: fixture.bullets?.length ?? 0,
        bodyTextLength: fixture.body.join(' ').length,
        hasComparison: false,
        hasQuote: fixture.layout === 'quote-highlight',
        hasStats: fixture.layout === 'stats-grid',
        isOpening: fixture.layout === 'title-hero',
      });
      expect(['title-subtitle', 'single-column', 'quote-highlight', 'stats-grid', 'comparison']).toContain(
        resolved,
      );
    }
  });
});
