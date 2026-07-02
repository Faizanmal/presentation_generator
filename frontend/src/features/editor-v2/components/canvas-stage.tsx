"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gauge, Sparkles, ZoomIn, ZoomOut, Maximize2, Grid3X3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EDITOR_LIMITS } from "../constants/editor";
import { useCanvasViewport } from "../hooks/use-canvas-viewport";
import {
  fadeSlideVariants,
  motionTiming,
  motionEase,
  viewportTransition,
} from "../lib/motion";
import { buildLayoutBlueprint, computeTypographyScale, scoreLayout } from "../lib/slide-design-engine";
import type { EditorBlock, EditorSlide, PresenceUser, SelectionState, ViewportState } from "../types";
import { BlockNode } from "./block-node";

interface CanvasStageProps {
  slide: EditorSlide;
  viewport: ViewportState;
  selection: SelectionState;
  collaborators: PresenceUser[];
  editable: boolean;
  onPan: (deltaX: number, deltaY: number) => void;
  onZoomDelta: (delta: number) => void;
  onSelectBlock: (blockId: string | null) => void;
  onUpdateBlockContent: (blockId: string, text: string) => void;
  onUpdateBlockFrame: (blockId: string, frame: Partial<EditorBlock["frame"]>) => void;
  onAutoLayout: () => void;
  onDeleteBlock?: (blockId: string) => void;
  onDuplicateBlock?: (blockId: string) => void;
}

export const CanvasStage = memo(function CanvasStage({
  slide,
  viewport,
  selection,
  collaborators,
  editable,
  onPan,
  onZoomDelta,
  onSelectBlock,
  onUpdateBlockContent,
  onUpdateBlockFrame,
  onAutoLayout,
  onDeleteBlock,
  onDuplicateBlock,
}: CanvasStageProps) {
  const interactionBind = useCanvasViewport({ onPan, onZoomDelta });
  const [showGrid, setShowGrid] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const blueprint = useMemo(
    () => buildLayoutBlueprint(EDITOR_LIMITS.canvasWidth, EDITOR_LIMITS.canvasHeight),
    [],
  );

  const layoutScore = useMemo(() => scoreLayout(slide.blocks, blueprint), [blueprint, slide.blocks]);
  const typographyScale = useMemo(() => computeTypographyScale(EDITOR_LIMITS.canvasWidth), []);

  const zoomPercent = Math.round(viewport.zoom * 100);

  const resetZoom = useCallback(() => {
    const delta = EDITOR_LIMITS.defaultZoom - viewport.zoom;
    onZoomDelta(delta);
  }, [onZoomDelta, viewport.zoom]);

  // Score color
  const scoreColor = layoutScore.overall >= 85
    ? "text-pd-success"
    : layoutScore.overall >= 65
      ? "text-pd-warning"
      : "text-pd-danger";

  return (
    <section className="relative flex h-full flex-1 flex-col overflow-hidden bg-pd-app">
      {/* ── Top status bar ──────────────────────────────────────── */}
      <div className="absolute left-4 top-3 z-20 flex items-center gap-2 rounded-full pd-surface-glass px-3 py-1.5 text-xs text-pd-text-secondary">
        <Gauge className="h-3.5 w-3.5" />
        <span className={scoreColor}>
          Balance {layoutScore.overall}
        </span>
        <span className="h-1 w-1 rounded-full bg-pd-border" />
        <span>H {typographyScale.heading}px</span>
        <span className="h-1 w-1 rounded-full bg-pd-border" />
        <span>{slide.blocks.length} blocks</span>
      </div>

      {/* ── Top right controls ──────────────────────────────────── */}
      <div className="absolute right-4 top-3 z-20 flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className={cn(
            "rounded-full border-pd-border bg-pd-elevated/85 text-pd-text backdrop-blur",
            showGrid && "bg-pd-accent-soft text-pd-accent",
          )}
          onClick={() => setShowGrid(!showGrid)}
        >
          <Grid3X3 className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full border-pd-border bg-pd-elevated/85 text-pd-text backdrop-blur"
          onClick={onAutoLayout}
        >
          <Sparkles className="h-3.5 w-3.5" /> Auto Layout
        </Button>
      </div>

      {/* ── Bottom zoom controls ────────────────────────────────── */}
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: motionTiming.smooth, ease: motionEase.smooth }}
        className="absolute bottom-4 left-4 z-20 flex items-center gap-1 rounded-xl pd-surface-glass px-2 py-1"
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg text-pd-text-secondary hover:text-pd-text"
          onClick={() => onZoomDelta(-EDITOR_LIMITS.zoomStep)}
          aria-label="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <button
          type="button"
          onClick={resetZoom}
          className="min-w-[3rem] rounded-lg px-2 py-1 text-center text-xs font-medium text-pd-text-secondary transition hover:bg-pd-elevated hover:text-pd-text"
        >
          {zoomPercent}%
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg text-pd-text-secondary hover:text-pd-text"
          onClick={() => onZoomDelta(EDITOR_LIMITS.zoomStep)}
          aria-label="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <div className="mx-1 h-4 w-px bg-pd-border" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg text-pd-text-secondary hover:text-pd-text"
          onClick={resetZoom}
          aria-label="Fit to screen"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </motion.div>

      {/* ── Canvas viewport ─────────────────────────────────────── */}
      <div
        ref={canvasRef}
        className={cn(
          "relative flex-1 overflow-hidden",
          showGrid ? "pd-editor-grid" : "pd-editor-dots",
        )}
        {...interactionBind}
      >
        <motion.div
          className="absolute left-1/2 top-1/2"
          animate={{
            x: viewport.panX,
            y: viewport.panY,
            scale: viewport.zoom,
          }}
          transition={viewportTransition}
        >
          {/* ── Slide canvas ──────────────────────────────────────── */}
          <motion.div
            layout
            variants={fadeSlideVariants}
            initial="hidden"
            animate="visible"
            className="relative -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border border-pd-border-strong bg-pd-canvas shadow-float"
            style={{
              width: EDITOR_LIMITS.canvasWidth,
              height: EDITOR_LIMITS.canvasHeight,
            }}
            onClick={() => onSelectBlock(null)}
          >
            {/* ── Ambient gradient layer ─────────────────────────── */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_18%_14%,color-mix(in_oklch,var(--pd-sys-accent)_10%,transparent)_0%,transparent_38%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_82%_86%,color-mix(in_oklch,var(--pd-ref-violet-400)_6%,transparent)_0%,transparent_38%)]" />
            </div>

            {/* ── Smart guides (when grid is on) ─────────────────── */}
            {showGrid && (
              <div className="pointer-events-none absolute inset-0">
                {/* Center cross */}
                <div className="absolute left-1/2 top-0 h-full w-px bg-pd-accent/10" />
                <div className="absolute left-0 top-1/2 h-px w-full bg-pd-accent/10" />
                {/* Rule of thirds */}
                <div className="absolute left-1/3 top-0 h-full w-px bg-pd-accent/5" />
                <div className="absolute left-2/3 top-0 h-full w-px bg-pd-accent/5" />
                <div className="absolute left-0 top-1/3 h-px w-full bg-pd-accent/5" />
                <div className="absolute left-0 top-2/3 h-px w-full bg-pd-accent/5" />
              </div>
            )}

            {/* ── Blocks ─────────────────────────────────────────── */}
            <AnimatePresence>
              {slide.blocks.map((block) => (
                <BlockNode
                  key={block.id}
                  block={block}
                  isSelected={selection.blockId === block.id}
                  zoom={viewport.zoom}
                  editable={editable}
                  onSelect={onSelectBlock}
                  onContentChange={onUpdateBlockContent}
                  onFrameChange={onUpdateBlockFrame}
                  onDelete={onDeleteBlock}
                  onDuplicate={onDuplicateBlock}
                />
              ))}
            </AnimatePresence>

            {/* ── Collaborator cursors ────────────────────────────── */}
            {collaborators.map((participant) => {
              if (participant.cursor.slideId && participant.cursor.slideId !== slide.id) {
                return null;
              }

              return (
                <motion.div
                  key={participant.id}
                  className="pointer-events-none absolute z-50"
                  animate={{
                    left: participant.cursor.x,
                    top: participant.cursor.y,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 28, mass: 0.3 }}
                >
                  {/* Cursor SVG */}
                  <svg
                    width="16"
                    height="20"
                    viewBox="0 0 16 20"
                    fill="none"
                    className="drop-shadow-md"
                  >
                    <path
                      d="M1 1L1 14L5.5 10.5L10 18L13 16.5L8.5 9L14 8L1 1Z"
                      fill={participant.color}
                      stroke="white"
                      strokeWidth="1.5"
                    />
                  </svg>
                  {/* Name tag */}
                  <div
                    className="ml-3 -mt-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
                    style={{ backgroundColor: participant.color }}
                  >
                    {participant.name}
                    {participant.isTyping && (
                      <span className="ml-1 animate-pulse">●</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
});
