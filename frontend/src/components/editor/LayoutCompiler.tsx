import React, { useMemo } from 'react';
import type { Block, Theme } from '@/types';
import BlockRenderer from './BlockRenderer';
import { AnimatePresence } from 'framer-motion';

interface LayoutCompilerProps {
  layoutType: string;
  generateImages?: boolean; // new config
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
  // Partition blocks into logical zones structurally
  const { titleBlocks, mediaBlocks, bodyBlocks } = useMemo(() => {
    const titleBlocks: Block[] = [];
    const mediaBlocks: Block[] = [];
    const bodyBlocks: Block[] = [];

    blocks.forEach((block) => {
      const type = block.type || block.blockType;
      if (!type) {
        bodyBlocks.push(block);
        return;
      }

      if (type === 'HEADING' && titleBlocks.length === 0) {
        titleBlocks.push(block);
      } else if (['IMAGE', 'VIDEO', 'EMBED', 'CHART'].includes(type as string)) {
        mediaBlocks.push(block);
      } else {
        bodyBlocks.push(block);
      }
    });

    return { titleBlocks, mediaBlocks, bodyBlocks };
  }, [blocks]);

  const defaultRenderBlock = (block: Block, index: number, zonePrefix = '') => (
    <BlockRenderer
      key={`${zonePrefix}${block.id}`}
      block={block}
      theme={theme}
      presentationDensity={presentationDensity}
      presentationTone={presentationTone}
      isActive={activeBlockId === block.id}
      blockIndex={index}
      onFocus={onFocus ? () => onFocus(block.id) : undefined}
      onBlur={onBlur}
      onChange={onChange ? (content) => onChange(block.id, content) : undefined}
      onDelete={onDelete ? () => onDelete(block.id) : undefined}
    />
  );

  const renderBlockList = (blockList: Block[], zonePrefix = '') => (
    <AnimatePresence mode="popLayout">
      {blockList.map((block, index) => {
        if (renderBlock) {
          return (
            <div key={`${zonePrefix}${block.id}`}>
              {renderBlock(block, index)}
            </div>
          );
        }
        return defaultRenderBlock(block, index, zonePrefix);
      })}
    </AnimatePresence>
  );

  const isDense = presentationDensity >= 66;
  const isSpacious = presentationDensity < 34;
  const titlePadding = isSpacious ? 'p-14' : isDense ? 'p-8' : 'p-12';
  const contentPadding = isSpacious ? 'p-12' : isDense ? 'p-8' : 'p-10';
  const verticalGap = isSpacious ? 'gap-8' : isDense ? 'gap-4' : 'gap-6';
  const columnGap = isSpacious ? 'gap-12' : isDense ? 'gap-8' : 'gap-10';
  const readableWidth = presentationTone > 66 ? 'max-w-[38rem]' : 'max-w-[42rem]';

  // Structural renderer mapping based on canonical layouts
  switch (layoutType) {
    case 'title':
      return (
        <div className={`absolute inset-0 flex flex-col items-center justify-center text-center ${titlePadding} ${verticalGap} z-10`}>
          <div className="w-full max-w-4xl">{renderBlockList(titleBlocks, 't-')}</div>
          <div className="w-full opacity-90 max-w-3xl">{renderBlockList(bodyBlocks, 'b-')}</div>
          {mediaBlocks.length > 0 && <div className="w-full mt-4 max-w-4xl">{renderBlockList(mediaBlocks, 'm-')}</div>}
        </div>
      );

    case 'two-column':
    case 'comparison':
      {
        const mid = Math.ceil(bodyBlocks.length / 2);
        const col1 = bodyBlocks.slice(0, mid);
        const col2 = bodyBlocks.slice(mid);
        return (
          <div className={`absolute inset-0 flex flex-col ${contentPadding} ${verticalGap} z-10`}>
            {titleBlocks.length > 0 && <div className="shrink-0">{renderBlockList(titleBlocks, 't-')}</div>}
            <div className={`flex-1 grid grid-cols-2 ${columnGap} items-start overflow-hidden min-h-0`}>
              <div className={`flex flex-col ${isDense ? 'gap-3' : 'gap-4'} overflow-hidden`}>
                {renderBlockList([...col1, ...mediaBlocks.slice(0, 1)], 'c1-')}
              </div>
              <div className={`flex flex-col ${isDense ? 'gap-3' : 'gap-4'} overflow-hidden`}>
                {renderBlockList([...col2, ...mediaBlocks.slice(1)], 'c2-')}
              </div>
            </div>
          </div>
        );
      }

    case 'image-left':
      return (
        <div className={`absolute inset-0 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] ${columnGap} items-stretch z-10 ${contentPadding}`}>
          <div className="flex items-center justify-center overflow-hidden rounded-2xl bg-slate-50/90 dark:bg-slate-800/50">
            {mediaBlocks.length > 0 ? (
              <div className="w-full h-full">{renderBlockList(mediaBlocks, 'm-')}</div>
            ) : (
              <div className="text-slate-400 font-medium text-sm">Image Zone</div>
            )}
          </div>
          <div className={`flex flex-col ${isDense ? 'gap-3' : 'gap-4'} overflow-hidden justify-center`}>
            {renderBlockList([...titleBlocks, ...bodyBlocks], 'content-')}
          </div>
        </div>
      );

    case 'image-right':
      return (
        <div className={`absolute inset-0 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] ${columnGap} items-stretch z-10 ${contentPadding}`}>
          <div className={`flex flex-col ${isDense ? 'gap-3' : 'gap-4'} overflow-hidden justify-center`}>
            {renderBlockList([...titleBlocks, ...bodyBlocks], 'content-')}
          </div>
          <div className="flex items-center justify-center overflow-hidden rounded-2xl bg-slate-50/90 dark:bg-slate-800/50">
            {mediaBlocks.length > 0 ? (
              <div className="w-full h-full">{renderBlockList(mediaBlocks, 'm-')}</div>
            ) : (
              <div className="text-slate-400 font-medium text-sm">Image Zone</div>
            )}
          </div>
        </div>
      );

    case 'image-full':
      return (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 z-0 bg-slate-200 dark:bg-slate-800">
            {mediaBlocks.length > 0 && (
              <div className="w-full h-full [&_img]:object-cover [&_img]:h-full [&_img]:w-full">
                {renderBlockList(mediaBlocks, 'm-')}
              </div>
            )}
          </div>
          <div className="absolute inset-0 bg-black/40 z-0 pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end p-12 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
            <div className="drop-shadow-md text-white">
              {renderBlockList([...titleBlocks, ...bodyBlocks], 'content-')}
            </div>
          </div>
        </div>
      );

    case 'quote-highlight':
      return (
        <div className={`absolute inset-0 flex flex-col items-center justify-center ${isSpacious ? 'p-16' : 'p-12'} text-center z-10`}>
          <div className="max-w-3xl flex flex-col gap-6">
            {renderBlockList([...titleBlocks, ...bodyBlocks], 'content-')}
          </div>
        </div>
      );

    case 'stats-grid':
      return (
        <div className={`absolute inset-0 flex flex-col ${contentPadding} ${verticalGap} z-10`}>
          {titleBlocks.length > 0 && <div className="shrink-0">{renderBlockList(titleBlocks, 't-')}</div>}
          <div className="flex-1 grid grid-cols-2 gap-4 min-h-0 overflow-hidden">
            {renderBlockList([...bodyBlocks, ...mediaBlocks], 'content-')}
          </div>
        </div>
      );

    case 'chart-focus':
      return (
        <div className={`absolute inset-0 flex flex-col ${contentPadding} ${verticalGap} z-10`}>
          {titleBlocks.length > 0 && <div className="shrink-0">{renderBlockList(titleBlocks, 't-')}</div>}
          <div className="flex-1 flex items-center justify-center overflow-hidden min-h-0 bg-slate-50/60 dark:bg-slate-800/30 rounded-2xl p-4">
            {renderBlockList(mediaBlocks.length > 0 ? mediaBlocks : bodyBlocks, 'content-')}
          </div>
        </div>
      );

    case 'title-content':
    case 'content':
    case 'timeline':
    default:
      return (
        <div className={`absolute inset-0 flex flex-col ${contentPadding} ${verticalGap} z-10`}>
          {titleBlocks.length > 0 && <div className="shrink-0">{renderBlockList(titleBlocks, 't-')}</div>}
          <div className={`flex-1 flex flex-col ${isDense ? 'gap-3' : 'gap-4'} overflow-hidden min-h-0`}>
            {renderBlockList([...bodyBlocks, ...mediaBlocks], 'content-')}
          </div>
        </div>
      );
  }
}
