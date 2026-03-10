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
  const primaryColor = theme?.colors?.primary || "#3b82f6";

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
        {/* Decorative accent for title slides */}
        {isTitleSlide && (
          <div
            className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-15"
            style={{
              background: `radial-gradient(circle, ${primaryColor}, transparent)`,
            }}
          />
        )}

        {/* Mini representation of slide content */}
        <div className={`h-full flex flex-col gap-1 overflow-hidden ${isTitleSlide ? 'justify-center items-center' : ''}`}>
          {slide.blocks?.slice(0, 4).map((block) => {
            const blockType = (block.type || block.blockType)?.toUpperCase();

            if (blockType === 'HEADING') {
              return (
                <div
                  key={block.id}
                  className="h-2.5 rounded-sm w-3/4"
                  style={{
                    background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}88)`,
                  }}
                />
              );
            }
            if (blockType === 'SUBHEADING') {
              return (
                <div
                  key={block.id}
                  className="h-2 rounded-sm w-2/3"
                  style={{
                    background: `linear-gradient(90deg, ${primaryColor}66, ${primaryColor}33)`,
                  }}
                />
              );
            }
            if (blockType === 'IMAGE') {
              return (
                <div
                  key={block.id}
                  className="h-4 rounded-sm bg-slate-200 dark:bg-slate-600 w-full flex items-center justify-center"
                >
                  <div className="w-2 h-2 rounded-sm bg-slate-300 dark:bg-slate-500" />
                </div>
              );
            }
            if (blockType === 'CHART') {
              return (
                <div key={block.id} className="h-4 rounded-sm bg-slate-100 dark:bg-slate-700 w-full flex items-end gap-px px-1 pb-0.5">
                  <div className="w-1 h-1.5 rounded-t-sm" style={{ backgroundColor: `${primaryColor}66` }} />
                  <div className="w-1 h-2.5 rounded-t-sm" style={{ backgroundColor: `${primaryColor}88` }} />
                  <div className="w-1 h-2 rounded-t-sm" style={{ backgroundColor: `${primaryColor}66` }} />
                  <div className="w-1 h-3 rounded-t-sm" style={{ backgroundColor: primaryColor }} />
                </div>
              );
            }
            if (blockType === 'QUOTE') {
              return (
                <div key={block.id} className="flex gap-0.5">
                  <div className="w-0.5 h-3 rounded-full" style={{ backgroundColor: `${primaryColor}88` }} />
                  <div className="h-1.5 bg-slate-300 dark:bg-slate-500 w-4/5 rounded-sm mt-0.5" />
                </div>
              );
            }
            if (blockType === 'BULLET_LIST') {
              return (
                <div key={block.id} className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full" style={{ backgroundColor: primaryColor }} />
                    <div className="h-1 bg-slate-300 dark:bg-slate-500 flex-1 rounded-sm" />
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full" style={{ backgroundColor: primaryColor }} />
                    <div className="h-1 bg-slate-300 dark:bg-slate-500 w-3/4 rounded-sm" />
                  </div>
                </div>
              );
            }
            if (blockType === 'TIMELINE') {
              return (
                <div key={block.id} className="flex items-center gap-0.5 pl-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                  <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: `${primaryColor}44` }} />
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `${primaryColor}88` }} />
                  <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: `${primaryColor}44` }} />
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `${primaryColor}66` }} />
                </div>
              );
            }
            if (blockType === 'STATS_GRID') {
              return (
                <div key={block.id} className="grid grid-cols-2 gap-0.5">
                  {[0.9, 0.7, 0.8, 0.6].map((opacity) => (
                    <div key={opacity} className="h-2 rounded-sm" style={{ backgroundColor: `${primaryColor}${Math.round(opacity * 255).toString(16)}` }} />
                  ))}
                </div>
              );
            }
            if (blockType === 'COMPARISON') {
              return (
                <div key={block.id} className="grid grid-cols-2 gap-0.5">
                  <div className="h-3 rounded-sm" style={{ backgroundColor: `${primaryColor}22`, borderTop: `1px solid ${primaryColor}88` }} />
                  <div className="h-3 rounded-sm bg-emerald-100 dark:bg-emerald-900/30" style={{ borderTop: `1px solid #10b98188` }} />
                </div>
              );
            }
            if (blockType === 'CALL_TO_ACTION') {
              return (
                <div
                  key={block.id}
                  className="h-3 rounded-sm w-3/4 mx-auto"
                  style={{ background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}bb)` }}
                />
              );
            }
            // Default text block
            return (
              <div
                key={block.id}
                className="h-1.5 bg-slate-300 dark:bg-slate-600 w-full rounded-sm"
              />
            );
          })}
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
