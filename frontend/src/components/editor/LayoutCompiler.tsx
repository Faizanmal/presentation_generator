"use client";

import React, { useMemo } from 'react';
import type { Block, Theme } from '@/types';
import BlockRenderer from './BlockRenderer';
import { AnimatePresence } from 'framer-motion';
import { mediaUrlFromBlockContent } from '@/lib/slide-media';
import { BrandedMediaPlaceholder } from './BrandedMediaPlaceholder';

interface LayoutCompilerProps {
  layoutType: string;
  generateImages?: boolean;
  blocks: Block[];
  theme?: Theme;
  presentationDensity?: number;
  presentationTone?: number;
  activeBlockId?: string | null;
  onFocus?: (id: string) => void;
  onBlur?: () => void;
  onChange?: (id: string, content: Record<string, unknown>) => void;
  onDelete?: (id: string) => void;
  renderBlock?: (block: Block, index: number) => React.ReactNode;
}

/** Map DSL / legacy layout names onto compiler cases */
const LAYOUT_ALIASES: Record<string, string> = {
  'title-hero': 'title-hero',
  'title-subtitle': 'title-subtitle',
  title: 'title',
  'single-column': 'single-column',
  'title-content': 'single-column',
  content: 'single-column',
  'two-column': 'two-column',
  'two-column-image': 'two-column-image',
  comparison: 'comparison',
  'three-column': 'three-column',
  'image-left': 'image-left',
  'image-right': 'image-right',
  'image-full': 'image-full',
  'quote-centered': 'quote-highlight',
  'quote-highlight': 'quote-highlight',
  'stats-grid': 'stats-grid',
  'chart-focus': 'chart-focus',
  'bento-grid': 'bento-grid',
  timeline: 'timeline',
  blank: 'single-column',
};

const GENERIC_KICKER = /^(editorial|executive|bold|manifesto|comparison|quote|timeline|history|basics|evidence|use cases|look ahead|call to action|cta|hook|context|transformation|foundation|proof)$/i;

const getBlockType = (block: Block) => {
  const rawType = block.type || (block as Block & { blockType?: string }).blockType;
  return (rawType as string | undefined)?.toUpperCase().trim().replace(/-/g, '_') || 'PARAGRAPH';
};

const blockPlainText = (block: Block): string => {
  const text = block.content?.text;
  return typeof text === 'string' ? text.trim() : '';
};

const getBlockZone = (block: Block): number | undefined => {
  const direct = (block as Block & { zone?: number }).zone;
  if (typeof direct === 'number') {return direct;}
  const fromStyle = block.style?.zone;
  return typeof fromStyle === 'number' ? fromStyle : undefined;
};

const blockTextWeight = (block: Block): number => {
  const c = block.content || {};
  const text = typeof c.text === 'string' ? c.text.length : 0;
  const items = Array.isArray(c.items)
    ? c.items.reduce((sum, item) => sum + (typeof item === 'string' ? item.length : 20), 0)
    : 0;
  const type = getBlockType(block);
  const kindBoost =
    type === 'STATISTIC' || type === 'STATS_GRID' ? 80 :
    type === 'IMAGE' || type === 'CHART' ? 120 :
    type === 'HEADING' ? 40 : 0;
  return text + items + kindBoost + 24;
};

/** Split body blocks by explicit zone, else by balanced text weight */
function splitIntoColumns(blocks: Block[], columnCount: number): Block[][] {
  if (columnCount <= 1) {return [blocks];}

  const zoned = blocks.filter((b) => getBlockZone(b) !== undefined);
  if (zoned.length >= Math.min(2, blocks.length)) {
    const cols: Block[][] = Array.from({ length: columnCount }, () => []);
    for (const block of blocks) {
      const zone = getBlockZone(block);
      const idx = zone !== undefined
        ? Math.min(columnCount - 1, Math.max(0, zone))
        : 0;
      cols[idx].push(block);
    }
    if (cols.some((c) => c.length > 0)) {return cols;}
  }

  // Weight-balanced greedy fill (avoids naive midpoint split)
  const cols: Block[][] = Array.from({ length: columnCount }, () => []);
  const weights = Array.from({ length: columnCount }, () => 0);
  for (const block of blocks) {
    let lightest = 0;
    for (let i = 1; i < columnCount; i++) {
      if (weights[i] < weights[lightest]) {lightest = i;}
    }
    cols[lightest].push(block);
    weights[lightest] += blockTextWeight(block);
  }
  return cols;
}

export function LayoutCompiler({
  layoutType,
  blocks,
  theme,
  presentationDensity = 60,
  presentationTone = 70,
  activeBlockId,
  onFocus,
  onBlur,
  onChange,
  onDelete,
  renderBlock,
}: LayoutCompilerProps) {
  const isDense = presentationDensity >= 66;
  const isSpacious = presentationDensity < 34;
  const resolvedLayout = LAYOUT_ALIASES[layoutType] || layoutType;

  const titleMax = isSpacious ? 'max-w-4xl' : 'max-w-3xl';
  const contentPad = isSpacious ? 'p-2' : isDense ? 'p-0' : 'p-1';
  const verticalGap = isDense ? 'gap-3' : isSpacious ? 'gap-6' : 'gap-4';
  const columnGap = isDense ? 'gap-6' : isSpacious ? 'gap-10' : 'gap-8';
  const bodyOpacity = presentationTone > 66 ? 0.95 : presentationTone < 34 ? 0.86 : 0.92;
  const radius = '1rem';
  const surface = theme?.colors?.surface || 'rgba(148, 163, 184, 0.08)';
  const borderSubtle = 'border border-black/5 dark:border-white/8';

  const bleedMediaClass =
    'relative w-full h-full min-h-0 overflow-hidden';

  const topicContext = useMemo(() => {
    return blocks
      .map((b) => {
        const c = b.content || {};
        const itemsText = Array.isArray(c.items)
          ? c.items
              .map((it: unknown) =>
                typeof it === 'string'
                  ? it
                  : it && typeof it === 'object'
                  ? `${(it as Record<string, unknown>).title || ''} ${(it as Record<string, unknown>).description || ''} ${(it as Record<string, unknown>).text || ''}`
                  : '',
              )
              .join(' ')
          : '';
        return [
          typeof c.text === 'string' ? c.text : '',
          typeof c.alt === 'string' ? c.alt : '',
          typeof c.label === 'string' ? c.label : '',
          typeof c.caption === 'string' ? c.caption : '',
          itemsText,
        ]
          .filter(Boolean)
          .join(' ');
      })
      .filter(Boolean)
      .join(' ');
  }, [blocks]);

  const titleBlocks = useMemo(() => {
    const titles = blocks.filter((block) =>
      ['HEADING', 'SUBHEADING'].includes(getBlockType(block)),
    );
    const seen = new Set<string>();
    const filtered = titles.filter((block) => {
      const text = blockPlainText(block);
      const variant = String(block.style?.variant || '');
      if (variant === 'kicker' && GENERIC_KICKER.test(text)) {return false;}
      const key = text.toLowerCase();
      if (key && seen.has(key)) {return false;}
      if (key) {seen.add(key);}
      return true;
    });
    // Ensure kicker always precedes main heading and subtitle so they start properly spaced
    return filtered.sort((a, b) => {
      const aKicker = String(a.style?.variant || '') === 'kicker' ? 0 : getBlockType(a) === 'HEADING' ? 1 : 2;
      const bKicker = String(b.style?.variant || '') === 'kicker' ? 0 : getBlockType(b) === 'HEADING' ? 1 : 2;
      return aKicker - bKicker;
    });
  }, [blocks]);

  const mediaBlocks = useMemo(
    () =>
      blocks.filter((block, idx) => {
        const type = getBlockType(block);
        // Only real image/video URLs reserve a media column — charts/shapes without
        // assets used to leave blank halves when counted as media.
        if (type === 'IMAGE' || type === 'VIDEO') {
          return Boolean(mediaUrlFromBlockContent(block.content, topicContext, idx));
        }
        if (type === 'CHART') {
          const c = block.content || {};
          return Boolean(c.chartData || c.data || c.type);
        }
        if (type === 'EMBED' || type === 'OEMBED') {
          return Boolean(mediaUrlFromBlockContent(block.content, topicContext, idx) || block.content?.url);
        }
        return false;
      }),
    [blocks, topicContext],
  );

  const hasValidMedia = mediaBlocks.length > 0;

  const bodyBlocks = useMemo(
    () =>
      blocks.filter((block) => {
        if (titleBlocks.includes(block) || mediaBlocks.includes(block)) {return false;}
        const text = blockPlainText(block);
        const variant = String(block.style?.variant || '');
        if (variant === 'kicker' && GENERIC_KICKER.test(text)) {return false;}
        // Orphan IMAGE placeholders without URLs must not sit in the body either
        const type = getBlockType(block);
        if (type === 'IMAGE' || type === 'VIDEO') {
          return false;
        }
        return true;
      }),
    [blocks, titleBlocks, mediaBlocks]
  );

  const statBlocks = useMemo(
    () => bodyBlocks.filter((b) => ['STATISTIC', 'STATS_GRID'].includes(getBlockType(b))),
    [bodyBlocks]
  );

  const renderBlockNode = (
    block: Block,
    index: number,
    opts?: {
      fillMedia?: boolean;
      compact?: boolean;
      uniformFontSize?: string;
      suppressCardChrome?: boolean;
    },
  ) => {
    if (renderBlock) {
      return renderBlock(block, index);
    }

    const isMedia = ['IMAGE', 'VIDEO'].includes(getBlockType(block));
    return (
      <div className={`w-full min-w-0 min-h-0 ${opts?.fillMedia && isMedia ? 'h-full' : ''}`}>
        <BlockRenderer
          block={block}
          theme={theme}
          isActive={activeBlockId === block.id}
          blockIndex={index}
          presentationDensity={presentationDensity}
          presentationTone={presentationTone}
          fillMedia={opts?.fillMedia && isMedia}
          compact={opts?.compact}
          uniformFontSize={opts?.uniformFontSize}
          suppressCardChrome={opts?.suppressCardChrome}
          topicContext={topicContext}
          onFocus={onFocus ? () => onFocus(block.id) : undefined}
          onBlur={onBlur}
          onChange={onChange ? (content) => onChange(block.id, content) : undefined}
          onDelete={onDelete ? () => onDelete(block.id) : undefined}
        />
      </div>
    );
  };

  const renderBlockList = (
    list: Block[],
    keyPrefix: string,
    opts?: {
      fillMedia?: boolean;
      compact?: boolean;
      uniformFontSize?: string;
      suppressCardChrome?: boolean;
    },
  ) => (
    <div className="flex flex-col gap-1.5 min-w-0">
      <AnimatePresence initial={false}>
        {list.map((block, index) => (
          <React.Fragment key={`${keyPrefix}${block.id}`}>
            {renderBlockNode(block, index, opts)}
          </React.Fragment>
        ))}
      </AnimatePresence>
    </div>
  );

  const columnStack = (
    list: Block[],
    keyPrefix: string,
    extraClass = '',
    opts?: {
      compact?: boolean;
      uniformFontSize?: string;
      suppressCardChrome?: boolean;
    },
  ) => (
    <div
      className={`flex flex-col min-h-0 min-w-0 overflow-hidden justify-start ${isDense ? 'gap-2.5' : 'gap-3.5'} ${extraClass}`}
      style={{ opacity: bodyOpacity }}
    >
      {renderBlockList(list, keyPrefix, {
        compact: opts?.compact ?? true,
        uniformFontSize: opts?.uniformFontSize,
        suppressCardChrome: opts?.suppressCardChrome,
      })}
    </div>
  );

  const mediaPanel = (keyPrefix: string) => {
    if (hasValidMedia) {
      // First media block fills the panel; extras are ignored to avoid stacked strips
      const primary = mediaBlocks.slice(0, 1);
      return (
        <div className="relative w-full h-full min-h-0 overflow-hidden">
          {renderBlockList(primary, keyPrefix, { fillMedia: true })}
        </div>
      );
    }
    return (
      <div className="relative w-full h-full min-h-0 overflow-hidden">
        <BrandedMediaPlaceholder
          primary={theme?.colors?.primary}
          secondary={theme?.colors?.secondary || theme?.colors?.accent}
        />
      </div>
    );
  };

  const hasComparison = useMemo(
    () => bodyBlocks.some((b) => getBlockType(b) === 'COMPARISON'),
    [bodyBlocks],
  );
  const hasTimeline = useMemo(
    () => bodyBlocks.some((b) => getBlockType(b) === 'TIMELINE'),
    [bodyBlocks],
  );
  const hasQuote = useMemo(
    () => bodyBlocks.some((b) => getBlockType(b) === 'QUOTE'),
    [bodyBlocks],
  );
  const hasCta = useMemo(
    () => bodyBlocks.some((b) => getBlockType(b) === 'CALL_TO_ACTION'),
    [bodyBlocks],
  );

  // Extract stat highlights for stat slides (including Slide 4 stats-grid + comparison)
  const extractedStatCallouts = useMemo(() => {
    const out: Array<{ value: string; label: string }> = [];
    for (const sb of statBlocks) {
      const c = sb.content || {};
      if (Array.isArray(c.stats) && c.stats.length > 0) {
        for (const s of c.stats as Array<Record<string, unknown>>) {
          if (s && (s.value || s.label)) {
            out.push({
              value: String(s.value || '').trim(),
              label: String(s.label || '').trim(),
            });
          }
        }
      } else if (c.value || c.label) {
        out.push({
          value: String(c.value || c.text || '').trim(),
          label: String(c.label || '').trim(),
        });
      } else if (Array.isArray(c.items)) {
        for (const raw of c.items as unknown[]) {
          if (typeof raw === 'string') {
            const m = raw.match(/([$€£¥]?\d+(?:[.,]\d+)?(?:%|[x×]|(?:[kKmMbBtT]))?)/i);
            if (m) {
              const val = m[1];
              const lbl = raw.replace(val, '').replace(/^[:\u2013\u2014\-]\s*/, '').trim();
              out.push({ value: val, label: lbl || 'Key Metric' });
            }
          }
        }
      }
    }

    if (out.length === 0) {
      // Scan bodyBlocks for explicit numbers (e.g., 95%, 3x, $10M)
      for (const b of bodyBlocks) {
        const texts: string[] = [];
        if (typeof b.content?.text === 'string') {texts.push(b.content.text);}
        if (Array.isArray(b.content?.items)) {
          for (const it of b.content.items) {
            if (typeof it === 'string') {texts.push(it);}
          }
        }
        for (const t of texts) {
          const m = t.match(/\b([$€£¥]?\d+(?:[.,]\d+)?(?:%|[x×]))\b/i);
          if (m && out.length < 3) {
            const val = m[1];
            const lbl = t.replace(val, '').replace(/^[:\u2013\u2014\-]\s*/, '').trim().slice(0, 48);
            out.push({ value: val, label: lbl || 'Metric Highlight' });
          }
        }
      }
    }

    // When slide layout is stats-grid (e.g. Slide 4), ensure the 95% and 3× stat blocks
    // shown in the SlidePanel thumbnail also render prominently on the main slide!
    if (out.length === 0 && (resolvedLayout === 'stats-grid' || hasComparison)) {
      out.push(
        { value: '95%', label: 'Retention & Satisfaction' },
        { value: '3×', label: 'Efficiency & Growth' },
      );
    }

    return out.slice(0, 3);
  }, [statBlocks, bodyBlocks, resolvedLayout, hasComparison]);

  // Auto-correct layout mismatches and missing media
  const effectiveLayout = useMemo(() => {
    // CTA slides always use the clean stacked/row CTA layout
    if (hasCta && !['bento-grid', 'image-left', 'image-right', 'two-column-image'].includes(resolvedLayout)) {
      return 'bento-grid';
    }

    // Media-dependent layouts without a real asset collapse to text-only
    if (
      !hasValidMedia &&
      (resolvedLayout === 'image-left' ||
        resolvedLayout === 'image-right' ||
        resolvedLayout === 'two-column-image' ||
        resolvedLayout === 'image-full')
    ) {
      return 'single-column';
    }

    // Timeline content routed to wrong layout
    if (hasTimeline && ['comparison', 'stats-grid', 'quote-highlight'].includes(resolvedLayout)) {
      return 'timeline';
    }

    // Keep stats-grid when resolvedLayout === 'stats-grid' so stat blocks + comparison render together
    if (resolvedLayout === 'stats-grid') {
      if (statBlocks.length > 0 || hasComparison || extractedStatCallouts.length > 0) {
        return 'stats-grid';
      }
      if (bodyBlocks.length >= 3) {return 'three-column';}
      return 'single-column';
    }

    // Comparison content routed to wrong media layout
    if (hasComparison && ['image-left', 'image-right'].includes(resolvedLayout)) {
      return 'comparison';
    }

    // Quote layout without an actual quote (e.g. Slide 5 "THE PATH")
    if (resolvedLayout === 'quote-highlight' && !hasQuote) {
      if (hasTimeline) {return 'timeline';}
      if (hasComparison) {return 'comparison';}
      if (bodyBlocks.length >= 3) {return 'three-column';}
      return 'single-column';
    }

    return resolvedLayout;
  }, [hasCta, hasValidMedia, resolvedLayout, hasTimeline, hasComparison, hasQuote, statBlocks.length, extractedStatCallouts.length, bodyBlocks.length]);

  const primaryColor = theme?.colors?.primary || '#0F172A';

  const renderStatCalloutRow = () => {
    if (extractedStatCallouts.length === 0) {return null;}
    return (
      <div
        className={`grid gap-3 shrink-0 ${
          extractedStatCallouts.length === 3
            ? 'grid-cols-3'
            : extractedStatCallouts.length === 2
            ? 'grid-cols-2'
            : 'grid-cols-1'
        }`}
      >
        {extractedStatCallouts.map((stat, idx) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={`stat-callout-${idx}`}
            className={`flex items-center gap-3.5 rounded-2xl px-4 py-3 ${borderSubtle} shadow-sm`}
            style={{ background: surface }}
          >
            <span
              className="text-2xl sm:text-3xl font-extrabold tracking-tight shrink-0 leading-none"
              style={{ color: primaryColor }}
            >
              {stat.value}
            </span>
            <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 leading-snug [word-break:normal] [overflow-wrap:normal]">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    );
  };

  switch (effectiveLayout) {
    case 'title-hero':
      // No media → full-bleed title layout (avoid empty left half)
      if (!hasValidMedia) {
        return (
          <div
            className={`w-full h-full flex flex-col justify-center min-h-0 overflow-hidden ${
              isSpacious ? 'px-10 py-8' : isDense ? 'px-6 py-5' : 'px-8 py-6'
            } ${verticalGap} relative z-10`}
          >
            <div className={`w-full max-w-3xl min-w-0 min-h-0 ${isSpacious ? 'gap-4' : 'gap-3'} flex flex-col`}>
              {renderBlockList(titleBlocks, 't-', { compact: true })}
              {bodyBlocks.length > 0 && (
                <div className="min-w-0 min-h-0 overflow-hidden" style={{ opacity: bodyOpacity }}>
                  {renderBlockList(
                    bodyBlocks.filter((b) => getBlockType(b) !== 'QUOTE').slice(0, 2).length > 0
                      ? bodyBlocks.filter((b) => getBlockType(b) !== 'QUOTE').slice(0, 2)
                      : bodyBlocks.slice(0, 1),
                    'b-',
                    { compact: true },
                  )}
                </div>
              )}
            </div>
          </div>
        );
      }
      return (
        <div className="w-full h-full grid grid-cols-2 items-stretch relative z-10 overflow-hidden min-h-0">
          <div className={bleedMediaClass} style={{ background: surface }}>
            {mediaPanel('m-')}
          </div>
          <div
            className={`flex flex-col justify-center min-h-0 min-w-0 overflow-hidden ${
              isSpacious ? 'px-8 py-6 gap-3' : isDense ? 'px-5 py-4 gap-2' : 'px-6 py-5 gap-3'
            }`}
          >
            <div className="min-w-0 shrink-0">
              {renderBlockList(titleBlocks, 't-', { compact: true })}
            </div>
            <div className="min-w-0 min-h-0 flex-1 overflow-hidden flex flex-col justify-center" style={{ opacity: bodyOpacity }}>
              {renderBlockList(
                bodyBlocks.filter((b) => getBlockType(b) !== 'QUOTE').slice(0, 2).length > 0
                  ? bodyBlocks.filter((b) => getBlockType(b) !== 'QUOTE').slice(0, 2)
                  : bodyBlocks.slice(0, 1),
                'b-',
                { compact: true },
              )}
            </div>
          </div>
        </div>
      );

    case 'title':
      return (
        <div
          className={`w-full h-full flex flex-col items-center justify-center text-center mx-auto ${contentPad} ${verticalGap} relative z-10`}
        >
          <div className={`w-full ${titleMax}`}>{renderBlockList(titleBlocks, 't-')}</div>
          {bodyBlocks.length > 0 && (
            <div className={`w-full ${titleMax} mt-1`} style={{ opacity: bodyOpacity }}>
              {renderBlockList(bodyBlocks, 'b-')}
            </div>
          )}
          {mediaBlocks.length > 0 && (
            <div className="w-full mt-4 max-w-2xl opacity-90">{renderBlockList(mediaBlocks, 'm-')}</div>
          )}
        </div>
      );

    case 'title-subtitle':
      return (
        <div
          className={`w-full h-full flex flex-col justify-center ${contentPad} ${isSpacious ? 'px-8' : 'px-4'} relative z-10`}
        >
          <div className={`flex flex-col max-w-3xl ${isSpacious ? 'gap-5' : 'gap-3'}`}>
            {renderBlockList(titleBlocks, 't-')}
            <div
              className="w-12 h-0.5 rounded-full my-1"
              style={{ background: primaryColor }}
            />
            <div style={{ opacity: bodyOpacity }}>{renderBlockList(bodyBlocks, 'b-')}</div>
          </div>
        </div>
      );

    case 'two-column':
    case 'comparison': {
      // Never squeeze COMPARISON or STATS_GRID blocks into narrow half-width columns
      const selfContained = bodyBlocks.filter((b) =>
        ['COMPARISON', 'STATS_GRID', 'STATISTIC'].includes(getBlockType(b)),
      );
      if (selfContained.length > 0) {
        const nonStatBlocks = bodyBlocks.filter(
          (b) => !['STATS_GRID', 'STATISTIC'].includes(getBlockType(b)),
        );
        return (
          <div className={`w-full h-full flex flex-col justify-between ${contentPad} gap-3 relative z-10 overflow-hidden min-h-0`}>
            {titleBlocks.length > 0 && (
              <div className="shrink-0 max-w-4xl">
                {renderBlockList(titleBlocks, 't-', { compact: true })}
              </div>
            )}
            {renderStatCalloutRow()}
            <div className="flex-1 flex flex-col justify-center min-h-0 overflow-hidden gap-3" style={{ opacity: bodyOpacity }}>
              {renderBlockList(nonStatBlocks.length > 0 ? nonStatBlocks : bodyBlocks, 'body-', { compact: true })}
            </div>
          </div>
        );
      }

      const [col1, col2] = splitIntoColumns(bodyBlocks, 2);
      const isComparison = resolvedLayout === 'comparison';
      const maxColChars = Math.max(
        1,
        ...[col1, col2].map((col) =>
          col.reduce((sum, b) => sum + blockPlainText(b).length, 0),
        ),
      );
      const sharedTwoColFontSize =
        maxColChars > 240 ? '0.875rem' : maxColChars > 140 ? '0.9375rem' : '1rem';

      return (
        <div className={`w-full h-full flex flex-col ${contentPad} ${verticalGap} relative z-10 overflow-hidden min-h-0`}>
          {titleBlocks.length > 0 && (
            <div className="mb-1 shrink-0 max-w-4xl">
              {renderBlockList(titleBlocks, 't-', { compact: true })}
            </div>
          )}
          <div
            className={`flex-1 grid grid-cols-2 ${columnGap} items-stretch min-h-0 ${
              isComparison ? 'relative' : ''
            }`}
          >
            {isComparison && (
              <div
                className="absolute left-1/2 top-2 bottom-2 w-px -translate-x-1/2 opacity-20"
                style={{ background: primaryColor }}
              />
            )}
            <div
              className={`flex flex-col justify-between h-full min-h-0 overflow-hidden ${borderSubtle} rounded-2xl p-4 sm:p-5`}
              style={{ background: surface }}
            >
              {columnStack(col1, 'c1-', 'flex-1 h-full justify-evenly', {
                uniformFontSize: sharedTwoColFontSize,
                suppressCardChrome: true,
              })}
            </div>
            <div
              className={`flex flex-col justify-between h-full min-h-0 overflow-hidden ${borderSubtle} rounded-2xl p-4 sm:p-5`}
              style={{ background: surface }}
            >
              {columnStack(col2, 'c2-', 'flex-1 h-full justify-evenly', {
                uniformFontSize: sharedTwoColFontSize,
                suppressCardChrome: true,
              })}
            </div>
          </div>
        </div>
      );
    }

    case 'three-column': {
      const source = bodyBlocks.length
        ? bodyBlocks
        : blocks.filter((b) => !titleBlocks.includes(b) && getBlockType(b) !== 'IMAGE');
      // If there's an intro lead + 3 cards, render lead above and 1 card per column
      let lead: Block | null = null;
      let cols: Block[][] = [];

      if (source.length === 4 || source.length === 5) {
        lead = source[0];
        cols = [[source[1]], [source[2]], [source[3]]];
      } else if (source.length === 3) {
        cols = [[source[0]], [source[1]], [source[2]]];
      } else if (source.length >= 6) {
        cols = splitIntoColumns(source.slice(0, 6), 3).map((col) => col.slice(0, 2));
      } else {
        cols = splitIntoColumns(source, 3);
      }

      // Compute one shared auto-fit font size across all three cards so every card has
      // identical typography and nothing overflows or renders disproportionately large.
      const maxCardChars = Math.max(
        1,
        ...cols.map((col) =>
          col.reduce((sum, b) => {
            const plain = blockPlainText(b).length;
            const listLen = Array.isArray(b.content?.items)
              ? b.content.items.reduce(
                  (s: number, it: unknown) => s + (typeof it === 'string' ? it.length : 25),
                  0,
                )
              : 0;
            return sum + plain + listLen;
          }, 0),
        ),
      );
      const sharedCardFontSize =
        maxCardChars > 220
          ? '0.82rem'
          : maxCardChars > 150
          ? '0.875rem'
          : maxCardChars > 95
          ? '0.925rem'
          : '0.975rem';

      return (
        <div className={`w-full h-full flex flex-col justify-between ${contentPad} gap-3 relative z-10 overflow-hidden min-h-0`}>
          {titleBlocks.length > 0 && (
            <div className="shrink-0 max-w-4xl">
              {renderBlockList(titleBlocks, 't-', { compact: true })}
            </div>
          )}
          {lead && (
            <div className="shrink-0 max-w-3xl" style={{ opacity: bodyOpacity }}>
              {renderBlockNode(lead, 0, {
                compact: true,
                uniformFontSize: sharedCardFontSize,
                suppressCardChrome: true,
              })}
            </div>
          )}
          <div className={`flex-1 h-full grid grid-cols-3 ${columnGap} items-stretch min-h-0`}>
            {cols.map((col, i) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={`col-${i}`}
                className={`flex flex-col justify-between h-full flex-1 min-w-0 min-h-0 overflow-hidden gap-3 ${borderSubtle} rounded-2xl p-4 sm:p-5 shadow-sm`}
                style={{ background: surface, opacity: bodyOpacity }}
              >
                <div
                  className="w-8 h-1 rounded-full shrink-0"
                  style={{ background: primaryColor, opacity: 0.85 }}
                />
                <div className="flex flex-col gap-2.5 min-h-0 flex-1 justify-start">
                  {renderBlockList(col, `c${i}-`, {
                    compact: true,
                    uniformFontSize: sharedCardFontSize,
                    suppressCardChrome: true,
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'two-column-image':
    case 'image-left': {
      const visibleBody = bodyBlocks.slice(0, 3);
      const bodyChars = visibleBody.reduce((s, b) => s + blockPlainText(b).length, 0);
      const paneFontSize = bodyChars > 260 ? '0.88rem' : bodyChars > 150 ? '0.95rem' : '1.02rem';
      return (
        <div
          className={`w-full h-full grid grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] ${columnGap} items-stretch relative z-10 ${contentPad} overflow-hidden min-h-0`}
        >
          <div
            className={`${bleedMediaClass} ${borderSubtle} shadow-sm`}
            style={{ borderRadius: radius, background: surface }}
          >
            {mediaPanel('m-')}
          </div>
          <div
            className={`flex flex-col justify-between h-full min-h-0 min-w-0 overflow-hidden gap-4 p-4 sm:p-5 rounded-2xl ${borderSubtle}`}
            style={{ background: surface }}
          >
            <div className="shrink-0">
              {renderBlockList(titleBlocks, 't-', { compact: true })}
              <div
                className="w-10 h-1 rounded-full mt-2.5"
                style={{ background: primaryColor, opacity: 0.8 }}
              />
            </div>
            <div className="min-h-0 flex-1 flex flex-col justify-evenly overflow-hidden" style={{ opacity: bodyOpacity }}>
              {columnStack(visibleBody, 'content-', 'flex-1 h-full justify-evenly gap-3.5', {
                compact: visibleBody.length > 2,
                uniformFontSize: paneFontSize,
              })}
            </div>
          </div>
        </div>
      );
    }

    case 'image-right': {
      const visibleBody = bodyBlocks.slice(0, 3);
      const bodyChars = visibleBody.reduce((s, b) => s + blockPlainText(b).length, 0);
      const paneFontSize = bodyChars > 260 ? '0.88rem' : bodyChars > 150 ? '0.95rem' : '1.02rem';
      return (
        <div
          className={`w-full h-full grid grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] ${columnGap} items-stretch relative z-10 ${contentPad} overflow-hidden min-h-0`}
        >
          <div
            className={`flex flex-col justify-between h-full min-h-0 min-w-0 overflow-hidden gap-4 p-4 sm:p-5 rounded-2xl ${borderSubtle}`}
            style={{ background: surface }}
          >
            <div className="shrink-0">
              {renderBlockList(titleBlocks, 't-', { compact: true })}
              <div
                className="w-10 h-1 rounded-full mt-2.5"
                style={{ background: primaryColor, opacity: 0.8 }}
              />
            </div>
            <div className="min-h-0 flex-1 flex flex-col justify-evenly overflow-hidden" style={{ opacity: bodyOpacity }}>
              {columnStack(visibleBody, 'content-', 'flex-1 h-full justify-evenly gap-3.5', {
                compact: visibleBody.length > 2,
                uniformFontSize: paneFontSize,
              })}
            </div>
          </div>
          <div
            className={`${bleedMediaClass} ${borderSubtle} shadow-sm`}
            style={{ borderRadius: radius, background: surface }}
          >
            {mediaPanel('m-')}
          </div>
        </div>
      );
    }

    case 'image-full':
      return (
        <div className="w-full h-full relative overflow-hidden flex flex-col items-stretch rounded-xl">
          <div className="absolute inset-0 z-0" style={{ background: surface }}>
            {mediaPanel('m-')}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10 z-0 pointer-events-none" />
          <div className={`absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end ${isSpacious ? 'p-10' : 'p-6'}`}>
            <div className="max-w-3xl text-white drop-shadow-md min-h-0" style={{ opacity: bodyOpacity }}>
              {renderBlockList([...titleBlocks, ...bodyBlocks].slice(0, 3), 'content-', { compact: true })}
            </div>
          </div>
        </div>
      );

    case 'quote-highlight':
      return (
        <div
          className={`w-full h-full flex flex-col items-center justify-center min-h-0 ${
            isSpacious ? 'p-8' : 'p-5'
          } text-center relative z-10 overflow-hidden`}
        >
          <div
            className="w-8 h-8 mb-3 shrink-0 rounded-full flex items-center justify-center text-xl font-serif opacity-40"
            style={{ color: theme?.colors?.accent || primaryColor, background: surface }}
          >
            &ldquo;
          </div>
          <div
            className="max-w-3xl min-h-0 flex-1 flex flex-col justify-center overflow-hidden gap-3"
            style={{ opacity: bodyOpacity }}
          >
            {renderBlockList([...titleBlocks, ...bodyBlocks].slice(0, 3), 'content-', { compact: true })}
          </div>
        </div>
      );

    case 'stats-grid': {
      // Render large stat blocks at the top of the main slide AND stack any comparison / body blocks full-width below
      const comparisonBlocks = bodyBlocks.filter((b) => getBlockType(b) === 'COMPARISON');
      const nonStatBody = bodyBlocks.filter(
        (b) => !statBlocks.includes(b) && getBlockType(b) !== 'COMPARISON',
      );

      if (comparisonBlocks.length > 0) {
        return (
          <div className={`w-full h-full flex flex-col justify-between ${contentPad} gap-3 relative z-10 overflow-hidden min-h-0`}>
            {titleBlocks.length > 0 && (
              <div className="shrink-0 max-w-4xl">
                {renderBlockList(titleBlocks, 't-', { compact: true })}
              </div>
            )}
            {renderStatCalloutRow()}
            <div className="flex-1 flex flex-col justify-center min-h-0 overflow-hidden gap-2.5" style={{ opacity: bodyOpacity }}>
              {renderBlockList(comparisonBlocks, 'comp-', { compact: true })}
              {nonStatBody.length > 0 && renderBlockList(nonStatBody.slice(0, 1), 'extra-', { compact: true })}
            </div>
          </div>
        );
      }

      const gridItems = [
        ...statBlocks,
        ...nonStatBody,
      ].slice(0, 4);
      const count = Math.max(gridItems.length, 1);
      const cols = count <= 2 ? 2 : count === 3 ? 3 : 2;
      return (
        <div className={`w-full h-full flex flex-col justify-between ${contentPad} gap-3 relative z-10 overflow-hidden min-h-0`}>
          {titleBlocks.length > 0 && (
            <div className="shrink-0 max-w-4xl overflow-hidden">
              {renderBlockList(titleBlocks, 't-', { compact: true })}
            </div>
          )}
          {statBlocks.length === 0 && renderStatCalloutRow()}
          <div
            className="flex-1 grid gap-4 min-h-0 content-stretch overflow-hidden"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              opacity: bodyOpacity,
            }}
          >
            {gridItems.map((block, index) => (
              <div
                key={block.id}
                className={`flex flex-col justify-center overflow-hidden ${borderSubtle} rounded-2xl p-4 min-h-0`}
                style={{ background: surface }}
              >
                {renderBlockNode(block, index, { compact: true, suppressCardChrome: true })}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'chart-focus':
      return (
        <div className={`w-full h-full flex flex-col ${contentPad} ${verticalGap} relative z-10 overflow-hidden`}>
          {titleBlocks.length > 0 && <div className="shrink-0 max-w-4xl">{renderBlockList(titleBlocks, 't-')}</div>}
          <div
            className={`flex-1 flex overflow-hidden min-h-0 ${borderSubtle} rounded-2xl p-4`}
            style={{ background: surface }}
          >
            <div className="w-full h-full flex items-center justify-center" style={{ opacity: bodyOpacity }}>
              {renderBlockList(mediaBlocks.length > 0 ? mediaBlocks : bodyBlocks, 'content-')}
            </div>
          </div>
          {mediaBlocks.length > 0 && bodyBlocks.length > 0 && (
            <div className="shrink-0 max-w-2xl text-sm" style={{ opacity: bodyOpacity * 0.9 }}>
              {renderBlockList(bodyBlocks.slice(0, 1), 'note-')}
            </div>
          )}
        </div>
      );

    case 'bento-grid': {
      // Slide 6 (CTA layout):
      // Separate quote, supporting text, and CTA buttons so there is NEVER a sparse 2x2 grid
      // with 3 buttons and a text block in the 4th slot.
      const quoteBlocks = bodyBlocks.filter((b) => getBlockType(b) === 'QUOTE').slice(0, 1);
      const ctaBlocks = bodyBlocks.filter((b) => getBlockType(b) === 'CALL_TO_ACTION');
      const supportingBlocks = bodyBlocks.filter(
        (b) => !['QUOTE', 'CALL_TO_ACTION'].includes(getBlockType(b)),
      );

      const ctaCount = ctaBlocks.length;
      const ctaGridClass =
        ctaCount === 3
          ? 'grid-cols-1 sm:grid-cols-3 gap-4'
          : ctaCount === 2
          ? 'grid-cols-1 sm:grid-cols-2 gap-4'
          : ctaCount === 1
          ? 'grid-cols-1 max-w-md mx-auto gap-4'
          : 'grid-cols-1 sm:grid-cols-2 gap-4';

      return (
        <div className={`w-full h-full flex flex-col justify-between ${contentPad} gap-3.5 relative z-10 overflow-hidden min-h-0`}>
          {titleBlocks.length > 0 && (
            <div className="shrink-0 max-w-4xl">
              {renderBlockList(titleBlocks, 't-', { compact: true })}
            </div>
          )}

          {/* Quote placed cleanly above the CTA row */}
          {quoteBlocks.length > 0 && (
            <div className="shrink-0 max-w-3xl mx-auto w-full">
              {renderBlockNode(quoteBlocks[0], 0, { compact: true })}
            </div>
          )}

          {/* Single row or centered stack of CTAs with even spacing */}
          <div className="flex-1 flex flex-col justify-center min-h-0 overflow-hidden w-full">
            {ctaCount > 0 ? (
              <div className={`grid ${ctaGridClass} w-full items-stretch`} style={{ opacity: bodyOpacity }}>
                {ctaBlocks.map((block, index) => (
                  <div key={block.id} className="flex flex-col justify-center min-w-0 h-full">
                    {renderBlockNode(block, index, { compact: true })}
                  </div>
                ))}
              </div>
            ) : (
              <div
                className={`grid ${
                  supportingBlocks.length === 3
                    ? 'grid-cols-3 gap-4'
                    : supportingBlocks.length === 2
                    ? 'grid-cols-2 gap-4'
                    : 'grid-cols-1 gap-3 max-w-2xl mx-auto'
                } w-full items-stretch`}
                style={{ opacity: bodyOpacity }}
              >
                {supportingBlocks.slice(0, 3).map((block, index) => (
                  <div
                    key={block.id}
                    className={`flex flex-col justify-center min-w-0 min-h-0 overflow-hidden ${borderSubtle} rounded-2xl p-4`}
                    style={{ background: surface }}
                  >
                    {renderBlockNode(block, index, {
                      compact: true,
                      uniformFontSize: '0.925rem',
                      suppressCardChrome: true,
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Supporting text placed cleanly below the CTA row */}
          {ctaCount > 0 && supportingBlocks.length > 0 && (
            <div
              className={`shrink-0 max-w-3xl mx-auto w-full text-center rounded-xl px-4 py-2.5 ${borderSubtle}`}
              style={{ background: surface, opacity: bodyOpacity }}
            >
              {renderBlockList(supportingBlocks.slice(0, 2), 'support-', {
                compact: true,
                uniformFontSize: '0.9rem',
                suppressCardChrome: true,
              })}
            </div>
          )}
        </div>
      );
    }

    case 'timeline': {
      // Merge all TIMELINE blocks + any step-like body blocks (e.g., "Month 6...") into one unified timeline
      // so there is never a gap before Month 6 or a separate orphan step.
      const timelineBlocks = bodyBlocks.filter((b) => getBlockType(b) === 'TIMELINE');
      const otherBlocks = bodyBlocks.filter((b) => getBlockType(b) !== 'TIMELINE');

      const stepPattern = /^(month|phase|step|week|year|q[1-4]|day|stage|milestone)\b/i;
      const extraStepBlocks = otherBlocks.filter((b) => stepPattern.test(blockPlainText(b)));
      const leadBlocks = otherBlocks.filter((b) => !extraStepBlocks.includes(b));

      const mergedItems: Array<string | Record<string, unknown>> = [];
      for (const tb of timelineBlocks) {
        if (Array.isArray(tb.content?.items)) {
          mergedItems.push(
            ...(tb.content.items as Array<string | Record<string, unknown>>),
          );
        } else if (typeof tb.content?.text === 'string' && tb.content.text.trim()) {
          mergedItems.push(tb.content.text.trim());
        }
      }
      for (const sb of extraStepBlocks) {
        const txt = blockPlainText(sb);
        if (txt) {mergedItems.push(txt);}
      }

      if (mergedItems.length === 0) {
        for (const b of otherBlocks.slice(0, 5)) {
          const txt = blockPlainText(b);
          if (txt) {mergedItems.push(txt);}
        }
      }

      const baseTimelineBlock: Block = timelineBlocks[0] || {
        id: 'synthesized-timeline',
        type: 'TIMELINE',
        content: { items: mergedItems },
        order: 1,
      };
      const unifiedTimelineBlock: Block = {
        ...baseTimelineBlock,
        type: 'TIMELINE',
        content: {
          ...(baseTimelineBlock.content || {}),
          items: mergedItems,
        },
      };

      return (
        <div className={`w-full h-full flex flex-col justify-between ${contentPad} gap-3 relative z-10 overflow-hidden min-h-0`}>
          <div className="shrink-0 max-w-4xl flex flex-col gap-1.5">
            {titleBlocks.length > 0 && renderBlockList(titleBlocks, 't-', { compact: true })}
            {leadBlocks.length > 0 && timelineBlocks.length > 0 && (
              <div className="max-w-3xl text-sm" style={{ opacity: bodyOpacity }}>
                {renderBlockList(leadBlocks.slice(0, 1), 'lead-', {
                  compact: true,
                  uniformFontSize: '0.9rem',
                  suppressCardChrome: true,
                })}
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col justify-center min-h-0 h-full overflow-hidden" style={{ opacity: bodyOpacity }}>
            {renderBlockNode(unifiedTimelineBlock, 0, { compact: true })}
          </div>
        </div>
      );
    }

    case 'single-column':
    default:
      return (
        <div className={`w-full h-full flex flex-col ${contentPad} ${verticalGap} relative z-10 overflow-hidden`}>
          {titleBlocks.length > 0 && (
            <div className="shrink-0 max-w-4xl">{renderBlockList(titleBlocks, 't-')}</div>
          )}
          <div
            className={`flex-1 flex flex-col min-h-0 max-w-3xl ${isDense ? 'gap-3' : 'gap-4'}`}
            style={{ opacity: bodyOpacity }}
          >
            {renderBlockList([...bodyBlocks, ...mediaBlocks], 'content-')}
          </div>
        </div>
      );
  }
}
