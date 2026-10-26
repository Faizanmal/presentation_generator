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
  const textBlocks = blocks.filter((b) => {
    const t = (b.type || b.blockType)?.toUpperCase();
    return t !== 'IMAGE' && t !== 'VIDEO';
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

      {/* Slide thumbnail — layout-aware wireframe (not a washed full-bleed strip) */}
      <div
        className="aspect-video relative overflow-hidden"
        style={{ backgroundColor: bgColor }}
      >
        {isHeroSplit ? (
          <div className="absolute inset-0 grid grid-cols-2">
            <div
              className="relative overflow-hidden"
              style={{ background: `linear-gradient(145deg, ${primaryColor}cc, ${accentColor || primaryColor}99)` }}
            >
              {imageBlock?.content?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={String(imageBlock.content.url)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex flex-col justify-center gap-1 p-2 min-w-0 overflow-hidden">
              {textBlocks.slice(0, 3).map((block) => {
                const preview = blockPreviewLine(block, 36);
                if (!preview) {return null;}
                const blockType = (block.type || block.blockType)?.toUpperCase();
                const isHeading = blockType === 'HEADING' || blockType === 'SUBHEADING';
                return (
                  <p
                    key={block.id}
                    className={`leading-tight w-full min-w-0 ${
                      isHeading ? 'font-semibold line-clamp-2 text-[8px]' : 'line-clamp-2 text-[7px] opacity-75'
                    }`}
                    style={{ color: isHeading ? primaryColor : textColor }}
                  >
                    {preview}
                  </p>
                );
              })}
            </div>
          </div>
        ) : (
          <div
            className={`absolute inset-0 flex flex-col gap-1 p-2.5 overflow-hidden min-w-0 ${
              isTitleSlide ? 'justify-center items-center text-center' : 'justify-start'
            }`}
          >
            {isTitleSlide && (
              <div
                className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-15 blur-md pointer-events-none"
                style={{ background: `radial-gradient(circle, ${primaryColor}, transparent)` }}
              />
            )}
            {textBlocks.map((block) => {
              const preview = blockPreviewLine(block);
              if (!preview) {return null;}
              const blockType = (block.type || block.blockType)?.toUpperCase();
              const isHeading = blockType === 'HEADING' || blockType === 'SUBHEADING';
              return (
                <p
                  key={block.id}
                  className={`leading-tight shrink-0 w-full min-w-0 ${
                    isHeading ? 'font-semibold line-clamp-2 text-[9px]' : 'line-clamp-2 text-[8px] opacity-80'
                  }`}
                  style={{ color: isHeading ? primaryColor : textColor }}
                  title={preview}
                >
                  {preview}
                </p>
              );
            })}
            {!blocks.length && (
              <p className="text-[8px] text-slate-400 italic">Empty slide</p>
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
