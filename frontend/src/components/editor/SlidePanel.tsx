"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Slide, Theme } from "@/types";
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

export default function SlidePanel({
  slide,
  index,
  isActive,
  onClick,
  onDelete,
  onDuplicate,
  theme,
}: SlidePanelProps) {
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

  // Theme-based background
  const bgColor = theme?.colors?.background || "#ffffff";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative mb-2 rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${
        isActive
          ? "border-blue-500 shadow-md"
          : "border-transparent hover:border-slate-300 dark:hover:border-slate-600"
      } ${isDragging ? "opacity-50" : ""}`}
      onClick={onClick}
    >
      {/* Slide number */}
      <div className="absolute top-1 left-1 z-10 h-5 w-5 rounded bg-black/50 text-white text-xs flex items-center justify-center">
        {index + 1}
      </div>

      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1 right-7 z-10 h-5 w-5 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-grab"
      >
        <GripVertical className="h-3 w-3" />
      </div>

      {/* More menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 z-10 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 bg-black/50 hover:bg-black/70 text-white"
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
        className="aspect-[16/10] p-2"
        style={{ backgroundColor: bgColor }}
      >
        {/* Mini representation of slide content */}
        <div className="h-full flex flex-col gap-1 overflow-hidden">
          {slide.blocks?.slice(0, 3).map((block, i) => (
            <div
              key={block.id}
              className={`rounded ${
                block.type === "HEADING"
                  ? "h-3 bg-slate-700 dark:bg-slate-300 w-2/3"
                  : block.type === "SUBHEADING"
                  ? "h-2 bg-slate-500 dark:bg-slate-400 w-1/2"
                  : "h-1.5 bg-slate-300 dark:bg-slate-600 w-full"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
        <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
          {slide.title || `Slide ${index + 1}`}
        </p>
      </div>
    </div>
  );
}
