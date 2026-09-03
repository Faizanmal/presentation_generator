import {
  BANNED_FILLER_PHRASES,
  isBannedFiller,
  looksLikeMockStatistic,
  recipeForSlideIndex,
} from './slide-recipes';
import {
  mapGeneratedBlock,
  mergeConsecutiveLists,
  materializeGeneratedBlocks,
} from './presentation-block-mapper';
import { BlockType } from '@prisma/client';
import { CriticAgentService } from './thinking-agent/critic-agent.service';
import type { EnhancedPresentation } from './thinking-agent/thinking-agent.types';

describe('Gamma-quality generation guards', () => {
  it('rejects hardcoded filler callouts', () => {
    expect(
      isBannedFiller('Why this matters now: clear outcome and audience value.'),
    ).toBe(true);
    expect(
      isBannedFiller(
        'Key takeaway: focus on one decisive insight before moving on.',
      ),
    ).toBe(true);
    expect(BANNED_FILLER_PHRASES.length).toBeGreaterThan(3);
  });

  it('rejects mock $1.2B / 15% / 2.5M fingerprints', () => {
    expect(looksLikeMockStatistic('$1.2B Market Size')).toBe(true);
    expect(looksLikeMockStatistic('2.5M Active Users')).toBe(true);
    expect(looksLikeMockStatistic('15% Annual Growth Rate')).toBe(true);
    expect(
      looksLikeMockStatistic("Amazon's engine drives 35% of revenue"),
    ).toBe(false);
  });

  it('seeds a Gamma-like deck arc with native layouts', () => {
    const layouts = Array.from(
      { length: 10 },
      (_, i) => recipeForSlideIndex(i, 10).layout,
    );
    expect(layouts[0]).toBe('title-hero');
    expect(layouts).toEqual(expect.arrayContaining(['stats-grid']));
    expect(layouts).toEqual(expect.arrayContaining(['timeline']));
    expect(layouts).toEqual(expect.arrayContaining(['comparison']));
    expect(layouts[layouts.length - 1]).toBe('bento-grid');
  });

  it('maps comparison, timeline, and statistic blocks to Prisma visual types', () => {
    const comparison = mapGeneratedBlock({
      type: 'comparison',
      content: 'Healthcare vs Finance',
      items: [
        'Healthcare: 95%+ radiology accuracy',
        'Finance: JPMorgan COiN reviews contracts in seconds',
      ],
    });
    const timeline = mapGeneratedBlock({
      type: 'timeline',
      content: 'Decade',
      items: ['2025-2026: agents go mainstream', '2032-2035: AGI debate'],
    });
    const stat = mapGeneratedBlock({
      type: 'statistic',
      content: '35%',
      value: '35%',
      label: 'Amazon recommendation share of revenue',
    });

    expect(comparison?.blockType).toBe(BlockType.COMPARISON);
    expect(timeline?.blockType).toBe(BlockType.TIMELINE);
    expect(stat?.blockType).toBe(BlockType.STATS_GRID);
    expect(
      mapGeneratedBlock({ type: 'paragraph', content: '$1.2B Market Size' }),
    ).toBeNull();
    expect(
      mapGeneratedBlock({
        type: 'kicker',
        content: 'editorial',
      }),
    ).toBeNull();
    expect(mapGeneratedBlock({ type: 'kicker', content: 'QUOTE' })).toBeNull();
    expect(
      mapGeneratedBlock({
        type: 'kicker',
        content: 'THE SHIFT',
      })?.style,
    ).toEqual({ variant: 'kicker' });
    expect(
      mapGeneratedBlock({
        type: 'callout',
        content:
          'Key takeaway: focus on one decisive insight before moving on.',
      }),
    ).toBeNull();
  });

  it('merges consecutive statistic tiles into one stats grid', () => {
    const merged = mergeConsecutiveLists([
      mapGeneratedBlock({
        type: 'statistic',
        content: '95%+',
        value: '95%+',
        label: 'Detection accuracy',
      })!,
      mapGeneratedBlock({
        type: 'statistic',
        content: '35%',
        value: '35%',
        label: 'Revenue share',
      })!,
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].blockType).toBe(BlockType.STATS_GRID);
    expect((merged[0].content.items as string[]).length).toBe(2);
  });

  it('materializes a Gamma-like slide set with images and native layouts', () => {
    const blocks = materializeGeneratedBlocks([
      {
        type: 'image',
        content: 'https://picsum.photos/seed/ai-here/1600/900',
        embedUrl: 'https://picsum.photos/seed/ai-here/1600/900',
      },
      {
        type: 'statistic',
        content: '35%',
        value: '35%',
        label: 'Amazon recommendation revenue',
      },
      {
        type: 'timeline',
        content: 'Path',
        items: ['2025-2026: agents go mainstream', '2030: copilots everywhere'],
      },
      { type: 'paragraph', content: '$1.2B Market Size' },
    ]);

    const types = blocks.map((block) => block.blockType);
    expect(types).toContain(BlockType.IMAGE);
    expect(types).toContain(BlockType.STATS_GRID);
    expect(types).toContain(BlockType.TIMELINE);
    expect(types).not.toContain(BlockType.PARAGRAPH);
    expect(JSON.stringify(blocks)).not.toMatch(/\$1\.2B/);
    expect(
      blocks.some((block) => {
        const url = block.content.url;
        return typeof url === 'string' && url.includes('picsum');
      }),
    ).toBe(true);
  });

  it('critic flags filler, mock stats, and slides with no visual block', () => {
    const critic = new CriticAgentService({} as never, {} as never);
    const presentation = {
      title: 'AI is not the future',
      sections: [
        {
          id: 's1',
          heading: 'Why this matters now: clear outcome and audience value.',
          blocks: [
            {
              id: 'b1',
              type: 'paragraph',
              content: '$1.2B Market Size with no source',
            },
          ],
          layout: 'title',
        },
      ],
      metadata: {
        estimatedDuration: 10,
        keywords: [],
        summary: '',
        difficulty: 'intermediate',
        category: 'tech',
      },
    } as EnhancedPresentation;

    const issues = critic.collectGammaQualityIssues(presentation);
    expect(issues.some((issue) => issue.area === 'copy')).toBe(true);
    expect(issues.some((issue) => issue.area === 'evidence')).toBe(true);
    expect(issues.some((issue) => issue.area === 'visual')).toBe(true);
  });
});
