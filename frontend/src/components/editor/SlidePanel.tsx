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

  // Determine if this is a title slide
  const isTitleSlide = slide.layout === 'title' || index === 0;

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
      {/* Slide number badge */}
      <div
        className="absolute top-1.5 left-1.5 z-10 h-5 w-5 rounded-md text-white text-[10px] font-bold flex items-center justify-center shadow-sm"
        style={{
          background: isActive
            ? `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`
            : 'rgba(0,0,0,0.5)',
        }}
      >
        {index + 1}
      </div>

      {/* Drag handle */}
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

      {/* Slide thumbnail */}
      <div
        className="aspect-16/10 p-2.5 relative overflow-hidden"
        style={{ backgroundColor: bgColor }}
      >
        {/* Ambient mesh gradient decoration */}
        {isTitleSlide && (
          <>
            <div
              className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-20 blur-md"
              style={{
                background: `radial-gradient(circle, ${primaryColor}, transparent)`,
              }}
            />
            <div
              className="absolute -bottom-4 -left-4 w-14 h-14 rounded-full opacity-10 blur-sm"
              style={{
                background: `radial-gradient(circle, ${accentColor || primaryColor}, transparent)`,
              }}
            />
          </>
        )}

        {/* Mini representation of slide content */}
        <div
          className={`h-full flex flex-col gap-0.5 overflow-hidden min-w-0 ${
            isTitleSlide ? "justify-center items-center text-center" : ""
          }`}
        >
          {(slide.blocks?.length ? slide.blocks.slice(0, 4) : []).map((block) => {
            const blockType = (block.type || block.blockType)?.toUpperCase();
            const preview = blockPreviewLine(block);

            if (blockType === "IMAGE") {
              const url = block.content?.url;
              return (
                <div
                  key={block.id}
                  className="h-5 rounded-sm w-full overflow-hidden bg-slate-200/80 dark:bg-slate-600/80 shrink-0"
                >
                  {typeof url === "string" && url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[8px] text-slate-500">
                      Image
                    </div>
                  )}
                </div>
              );
            }

            if (preview) {
              const isHeading = blockType === "HEADING" || blockType === "SUBHEADING";
              return (
                <p
                  key={block.id}
                  className={`leading-tight shrink-0 w-full min-w-0 ${
                    isHeading
                      ? "font-semibold line-clamp-2 text-[9px]"
                      : "line-clamp-2 text-[8px] opacity-80"
                  }`}
                  style={{ color: isHeading ? primaryColor : textColor }}
                  title={preview}
                >
                  {preview}
                </p>
              );
            }

            if (blockType === "CHART") {
              return (
                <div
                  key={block.id}
                  className="h-4 rounded-sm bg-slate-100/80 dark:bg-slate-700/80 w-full flex items-end gap-px px-1 pb-0.5 shrink-0"
                >
                  <div className="w-1 h-1.5 rounded-t-sm" style={{ backgroundColor: `${primaryColor}66` }} />
                  <div className="w-1 h-2.5 rounded-t-sm" style={{ backgroundColor: `${primaryColor}88` }} />
                  <div className="w-1 h-3 rounded-t-sm" style={{ backgroundColor: primaryColor }} />
                </div>
              );
            }

            return (
              <div
                key={block.id}
                className="h-1 bg-slate-300/70 dark:bg-slate-600/70 w-full rounded-sm shrink-0"
              />
            );
          })}
          {!slide.blocks?.length && (
            <p className="text-[8px] text-slate-400 italic">Empty slide</p>
          )}
        </div>
      </div>

      {/* Title bar */}
      <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-700/80">
        <p className="text-[10px] text-slate-600 dark:text-slate-400 truncate font-medium">
          {slide.title || `Slide ${index + 1}`}
        </p>
      </div>
    </div>
  );
});

SlidePanel.displayName = "SlidePanel";

export default SlidePanel;
