import {
  analyzeSectionContent,
  pickLayoutForContent,
  sectionLikelyOverflows,
  simplerLayoutFallback,
} from './layout-fit';

describe('layout-fit', () => {
  it('demotes image layouts when there is no valid image URL', () => {
    const signals = analyzeSectionContent({
      heading: 'Hello',
      layout: 'image-right',
      blocks: [
        { type: 'heading', content: 'Hello' },
        { type: 'bullet-list', content: '', items: ['a', 'b', 'c'] },
        { type: 'image', content: 'a moody coffee shop photo' },
      ],
    });
    expect(signals.hasValidImage).toBe(false);
    expect(
      pickLayoutForContent('image-right', signals, { isOpening: false }),
    ).toBe('single-column');
  });

  it('keeps title-hero when a real image URL exists', () => {
    const signals = analyzeSectionContent({
      heading: 'Brew',
      layout: 'title-hero',
      blocks: [
        { type: 'heading', content: 'Brew' },
        {
          type: 'image',
          content: 'https://images.example.com/coffee.jpg',
          embedUrl: 'https://images.example.com/coffee.jpg',
        },
      ],
    });
    expect(signals.hasValidImage).toBe(true);
    expect(
      pickLayoutForContent('title-hero', signals, { isOpening: true }),
    ).toBe('title-hero');
  });

  it('falls back from overcrowded bento/stats layouts', () => {
    const signals = {
      hasValidImage: true,
      bulletCount: 2,
      bodyTextLength: 400,
      hasComparison: true,
      hasTimeline: false,
      hasQuote: false,
      hasStats: true,
      hasCards: false,
      cardCount: 0,
      blockCount: 6,
    };
    expect(sectionLikelyOverflows('stats-grid', signals)).toBe(true);
    expect(simplerLayoutFallback('stats-grid', signals)).toBe('comparison');
  });

  it('simplifies three-column with long body text', () => {
    const signals = {
      hasValidImage: false,
      bulletCount: 3,
      bodyTextLength: 950,
      hasComparison: false,
      hasTimeline: false,
      hasQuote: false,
      hasStats: false,
      hasCards: false,
      cardCount: 0,
      blockCount: 4,
    };
    expect(pickLayoutForContent('three-column', signals)).toBe('two-column');
  });
});
