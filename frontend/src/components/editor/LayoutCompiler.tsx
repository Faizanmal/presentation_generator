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

  const titleBlocks = useMemo(() => {
    const titles = blocks.filter((block) =>
      ['HEADING', 'SUBHEADING'].includes(getBlockType(block)),
    );
    const seen = new Set<string>();
    return titles.filter((block) => {
      const text = blockPlainText(block);
      const variant = String(block.style?.variant || '');
      if (variant === 'kicker' && GENERIC_KICKER.test(text)) {return false;}
      const key = text.toLowerCase();
      if (key && seen.has(key)) {return false;}
      if (key) {seen.add(key);}
      return true;
    });
  }, [blocks]);

  const mediaBlocks = useMemo(
    () =>
      blocks.filter((block) => {
        const type = getBlockType(block);
        // Only real image/video URLs reserve a media column — charts/shapes without
        // assets used to leave blank halves when counted as media.
        if (type === 'IMAGE' || type === 'VIDEO') {
          return Boolean(mediaUrlFromBlockContent(block.content));
        }
        if (type === 'CHART') {
          const c = block.content || {};
          return Boolean(c.chartData || c.data || c.type);
        }
        if (type === 'EMBED' || type === 'OEMBED') {
          return Boolean(mediaUrlFromBlockContent(block.content) || block.content?.url);
        }
        return false;
      }),
    [blocks],
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
    opts?: { fillMedia?: boolean; compact?: boolean },
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
    opts?: { fillMedia?: boolean; compact?: boolean },
  ) => (
    <AnimatePresence initial={false}>
      {list.map((block, index) => (
        <React.Fragment key={`${keyPrefix}${block.id}`}>
          {renderBlockNode(block, index, opts)}
        </React.Fragment>
      ))}
    </AnimatePresence>
  );

  const columnStack = (
    list: Block[],
    keyPrefix: string,
    extraClass = '',
    opts?: { compact?: boolean },
  ) => (
    <div
      className={`flex flex-col min-h-0 min-w-0 overflow-hidden justify-start ${isDense ? 'gap-2' : 'gap-3'} ${extraClass}`}
      style={{ opacity: bodyOpacity }}
    >
      {renderBlockList(list, keyPrefix, { compact: opts?.compact ?? true })}
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

  // Auto-correct layout mismatches and missing media
  const effectiveLayout = useMemo(() => {
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

    // Comparison content routed to wrong layout
    if (hasComparison && ['stats-grid', 'image-left', 'image-right'].includes(resolvedLayout)) {
      return 'comparison';
    }

    // Quote layout without an actual quote (e.g. Slide 5 "THE PATH")
    if (resolvedLayout === 'quote-highlight' && !hasQuote) {
      if (hasTimeline) return 'timeline';
      if (hasComparison) return 'comparison';
      if (bodyBlocks.length >= 3) return 'three-column';
      return 'single-column';
    }

    // Stats-grid layout without actual stats
    if (resolvedLayout === 'stats-grid' && statBlocks.length === 0 && !hasComparison) {
      if (bodyBlocks.length >= 3) return 'three-column';
      return 'single-column';
    }

    return resolvedLayout;
  }, [hasValidMedia, resolvedLayout, hasTimeline, hasComparison, hasQuote, statBlocks.length, bodyBlocks.length]);

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
            <div className="min-w-0 min-h-0 flex-1 overflow-hidden" style={{ opacity: bodyOpacity }}>
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
              style={{ background: theme?.colors?.primary || '#0F172A' }}
            />
            <div style={{ opacity: bodyOpacity }}>{renderBlockList(bodyBlocks, 'b-')}</div>
          </div>
        </div>
      );

    case 'two-column':
    case 'comparison': {
      // A single COMPARISON/STATS block already draws its own grid — don't re-split.
      const selfContained = bodyBlocks.filter((b) =>
        ['COMPARISON', 'STATS_GRID', 'STATISTIC'].includes(getBlockType(b)),
      );
      if (selfContained.length === 1 && bodyBlocks.length <= 2) {
        return (
          <div className={`w-full h-full flex flex-col ${contentPad} ${verticalGap} relative z-10 overflow-hidden min-h-0`}>
            {titleBlocks.length > 0 && (
              <div className="mb-1 shrink-0 max-w-4xl">
                {renderBlockList(titleBlocks, 't-', { compact: true })}
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-hidden" style={{ opacity: bodyOpacity }}>
              {renderBlockList(bodyBlocks, 'body-', { compact: true })}
            </div>
          </div>
        );
      }

      const [col1, col2] = splitIntoColumns(bodyBlocks, 2);
      const isComparison = resolvedLayout === 'comparison';

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
                style={{ background: theme?.colors?.primary || '#64748B' }}
              />
            )}
            <div
              className={`min-h-0 overflow-hidden ${borderSubtle} rounded-2xl p-3`}
              style={{ background: surface }}
            >
              {columnStack(col1, 'c1-')}
            </div>
            <div
              className={`min-h-0 overflow-hidden ${borderSubtle} rounded-2xl p-3`}
              style={{ background: surface }}
            >
              {columnStack(col2, 'c2-')}
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

      return (
        <div className={`w-full h-full flex flex-col ${contentPad} gap-2.5 relative z-10 overflow-hidden min-h-0`}>
          {titleBlocks.length > 0 && (
            <div className="shrink-0 max-w-4xl">
              {renderBlockList(titleBlocks, 't-', { compact: true })}
            </div>
          )}
          {lead && (
            <div className="shrink-0 max-w-3xl text-sm" style={{ opacity: bodyOpacity }}>
              {renderBlockNode(lead, 0, { compact: true })}
            </div>
          )}
          <div className={`flex-1 grid grid-cols-3 ${columnGap} items-stretch min-h-0`}>
            {cols.map((col, i) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={`col-${i}`}
                className={`flex flex-col justify-between h-full flex-1 min-w-0 min-h-0 overflow-hidden gap-3 ${borderSubtle} rounded-2xl p-4 sm:p-5`}
                style={{ background: surface, opacity: bodyOpacity }}
              >
                <div className="flex flex-col gap-2 min-h-0 flex-1 justify-start">
                  {renderBlockList(col, `c${i}-`, { compact: true })}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'two-column-image':
    case 'image-left':
      return (
        <div
          className={`w-full h-full grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] ${columnGap} items-stretch relative z-10 ${contentPad} overflow-hidden min-h-0`}
        >
          <div
            className={`${bleedMediaClass} ${borderSubtle} shadow-sm`}
            style={{ borderRadius: radius, background: surface }}
          >
            {mediaPanel('m-')}
          </div>
          <div className="flex flex-col justify-center min-h-0 min-w-0 overflow-hidden gap-3 py-1">
            <div className="shrink-0">{renderBlockList(titleBlocks, 't-', { compact: true })}</div>
            <div className="min-h-0 flex-1 overflow-hidden" style={{ opacity: bodyOpacity }}>
              {columnStack(bodyBlocks.slice(0, 3), 'content-', '', { compact: true })}
            </div>
          </div>
        </div>
      );

    case 'image-right':
      return (
        <div
          className={`w-full h-full grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] ${columnGap} items-stretch relative z-10 ${contentPad} overflow-hidden min-h-0`}
        >
          <div className="flex flex-col justify-center min-h-0 min-w-0 overflow-hidden gap-3 py-1">
            <div className="shrink-0">{renderBlockList(titleBlocks, 't-', { compact: true })}</div>
            <div className="min-h-0 flex-1 overflow-hidden" style={{ opacity: bodyOpacity }}>
              {columnStack(bodyBlocks.slice(0, 3), 'content-', '', { compact: true })}
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
            style={{ color: theme?.colors?.accent || theme?.colors?.primary, background: surface }}
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
      // If a self-contained COMPARISON or TIMELINE block ended up here, render it full-width
      const comparisonBlock = bodyBlocks.find((b) => getBlockType(b) === 'COMPARISON');
      if (comparisonBlock) {
        return (
          <div className={`w-full h-full flex flex-col ${contentPad} ${verticalGap} relative z-10 overflow-hidden min-h-0`}>
            {titleBlocks.length > 0 && (
              <div className="mb-1 shrink-0 max-w-4xl">
                {renderBlockList(titleBlocks, 't-', { compact: true })}
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-hidden" style={{ opacity: bodyOpacity }}>
              {renderBlockNode(comparisonBlock, 0, { compact: true })}
            </div>
          </div>
        );
      }

      // Prefer stats + short body; keep images out of the card grid to avoid overlap
      const gridItems = [
        ...statBlocks,
        ...bodyBlocks.filter((b) => !statBlocks.includes(b)),
      ].slice(0, 4);
      const count = Math.max(gridItems.length, 1);
      const cols = count <= 2 ? 2 : count === 3 ? 3 : 2;
      return (
        <div className={`w-full h-full flex flex-col ${contentPad} ${verticalGap} relative z-10 overflow-hidden min-h-0`}>
          {titleBlocks.length > 0 && (
            <div className="shrink-0 max-w-4xl overflow-hidden max-h-[28%]">
              {renderBlockList(titleBlocks, 't-')}
            </div>
          )}
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
                className={`flex flex-col justify-center overflow-hidden ${borderSubtle} rounded-2xl p-3 min-h-0`}
                style={{ background: surface }}
              >
                {renderBlockNode(block, index, { compact: true })}
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
      // Clean CTA / Next Steps layout:
      // Separate quote from buttons/cards to eliminate sparse 2x2 grid with empty gap
      const quoteBlock = bodyBlocks.find((b) => getBlockType(b) === 'QUOTE');
      const actionBlocks = bodyBlocks.filter((b) => b !== quoteBlock).slice(0, 4);
      const isCards = actionBlocks.some((b) => getBlockType(b) !== 'CALL_TO_ACTION');

      return (
        <div className={`w-full h-full flex flex-col justify-between ${contentPad} gap-4 relative z-10 overflow-hidden min-h-0`}>
          {titleBlocks.length > 0 && (
            <div className="shrink-0 max-w-4xl">
              {renderBlockList(titleBlocks, 't-', { compact: true })}
            </div>
          )}

          {/* Quote placed cleanly above buttons if present */}
          {quoteBlock && (
            <div className="shrink-0 max-w-2xl mx-auto w-full">
              {renderBlockNode(quoteBlock, 0, { compact: true })}
            </div>
          )}

          {/* Actions / CTA buttons or cards centered consistently */}
          <div className="flex-1 flex flex-col justify-center min-h-0 overflow-hidden">
            {isCards ? (
              <div
                className={`grid ${
                  actionBlocks.length === 2
                    ? 'grid-cols-2 gap-5'
                    : actionBlocks.length === 3
                    ? 'grid-cols-3 gap-4'
                    : 'grid-cols-2 gap-4'
                } min-h-0 items-stretch`}
                style={{ opacity: bodyOpacity }}
              >
                {actionBlocks.map((block, index) => {
                  const type = getBlockType(block);
                  const isSelfStyled = type === 'CALL_TO_ACTION' || type === 'QUOTE';
                  return (
                    <div
                      key={block.id}
                      className={`flex flex-col justify-center min-w-0 min-h-0 overflow-hidden ${
                        isSelfStyled ? 'p-0' : `${borderSubtle} rounded-2xl p-4`
                      }`}
                      style={{ background: isSelfStyled ? 'transparent' : surface }}
                    >
                      {renderBlockNode(block, index, { compact: true })}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-4 py-2">
                {actionBlocks.map((block, index) => (
                  <div key={block.id} className="min-w-0">
                    {renderBlockNode(block, index, { compact: false })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    case 'timeline': {
      // Check if bodyBlocks contains a rich TIMELINE block
      const timelineBlock = bodyBlocks.find((b) => getBlockType(b) === 'TIMELINE');
      if (timelineBlock) {
        const otherBody = bodyBlocks.filter((b) => b !== timelineBlock);
        return (
          <div className={`w-full h-full flex flex-col justify-between ${contentPad} gap-4 relative z-10 overflow-hidden min-h-0`}>
            {titleBlocks.length > 0 && (
              <div className="shrink-0 max-w-4xl">
                {renderBlockList(titleBlocks, 't-', { compact: true })}
              </div>
            )}
            {otherBody.length > 0 && (
              <div className="shrink-0 max-w-3xl text-sm" style={{ opacity: bodyOpacity }}>
                {renderBlockList(otherBody.slice(0, 1), 'lead-', { compact: true })}
              </div>
            )}
            <div className="flex-1 flex flex-col justify-center my-auto min-h-0 overflow-hidden" style={{ opacity: bodyOpacity }}>
              {renderBlockNode(timelineBlock, 0, { compact: true })}
            </div>
          </div>
        );
      }

      // Fallback for step paragraphs without a TIMELINE block
      const steps = bodyBlocks
        .filter((b) => !['IMAGE', 'VIDEO', 'CHART'].includes(getBlockType(b)))
        .slice(0, 5);
      return (
        <div className={`w-full h-full flex flex-col justify-between ${contentPad} gap-4 relative z-10 overflow-hidden min-h-0`}>
          {titleBlocks.length > 0 && (
            <div className="shrink-0 max-w-4xl">
              {renderBlockList(titleBlocks, 't-', { compact: true })}
            </div>
          )}
          <div className="flex-1 flex flex-col justify-center relative pl-7 min-h-0 overflow-hidden gap-4 my-auto">
            <div
              className="absolute left-2 top-2 bottom-2 w-px opacity-30"
              style={{ background: theme?.colors?.primary || '#64748B' }}
            />
            {steps.map((block, index) => (
              <div key={block.id} className="relative flex items-start gap-3 min-h-0 opacity-100">
                <div
                  className="absolute -left-7 top-1.5 w-3.5 h-3.5 rounded-full border-2 bg-white dark:bg-slate-900 shrink-0"
                  style={{ borderColor: theme?.colors?.primary || '#0F172A' }}
                />
                <div className="min-w-0 flex-1 overflow-hidden">
                  {renderBlockNode(block, index, { compact: true })}
                </div>
              </div>
            ))}
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
