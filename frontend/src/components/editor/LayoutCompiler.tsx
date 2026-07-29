"use client";

import React, { useMemo } from 'react';
import type { Block, Theme } from '@/types';
import BlockRenderer from './BlockRenderer';
import { AnimatePresence } from 'framer-motion';

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
  'title-hero': 'title',
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

const getBlockType = (block: Block) => {
  const rawType = block.type || (block as Block & { blockType?: string }).blockType;
  return (rawType as string | undefined)?.toUpperCase().trim().replace(/-/g, '_') || 'PARAGRAPH';
};

const getBlockZone = (block: Block): number | undefined => {
  const direct = (block as Block & { zone?: number }).zone;
  if (typeof direct === 'number') return direct;
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
  if (columnCount <= 1) return [blocks];

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
    if (cols.some((c) => c.length > 0)) return cols;
  }

  // Weight-balanced greedy fill (avoids naive midpoint split)
  const cols: Block[][] = Array.from({ length: columnCount }, () => []);
  const weights = Array.from({ length: columnCount }, () => 0);
  for (const block of blocks) {
    let lightest = 0;
    for (let i = 1; i < columnCount; i++) {
      if (weights[i] < weights[lightest]) lightest = i;
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

  const titleBlocks = useMemo(
    () => blocks.filter((block) => ['HEADING', 'SUBHEADING'].includes(getBlockType(block))),
    [blocks]
  );

  const mediaBlocks = useMemo(
    () =>
      blocks.filter((block) =>
        ['IMAGE', 'VIDEO', 'EMBED', 'OEMBED', 'CHART', 'AUDIO', '3D_MODEL', 'SHAPE'].includes(getBlockType(block))
      ),
    [blocks]
  );

  const bodyBlocks = useMemo(
    () => blocks.filter((block) => !titleBlocks.includes(block) && !mediaBlocks.includes(block)),
    [blocks, titleBlocks, mediaBlocks]
  );

  const statBlocks = useMemo(
    () => bodyBlocks.filter((b) => ['STATISTIC', 'STATS_GRID'].includes(getBlockType(b))),
    [bodyBlocks]
  );

  const renderBlockNode = (block: Block, index: number) => {
    if (renderBlock) {
      return renderBlock(block, index);
    }

    return (
      <div className="w-full min-w-0">
        <BlockRenderer
          block={block}
          theme={theme}
          isActive={activeBlockId === block.id}
          blockIndex={index}
          presentationDensity={presentationDensity}
          presentationTone={presentationTone}
          onFocus={onFocus ? () => onFocus(block.id) : undefined}
          onBlur={onBlur}
          onChange={onChange ? (content) => onChange(block.id, content) : undefined}
          onDelete={onDelete ? () => onDelete(block.id) : undefined}
        />
      </div>
    );
  };

  const renderBlockList = (list: Block[], keyPrefix: string) => (
    <AnimatePresence initial={false}>
      {list.map((block, index) => (
        <React.Fragment key={`${keyPrefix}${block.id}`}>
          {renderBlockNode(block, index)}
        </React.Fragment>
      ))}
    </AnimatePresence>
  );

  const columnStack = (list: Block[], keyPrefix: string, extraClass = '') => (
    <div
      className={`flex flex-col min-w-0 ${isDense ? 'gap-3' : 'gap-4'} ${extraClass}`}
      style={{ opacity: bodyOpacity }}
    >
      {renderBlockList(list, keyPrefix)}
    </div>
  );

  switch (resolvedLayout) {
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
            <div className={`w-full mt-4 max-w-2xl opacity-90`}>{renderBlockList(mediaBlocks, 'm-')}</div>
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
      const [col1, col2] = splitIntoColumns(bodyBlocks, 2);
      const isComparison = resolvedLayout === 'comparison';

      return (
        <div className={`w-full h-full flex flex-col ${contentPad} ${verticalGap} relative z-10 overflow-hidden`}>
          {titleBlocks.length > 0 && (
            <div className="mb-1 shrink-0 max-w-4xl">{renderBlockList(titleBlocks, 't-')}</div>
          )}
          <div
            className={`flex-1 grid grid-cols-1 lg:grid-cols-2 ${columnGap} items-start min-h-0 ${
              isComparison ? 'relative' : ''
            }`}
          >
            {isComparison && (
              <div
                className="hidden lg:block absolute left-1/2 top-2 bottom-2 w-px -translate-x-1/2 opacity-20"
                style={{ background: theme?.colors?.primary || '#64748B' }}
              />
            )}
            {columnStack([...col1, ...mediaBlocks.slice(0, 1)], 'c1-')}
            {columnStack([...col2, ...mediaBlocks.slice(1)], 'c2-')}
          </div>
        </div>
      );
    }

    case 'three-column': {
      const cols = splitIntoColumns(bodyBlocks.length ? bodyBlocks : blocks.filter((b) => !titleBlocks.includes(b)), 3);
      return (
        <div className={`w-full h-full flex flex-col ${contentPad} ${verticalGap} relative z-10 overflow-hidden`}>
          {titleBlocks.length > 0 && (
            <div className="shrink-0 max-w-4xl">{renderBlockList(titleBlocks, 't-')}</div>
          )}
          <div className={`flex-1 grid grid-cols-1 md:grid-cols-3 ${columnGap} items-start min-h-0`}>
            {cols.map((col, i) => (
              <div
                key={`col-${i}`}
                className={`flex flex-col min-w-0 ${isDense ? 'gap-3' : 'gap-4'} ${borderSubtle} rounded-2xl p-4`}
                style={{ background: surface, opacity: bodyOpacity }}
              >
                {renderBlockList(col, `c${i}-`)}
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
          className={`w-full h-full grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] ${columnGap} items-stretch relative z-10 ${contentPad} overflow-hidden`}
        >
          <div
            className={`min-h-56 flex items-center justify-center overflow-hidden ${borderSubtle} shadow-sm`}
            style={{ borderRadius: radius, background: surface }}
          >
            {mediaBlocks.length > 0 ? (
              <div className="w-full h-full [&_img]:object-cover [&_img]:h-full [&_img]:w-full">
                {renderBlockList(mediaBlocks, 'm-')}
              </div>
            ) : (
              <div className="text-slate-400 text-sm font-medium tracking-wide uppercase">Visual</div>
            )}
          </div>
          <div className={`flex flex-col justify-center min-h-0 ${isDense ? 'gap-3' : 'gap-4'} py-1`}>
            {renderBlockList(titleBlocks, 't-')}
            <div style={{ opacity: bodyOpacity }}>{columnStack(bodyBlocks, 'content-')}</div>
          </div>
        </div>
      );

    case 'image-right':
      return (
        <div
          className={`w-full h-full grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] ${columnGap} items-stretch relative z-10 ${contentPad} overflow-hidden`}
        >
          <div className={`flex flex-col justify-center min-h-0 ${isDense ? 'gap-3' : 'gap-4'} py-1`}>
            {renderBlockList(titleBlocks, 't-')}
            <div style={{ opacity: bodyOpacity }}>{columnStack(bodyBlocks, 'content-')}</div>
          </div>
          <div
            className={`min-h-56 flex items-center justify-center overflow-hidden ${borderSubtle} shadow-sm`}
            style={{ borderRadius: radius, background: surface }}
          >
            {mediaBlocks.length > 0 ? (
              <div className="w-full h-full [&_img]:object-cover [&_img]:h-full [&_img]:w-full">
                {renderBlockList(mediaBlocks, 'm-')}
              </div>
            ) : (
              <div className="text-slate-400 text-sm font-medium tracking-wide uppercase">Visual</div>
            )}
          </div>
        </div>
      );

    case 'image-full':
      return (
        <div className="w-full h-full relative overflow-hidden flex flex-col items-stretch rounded-xl">
          <div className="absolute inset-0 z-0" style={{ background: surface }}>
            {mediaBlocks.length > 0 && (
              <div className="w-full h-full [&_img]:object-cover [&_img]:h-full [&_img]:w-full">
                {renderBlockList(mediaBlocks, 'm-')}
              </div>
            )}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10 z-0 pointer-events-none" />
          <div className={`absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end ${isSpacious ? 'p-12' : 'p-8'}`}>
            <div className="max-w-3xl text-white drop-shadow-md" style={{ opacity: bodyOpacity }}>
              {renderBlockList([...titleBlocks, ...bodyBlocks], 'content-')}
            </div>
          </div>
        </div>
      );

    case 'quote-highlight':
      return (
        <div
          className={`w-full h-full flex flex-col items-center justify-center ${
            isSpacious ? 'p-14' : 'p-10'
          } text-center relative z-10 overflow-hidden`}
        >
          <div
            className="w-10 h-10 mb-6 rounded-full flex items-center justify-center text-2xl font-serif opacity-40"
            style={{ color: theme?.colors?.accent || theme?.colors?.primary, background: surface }}
          >
            &ldquo;
          </div>
          <div className={`max-w-3xl flex flex-col ${isSpacious ? 'gap-6' : 'gap-4'}`} style={{ opacity: bodyOpacity }}>
            {renderBlockList([...titleBlocks, ...bodyBlocks], 'content-')}
          </div>
        </div>
      );

    case 'stats-grid': {
      const gridItems = [...statBlocks, ...bodyBlocks.filter((b) => !statBlocks.includes(b)), ...mediaBlocks];
      const count = Math.max(gridItems.length, 1);
      const cols = count <= 2 ? 2 : count === 3 ? 3 : 2;
      return (
        <div className={`w-full h-full flex flex-col ${contentPad} ${verticalGap} relative z-10 overflow-hidden`}>
          {titleBlocks.length > 0 && <div className="shrink-0 max-w-4xl">{renderBlockList(titleBlocks, 't-')}</div>}
          <div
            className={`flex-1 grid gap-4 min-h-0 content-center`}
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              opacity: bodyOpacity,
            }}
          >
            {gridItems.map((block, index) => (
              <div
                key={block.id}
                className={`flex flex-col justify-center ${borderSubtle} rounded-2xl p-5 min-h-0`}
                style={{ background: surface }}
              >
                {renderBlockNode(block, index)}
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
      const items = [...bodyBlocks, ...mediaBlocks];
      return (
        <div className={`w-full h-full flex flex-col ${contentPad} ${verticalGap} relative z-10 overflow-hidden`}>
          {titleBlocks.length > 0 && <div className="shrink-0 max-w-4xl">{renderBlockList(titleBlocks, 't-')}</div>}
          <div
            className="flex-1 grid grid-cols-2 lg:grid-cols-3 grid-rows-2 gap-3 min-h-0"
            style={{ opacity: bodyOpacity }}
          >
            {items.map((block, index) => {
              const span =
                index === 0 ? 'lg:col-span-2 lg:row-span-1' :
                index === 1 ? 'lg:row-span-2' :
                index === items.length - 1 && items.length >= 4 ? 'lg:col-span-2' : '';
              return (
                <div
                  key={block.id}
                  className={`flex flex-col justify-center min-w-0 min-h-0 overflow-hidden ${borderSubtle} rounded-2xl p-4 ${span}`}
                  style={{ background: surface }}
                >
                  {renderBlockNode(block, index)}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    case 'timeline':
      return (
        <div className={`w-full h-full flex flex-col ${contentPad} ${verticalGap} relative z-10 overflow-hidden`}>
          {titleBlocks.length > 0 && <div className="shrink-0 max-w-4xl">{renderBlockList(titleBlocks, 't-')}</div>}
          <div className={`flex-1 flex flex-col justify-center relative pl-8 ${isDense ? 'gap-4' : 'gap-5'}`}>
            <div
              className="absolute left-2 top-2 bottom-2 w-px opacity-25"
              style={{ background: theme?.colors?.primary || '#64748B' }}
            />
            {[...bodyBlocks, ...mediaBlocks].map((block, index) => (
              <div key={block.id} className="relative flex items-start gap-4" style={{ opacity: bodyOpacity }}>
                <div
                  className="absolute -left-8 top-2 w-3 h-3 rounded-full border-2 bg-white dark:bg-slate-900"
                  style={{ borderColor: theme?.colors?.primary || '#0F172A' }}
                />
                <div className="min-w-0 flex-1">{renderBlockNode(block, index)}</div>
              </div>
            ))}
          </div>
        </div>
      );

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
