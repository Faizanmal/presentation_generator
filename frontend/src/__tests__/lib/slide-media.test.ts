import {
  isValidMediaUrl,
  pickLayoutForContent,
  MEDIA_DEPENDENT_LAYOUTS,
} from '@/lib/slide-media';

describe('slide-media', () => {
  it('accepts http(s) URLs only', () => {
    expect(isValidMediaUrl('https://cdn.example.com/a.jpg')).toBe(true);
    expect(isValidMediaUrl('http://cdn.example.com/a.jpg')).toBe(true);
    expect(isValidMediaUrl('a moody espresso shot')).toBe(false);
    expect(isValidMediaUrl('/relative/path.jpg')).toBe(false);
    expect(isValidMediaUrl('')).toBe(false);
  });

  it('lists media-dependent layouts', () => {
    expect(MEDIA_DEPENDENT_LAYOUTS.has('title-hero')).toBe(true);
    expect(MEDIA_DEPENDENT_LAYOUTS.has('image-right')).toBe(true);
    expect(MEDIA_DEPENDENT_LAYOUTS.has('single-column')).toBe(false);
  });

  it('picks safer layouts for long text without images', () => {
    expect(
      pickLayoutForContent({
        preferred: 'image-right',
        hasValidImage: false,
        bulletCount: 4,
        bodyTextLength: 200,
        hasComparison: false,
        hasQuote: false,
        hasStats: false,
      }),
    ).toBe('single-column');

    expect(
      pickLayoutForContent({
        preferred: 'three-column',
        hasValidImage: false,
        bulletCount: 8,
        bodyTextLength: 100,
        hasComparison: false,
        hasQuote: false,
        hasStats: false,
      }),
    ).toBe('single-column');
  });

  it('keeps opening title-subtitle when hero has no image', () => {
    expect(
      pickLayoutForContent({
        preferred: 'title-hero',
        hasValidImage: false,
        bulletCount: 0,
        bodyTextLength: 80,
        hasComparison: false,
        hasQuote: false,
        hasStats: false,
        isOpening: true,
      }),
    ).toBe('title-subtitle');
  });
});
