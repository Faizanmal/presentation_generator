"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, GripVertical, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motionTiming, springSnappy, buttonPress } from "../lib/motion";
import type { EditorSlide } from "../types";

interface SlideThumbnailRailProps {
  slides: EditorSlide[];
  activeSlideId: string | null;
  onSelect: (slideId: string) => void;
  onAddSlide: () => void;
  onReorder: (slideIds: string[]) => void;
  onDeleteSlide?: (slideId: string) => void;
  onDuplicateSlide?: (slideId: string) => void;
}

const ITEM_HEIGHT = 140;
const OVERSCAN = 4;

export function SlideThumbnailRail({
  slides,
  activeSlideId,
  onSelect,
  onAddSlide,
  onReorder,
  onDeleteSlide,
  onDuplicateSlide,
}: SlideThumbnailRailProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(720);
  const [draggingSlideId, setDraggingSlideId] = useState<string | null>(null);
  const [hoveredSlideId, setHoveredSlideId] = useState<string | null>(null);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) {
      return;
    }

    const updateHeight = () => setViewportHeight(node.clientHeight || 720);
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const visibleWindow = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
    const end = Math.min(slides.length, Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + OVERSCAN);

    return {
      start,
      end,
      totalHeight: slides.length * ITEM_HEIGHT,
      visibleSlides: slides.slice(start, end),
    };
  }, [scrollTop, slides, viewportHeight]);

  const handleDrop = (targetSlideId: string) => {
    if (!draggingSlideId || draggingSlideId === targetSlideId) {
      return;
    }

    const ids = slides.map((slide) => slide.id);
    const from = ids.indexOf(draggingSlideId);
    const to = ids.indexOf(targetSlideId);

    if (from < 0 || to < 0) {
      return;
    }

    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };

  return (
    <aside className="flex h-full w-[var(--pd-comp-rail-w)] flex-col border-r border-pd-border bg-pd-panel/80 backdrop-blur">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-pd-border px-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-pd-muted">Storyboard</p>
          <p className="text-sm font-semibold text-pd-text">
            {slides.length} slide{slides.length !== 1 ? "s" : ""}
          </p>
        </div>
        <motion.div {...buttonPress}>
          <Button
            size="icon"
            className="h-8 w-8 rounded-lg bg-pd-accent text-white shadow-glow-subtle"
            onClick={onAddSlide}
            aria-label="Add slide"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>

      {/* Virtualized slide list */}
      <div
        ref={viewportRef}
        className="flex-1 overflow-y-auto px-3 py-3 pd-scrollbar-thin"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div style={{ height: visibleWindow.totalHeight, position: "relative" }}>
          {visibleWindow.visibleSlides.map((slide, offset) => {
            const top = (visibleWindow.start + offset) * ITEM_HEIGHT;
            const isActive = slide.id === activeSlideId;
            const isHovered = slide.id === hoveredSlideId;
            const isDragging = slide.id === draggingSlideId;

            return (
              <motion.div
                key={slide.id}
                layout
                draggable
                onDragStart={() => setDraggingSlideId(slide.id)}
                onDragEnd={() => setDraggingSlideId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  handleDrop(slide.id);
                  setDraggingSlideId(null);
                }}
                onMouseEnter={() => setHoveredSlideId(slide.id)}
                onMouseLeave={() => setHoveredSlideId(null)}
                onClick={() => onSelect(slide.id)}
                animate={{
                  scale: isDragging ? 1.03 : 1,
                  opacity: isDragging ? 0.6 : 1,
                }}
                transition={springSnappy}
                className={cn(
                  "absolute left-0 right-0 flex cursor-pointer flex-col rounded-xl border p-2 transition-colors",
                  "focus-visible:outline-none focus-visible:pd-focus-ring",
                  isActive
                    ? "border-pd-accent bg-pd-accent-soft/60 shadow-glow-subtle"
                    : "border-pd-border bg-pd-elevated hover:border-pd-border-strong hover:bg-pd-app",
                )}
                style={{ top, height: ITEM_HEIGHT - 14 }}
              >
                {/* Slide header */}
                <div className="mb-2 flex items-center justify-between text-xs text-pd-text-secondary">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "grid h-5 w-5 place-items-center rounded-md text-[10px] font-bold",
                      isActive
                        ? "bg-pd-accent text-white"
                        : "bg-pd-sunken text-pd-muted",
                    )}>
                      {slide.order + 1}
                    </span>
                    {slide.transition !== "fade" && (
                      <span className="rounded bg-pd-accent-ultra-soft px-1 py-0.5 text-[9px] text-pd-accent">
                        {slide.transition}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5">
                    {/* Contextual actions (visible on hover) */}
                    <AnimatePresence>
                      {(isHovered || isActive) && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: motionTiming.quick }}
                          className="flex items-center gap-0.5"
                        >
                          {onDuplicateSlide && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDuplicateSlide(slide.id);
                              }}
                              className="rounded-md p-1 text-pd-muted transition hover:bg-pd-elevated hover:text-pd-text"
                              aria-label="Duplicate slide"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          )}
                          {onDeleteSlide && slides.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSlide(slide.id);
                              }}
                              className="rounded-md p-1 text-pd-muted transition hover:bg-pd-danger-soft hover:text-pd-danger"
                              aria-label="Delete slide"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <GripVertical className="h-3.5 w-3.5 cursor-grab opacity-40" />
                  </div>
                </div>

                {/* Mini slide preview */}
                <div className="relative flex-1 overflow-hidden rounded-lg border border-pd-border bg-pd-canvas p-2">
                  <p className="line-clamp-1 text-[0.72rem] font-semibold text-pd-text">
                    {slide.title}
                  </p>
                  <p className="mt-1 line-clamp-3 text-[0.62rem] leading-tight text-pd-text-secondary">
                    {slide.blocks
                      .map((block) => block.content.text)
                      .filter((text): text is string => Boolean(text))
                      .join(" ") || "Start with a strong opening statement."}
                  </p>

                  {/* Block count badge */}
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-pd-sunken px-1 py-0.5 text-[9px] tabular-nums text-pd-muted">
                    {slide.blocks.length} blocks
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Add slide footer */}
      <div className="border-t border-pd-border p-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onAddSlide}
          className="w-full rounded-lg border-dashed border-pd-border text-pd-text-secondary transition hover:border-pd-accent hover:text-pd-accent"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add slide
        </Button>
      </div>
    </aside>
  );
}
