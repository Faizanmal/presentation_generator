"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Slide, Theme } from "@/types";
import {
  GripVertical,
  MoreHorizontal,
  Copy,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { stripHtmlText } from "@/lib/project-preview";
import type { Block } from "@/types";

function blockPreviewLine(block: Block, maxLen = 48): string | null {
  const blockType = (block.type || (block as Block & { blockType?: string }).blockType)?.toUpperCase();
  const text = block.content?.text;
  if (typeof text === "string" && text.trim()) {
    const plain = stripHtmlText(text);
    if (plain) {
      return plain.length > maxLen ? `${plain.slice(0, maxLen - 1)}…` : plain;
    }
  }
  if (blockType === "IMAGE" && block.content?.url) {
    return "Image";
  }
  if (blockType === "CHART") {
    return "Chart";
  }
  return null;
}

interface SlidePanelProps {
  slide: Slide;
  index: number;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  theme?: Theme;
}

const SlidePanel = React.memo(({
  slide,
  index,
  isActive,
  onClick,
  onDelete,
  onDuplicate,
  theme,
}: SlidePanelProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Theme-based colors
  const bgColor = theme?.colors?.background || "#ffffff";
  const textColor = theme?.colors?.text || "#0f172a";
  const primaryColor = theme?.colors?.primary || "#3b82f6";
  const accentColor = theme?.colors?.accent || "#10b981";

  const layout = (slide.layout || '').toLowerCase();
  const isHeroSplit =
    layout === 'title-hero' ||
    layout === 'image-left' ||
    layout === 'image-right' ||
    layout === 'two-column-image';
  const isTitleSlide = layout === 'title' || layout === 'title-subtitle';

  const blocks = slide.blocks?.length ? slide.blocks : [];
  const imageBlock = blocks.find((b) => {
    const t = (b.type || b.blockType)?.toUpperCase();
    return t === 'IMAGE' && typeof b.content?.url === 'string' && b.content.url;
  });
  const headingBlock = blocks.find((b) => {
    const t = (b.type || b.blockType)?.toUpperCase();
    return t === 'HEADING' || t === 'SUBHEADING';
  });
  const headingText = headingBlock ? blockPreviewLine(headingBlock, 40) : slide.title || '';
  const textBlocks = blocks.filter((b) => {
    const t = (b.type || b.blockType)?.toUpperCase();
    return t !== 'IMAGE' && t !== 'VIDEO' && b !== headingBlock;
  }).slice(0, 4);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative mb-2 rounded-xl border-2 overflow-hidden cursor-pointer transition-all duration-200 ${isActive
        ? "border-blue-500 shadow-lg shadow-blue-500/20 scale-[1.02]"
        : "border-transparent hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md"
        } ${isDragging ? "opacity-50 scale-95" : ""}`}
      onClick={onClick}
    >
      {/* Drag handle (thumbnail corner — not over title text) */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1.5 right-7 z-10 h-5 w-5 rounded-md bg-black/40 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-grab transition-opacity duration-150"
      >
        <GripVertical className="h-3 w-3" />
      </div>

      {/* More menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1.5 right-1 z-10 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white rounded-md transition-opacity duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Slide thumbnail — layout-aware wireframe */}
      <div
        className="aspect-video relative overflow-hidden"
        style={{ backgroundColor: bgColor }}
      >
        {isHeroSplit ? (
          <div className="absolute inset-0 grid grid-cols-2">
            <div
              className="relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor || primaryColor})` }}
            >
              {imageBlock?.content?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={String(imageBlock.content.url)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center text-white text-[10px] font-bold">
                    {(headingText || 'P').slice(0, 1).toUpperCase()}
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col justify-center gap-1 p-2 min-w-0 overflow-hidden">
              {headingText && (
                <p
                  className="leading-tight w-full min-w-0 font-bold line-clamp-2 text-[8px]"
                  style={{ color: primaryColor }}
                >
                  {headingText}
                </p>
              )}
              {textBlocks.slice(0, 2).map((block) => {
                const preview = blockPreviewLine(block, 28);
                if (!preview) return null;
                return (
                  <p
                    key={block.id}
                    className="leading-tight w-full min-w-0 line-clamp-1 text-[7px] opacity-75"
                    style={{ color: textColor }}
                  >
                    {preview}
                  </p>
                );
              })}
            </div>
          </div>
        ) : isTitleSlide ? (
          <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-2.5 overflow-hidden min-w-0">
            <div
              className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-15 blur-md pointer-events-none"
              style={{ background: `radial-gradient(circle, ${primaryColor}, transparent)` }}
            />
            <p
              className="font-bold text-[10px] line-clamp-2 leading-snug w-full max-w-full"
              style={{ color: primaryColor }}
            >
              {headingText || 'Title'}
            </p>
            {textBlocks[0] && (
              <p
                className="text-[7px] opacity-75 line-clamp-1 mt-1 max-w-full"
                style={{ color: textColor }}
              >
                {blockPreviewLine(textBlocks[0], 36)}
              </p>
            )}
          </div>
        ) : layout === 'three-column' ? (
          <div className="absolute inset-0 flex flex-col p-2 overflow-hidden min-w-0 gap-1 justify-between">
            <p className="font-bold text-[8px] line-clamp-1 shrink-0" style={{ color: primaryColor }}>
              {headingText || 'Three Column'}
            </p>
            <div className="grid grid-cols-3 gap-1 h-9 flex-1 min-h-0">
              {[0, 1, 2].map((colIdx) => (
                <div
                  key={colIdx}
                  className="rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 p-1 flex flex-col justify-center gap-0.5 overflow-hidden"
                >
                  <div className="h-1 w-3/4 rounded-full" style={{ background: primaryColor, opacity: 0.8 }} />
                  <div className="h-0.5 w-full rounded-full bg-slate-300 dark:bg-slate-600" />
                  <div className="h-0.5 w-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />
                </div>
              ))}
            </div>
          </div>
        ) : layout === 'comparison' || layout === 'two-column' ? (
          <div className="absolute inset-0 flex flex-col p-2 overflow-hidden min-w-0 gap-1 justify-between">
            <p className="font-bold text-[8px] line-clamp-1 shrink-0" style={{ color: primaryColor }}>
              {headingText || 'Comparison'}
            </p>
            <div className="grid grid-cols-2 gap-1.5 h-9 flex-1 min-h-0">
              {[0, 1].map((colIdx) => (
                <div
                  key={colIdx}
                  className="rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 p-1.5 flex flex-col justify-center gap-1 overflow-hidden"
                >
                  <div className="h-1 w-2/3 rounded-full" style={{ background: colIdx === 0 ? primaryColor : accentColor, opacity: 0.8 }} />
                  <div className="h-0.5 w-full rounded-full bg-slate-300 dark:bg-slate-600" />
                </div>
              ))}
            </div>
          </div>
        ) : layout === 'timeline' ? (
          <div className="absolute inset-0 flex flex-col p-2 overflow-hidden min-w-0 gap-1 justify-between">
            <p className="font-bold text-[8px] line-clamp-1 shrink-0" style={{ color: primaryColor }}>
              {headingText || 'Timeline'}
            </p>
            <div className="flex items-center justify-between px-3 h-8 flex-1 min-h-0 relative">
              <div className="absolute left-4 right-4 top-1/2 h-0.5 -translate-y-1/2 bg-slate-200 dark:bg-slate-700" />
              {[0, 1, 2].map((stepIdx) => (
                <div
                  key={stepIdx}
                  className="w-2.5 h-2.5 rounded-full z-10 border-2 bg-white dark:bg-slate-900 shrink-0"
                  style={{ borderColor: primaryColor }}
                />
              ))}
            </div>
          </div>
        ) : layout === 'stats-grid' ? (
          <div className="absolute inset-0 flex flex-col p-2 overflow-hidden min-w-0 gap-1 justify-between">
            <p className="font-bold text-[8px] line-clamp-1 shrink-0" style={{ color: primaryColor }}>
              {headingText || 'Metrics'}
            </p>
            <div className="grid grid-cols-2 gap-1 h-9 flex-1 min-h-0">
              {[0, 1].map((statIdx) => (
                <div
                  key={statIdx}
                  className="rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 p-1 flex flex-col justify-center items-center overflow-hidden"
                >
                  <span className="font-extrabold text-[8px]" style={{ color: primaryColor }}>
                    {statIdx === 0 ? '95%' : '3×'}
                  </span>
                  <div className="h-0.5 w-2/3 rounded-full bg-slate-300 dark:bg-slate-600 mt-0.5" />
                </div>
              ))}
            </div>
          </div>
        ) : layout === 'bento-grid' ? (
          <div className="absolute inset-0 flex flex-col p-2 overflow-hidden min-w-0 gap-1 justify-between">
            <p className="font-bold text-[8px] line-clamp-1 shrink-0" style={{ color: primaryColor }}>
              {headingText || 'Takeaway'}
            </p>
            <div className="grid grid-cols-2 gap-1 h-9 flex-1 min-h-0">
              <div className="rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 p-1 flex flex-col justify-center gap-0.5">
                <div className="h-1 w-3/4 rounded-full" style={{ background: primaryColor }} />
                <div className="h-0.5 w-full bg-slate-300 dark:bg-slate-600 rounded" />
              </div>
              <div
                className="rounded-md p-1 flex flex-col justify-center items-center text-white text-[7px] font-bold"
                style={{ background: primaryColor }}
              >
                CTA
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col gap-1 p-2 overflow-hidden min-w-0 justify-start">
            <p className="font-bold text-[9px] line-clamp-1 shrink-0" style={{ color: primaryColor }}>
              {headingText || `Slide ${index + 1}`}
            </p>
            {textBlocks.slice(0, 2).map((block) => {
              const preview = blockPreviewLine(block, 40);
              if (!preview) return null;
              return (
                <p
                  key={block.id}
                  className="leading-tight shrink-0 w-full min-w-0 line-clamp-1 text-[7px] opacity-80"
                  style={{ color: textColor }}
                >
                  {preview}
                </p>
              );
            })}
            {!blocks.length && (
              <p className="text-[7px] text-slate-400 italic">Empty slide</p>
            )}
          </div>
        )}
      </div>

      {/* Title bar with slide number (kept out of the thumbnail so it never covers titles) */}
      <div className="px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center gap-1.5 min-w-0">
        <span
          className="h-4 min-w-4 px-1 rounded text-white text-[9px] font-bold flex items-center justify-center shrink-0"
          style={{
            background: isActive
              ? `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`
              : 'rgba(100,116,139,0.85)',
          }}
        >
          {index + 1}
        </span>
        <p className="text-[10px] text-slate-600 dark:text-slate-400 truncate font-medium min-w-0">
          {slide.title || `Slide ${index + 1}`}
        </p>
      </div>
    </div>
  );
});

SlidePanel.displayName = "SlidePanel";

export default SlidePanel;
