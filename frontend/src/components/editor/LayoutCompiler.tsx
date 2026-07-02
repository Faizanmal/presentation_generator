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
  switch (layoutType) {
    case 'title':
      return (
        <div className={`w-full h-full flex flex-col items-center justify-center text-center max-w-5xl mx-auto ${titlePadding} ${verticalGap} relative z-10`}>
          <div className="w-full max-w-4xl">{renderBlockList(titleBlocks, 't-')}</div>
          <div className="w-full opacity-90 max-w-3xl">{renderBlockList(bodyBlocks, 'b-')}</div>
          {mediaBlocks.length > 0 && <div className="w-full mt-6 max-w-4xl">{renderBlockList(mediaBlocks, 'm-')}</div>}
        </div>
      );

    case 'two-column':
    case 'comparison': {
      const mid = Math.ceil(bodyBlocks.length / 2);
      const col1 = bodyBlocks.slice(0, mid);
      const col2 = bodyBlocks.slice(mid);

      return (
        <div className={`w-full h-full flex flex-col ${contentPadding} ${verticalGap} relative z-10`}>
          {titleBlocks.length > 0 && <div className="mb-2 shrink-0">{renderBlockList(titleBlocks, 't-')}</div>}
          <div className={`flex-1 grid grid-cols-1 lg:grid-cols-2 ${columnGap} items-start overflow-y-auto pr-2`}>
            <div className={`flex flex-col ${isDense ? 'gap-4' : 'gap-5'} ${readableWidth}`}>
              {renderBlockList([...col1, ...mediaBlocks.slice(0, 1)], 'c1-')}
            </div>
            <div className={`flex flex-col ${isDense ? 'gap-4' : 'gap-5'} ${readableWidth}`}>
              {renderBlockList([...col2, ...mediaBlocks.slice(1)], 'c2-')}
            </div>
          </div>
        </div>
      );
    }

    case 'image-left':
      return (
        <div className={`w-full h-full grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] ${columnGap} items-stretch relative z-10 ${contentPadding}`}>
          <div className="min-h-[18rem] flex items-center justify-center overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/50 shadow-sm">
            {mediaBlocks.length > 0 ? (
              <div className="w-full h-full">{renderBlockList(mediaBlocks, 'm-')}</div>
            ) : (
              <div className="text-slate-400 font-medium">Media Zone</div>
            )}
          </div>
          <div className={`flex flex-col ${isDense ? 'gap-4' : 'gap-5'} overflow-y-auto pl-2 py-2 justify-center ${readableWidth}`}>
            {renderBlockList([...titleBlocks, ...bodyBlocks], 'content-')}
          </div>
        </div>
      );

    case 'image-right':
      return (
        <div className={`w-full h-full grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] ${columnGap} items-stretch relative z-10 ${contentPadding}`}>
          <div className={`flex flex-col ${isDense ? 'gap-4' : 'gap-5'} overflow-y-auto pr-2 py-2 justify-center ${readableWidth}`}>
            {renderBlockList([...titleBlocks, ...bodyBlocks], 'content-')}
          </div>
          <div className="min-h-[18rem] flex items-center justify-center overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/50 shadow-sm">
            {mediaBlocks.length > 0 ? (
              <div className="w-full h-full">{renderBlockList(mediaBlocks, 'm-')}</div>
            ) : (
              <div className="text-slate-400 font-medium">Media Zone</div>
            )}
          </div>
        </div>
      );

    case 'image-full':
      return (
        <div className="w-full h-full relative overflow-hidden flex flex-col items-stretch group rounded-xl">
          <div className="absolute inset-0 z-0 bg-slate-200 dark:bg-slate-800">
            {mediaBlocks.length > 0 && (
              <div className="w-full h-full object-cover [&_img]:object-cover [&_img]:h-full [&_img]:w-full">
                {renderBlockList(mediaBlocks, 'm-')}
              </div>
            )}
          </div>
          <div className="absolute inset-0 bg-black/40 mix-blend-multiply z-0 pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end p-12 bg-linear-to-t from-black/80 via-black/40 to-transparent">
            <div className="drop-shadow-md text-white brightness-150">
              {renderBlockList([...titleBlocks, ...bodyBlocks], 'content-')}
            </div>
          </div>
        </div>
      );

    case 'quote-highlight':
      return (
        <div className={`w-full h-full flex flex-col items-center justify-center ${isSpacious ? 'p-16' : 'p-12'} text-center relative z-10`}>
          <div className="max-w-3xl flex flex-col gap-8">
            {renderBlockList([...titleBlocks, ...bodyBlocks], 'content-')}
          </div>
        </div>
      );

    case 'stats-grid':
      return (
        <div className={`w-full h-full flex flex-col ${contentPadding} ${verticalGap} relative z-10`}>
          {titleBlocks.length > 0 && <div className="shrink-0">{renderBlockList(titleBlocks, 't-')}</div>}
          <div className="flex-1 grid grid-cols-2 gap-4 min-h-0 overflow-hidden">
            {renderBlockList([...bodyBlocks, ...mediaBlocks], 'content-')}
          </div>
        </div>
      );

    case 'chart-focus':
      return (
        <div className={`w-full h-full flex flex-col ${contentPadding} ${verticalGap} relative z-10`}>
          {titleBlocks.length > 0 && <div className="shrink-0">{renderBlockList(titleBlocks, 't-')}</div>}
          <div className="flex-1 flex text-center overflow-hidden min-h-0 bg-slate-50/60 dark:bg-slate-800/30 rounded-2xl p-4 shadow-inner">
            <div className="w-full h-full flex items-center justify-center">
              {renderBlockList(mediaBlocks.length > 0 ? mediaBlocks : bodyBlocks, 'content-')}
            </div>
          </div>
        </div>
      );

    case 'title-content':
    case 'content':
    case 'timeline':
    default:
      return (
        <div className={`w-full h-full flex flex-col ${contentPadding} ${verticalGap} relative z-10`}>
          {titleBlocks.length > 0 && <div className="shrink-0">{renderBlockList(titleBlocks, 't-')}</div>}
          <div className={`flex-1 flex flex-col ${isDense ? 'gap-4' : 'gap-5'} overflow-y-auto px-1 min-h-0 ${readableWidth}`}>
            {renderBlockList([...bodyBlocks, ...mediaBlocks], 'content-')}
          </div>
        </div>
      );
  }
}
