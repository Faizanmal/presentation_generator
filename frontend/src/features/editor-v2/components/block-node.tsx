"use client";

import { useRef, useState, useCallback, type PointerEvent as ReactPointerEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GripVertical, Image as ImageIcon, Lock, Trash2, Copy, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { springDrag, springSnappy, motionTiming, motionEase } from "../lib/motion";
import { BLOCK_TYPE_CONFIG } from "../constants/editor";
import type { EditorBlock } from "../types";

interface BlockNodeProps {
  block: EditorBlock;
  isSelected: boolean;
  zoom: number;
  editable: boolean;
  onSelect: (blockId: string) => void;
  onContentChange: (blockId: string, text: string) => void;
  onFrameChange: (blockId: string, frame: Partial<EditorBlock["frame"]>) => void;
  onDelete?: (blockId: string) => void;
  onDuplicate?: (blockId: string) => void;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface ResizeState {
  handle: ResizeHandle;
  pointerId: number;
  startX: number;
  startY: number;
  originFrame: EditorBlock["frame"];
}

const RESIZE_HANDLES: Array<{ id: ResizeHandle; cursor: string; className: string }> = [
  { id: "nw", cursor: "nwse-resize", className: "-left-1 -top-1" },
  { id: "ne", cursor: "nesw-resize", className: "-right-1 -top-1" },
  { id: "sw", cursor: "nesw-resize", className: "-bottom-1 -left-1" },
  { id: "se", cursor: "nwse-resize", className: "-bottom-1 -right-1" },
  { id: "n", cursor: "ns-resize", className: "-top-1 left-1/2 -translate-x-1/2" },
  { id: "s", cursor: "ns-resize", className: "-bottom-1 left-1/2 -translate-x-1/2" },
  { id: "w", cursor: "ew-resize", className: "-left-1 top-1/2 -translate-y-1/2" },
  { id: "e", cursor: "ew-resize", className: "-right-1 top-1/2 -translate-y-1/2" },
];

const MIN_BLOCK_SIZE = 48;

export function BlockNode({
  block,
  isSelected,
  zoom,
  editable,
  onSelect,
  onContentChange,
  onFrameChange,
  onDelete,
  onDuplicate,
}: BlockNodeProps) {
  const dragState = useRef<DragState | null>(null);
  const resizeState = useRef<ResizeState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocusedEditing, setIsFocusedEditing] = useState(false);

  const config = BLOCK_TYPE_CONFIG[block.type] ?? BLOCK_TYPE_CONFIG.paragraph;

  // ── Drag handling ────────────────────────────────────────────────
  const startDragging = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!editable || block.locked || isFocusedEditing) {
        return;
      }

      event.stopPropagation();
      onSelect(block.id);

      dragState.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: block.frame.x,
        originY: block.frame.y,
      };

      setIsDragging(true);

      const move = (moveEvent: PointerEvent) => {
        if (!dragState.current || moveEvent.pointerId !== dragState.current.pointerId) {
          return;
        }

        const deltaX = (moveEvent.clientX - dragState.current.startX) / zoom;
        const deltaY = (moveEvent.clientY - dragState.current.startY) / zoom;

        onFrameChange(block.id, {
          x: Math.round(dragState.current.originX + deltaX),
          y: Math.round(dragState.current.originY + deltaY),
        });
      };

      const up = (upEvent: PointerEvent) => {
        if (!dragState.current || upEvent.pointerId !== dragState.current.pointerId) {
          return;
        }

        dragState.current = null;
        setIsDragging(false);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [block.frame.x, block.frame.y, block.id, block.locked, editable, isFocusedEditing, onFrameChange, onSelect, zoom],
  );

  // ── Resize handling ──────────────────────────────────────────────
  const startResizing = useCallback(
    (handle: ResizeHandle, event: ReactPointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      event.preventDefault();

      resizeState.current = {
        handle,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originFrame: { ...block.frame },
      };

      setIsResizing(true);

      const move = (moveEvent: PointerEvent) => {
        if (!resizeState.current || moveEvent.pointerId !== resizeState.current.pointerId) {
          return;
        }

        const deltaX = (moveEvent.clientX - resizeState.current.startX) / zoom;
        const deltaY = (moveEvent.clientY - resizeState.current.startY) / zoom;
        const origin = resizeState.current.originFrame;
        const h = resizeState.current.handle;

        let x = origin.x;
        let y = origin.y;
        let width = origin.width;
        let height = origin.height;

        if (h.includes("e")) {
          width = Math.max(MIN_BLOCK_SIZE, origin.width + deltaX);
        }
        if (h.includes("w")) {
          width = Math.max(MIN_BLOCK_SIZE, origin.width - deltaX);
          x = origin.x + (origin.width - width);
        }
        if (h.includes("s")) {
          height = Math.max(MIN_BLOCK_SIZE, origin.height + deltaY);
        }
        if (h.includes("n")) {
          height = Math.max(MIN_BLOCK_SIZE, origin.height - deltaY);
          y = origin.y + (origin.height - height);
        }

        onFrameChange(block.id, {
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(width),
          height: Math.round(height),
        });
      };

      const up = (upEvent: PointerEvent) => {
        if (!resizeState.current || upEvent.pointerId !== resizeState.current.pointerId) {
          return;
        }

        resizeState.current = null;
        setIsResizing(false);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [block.frame, block.id, onFrameChange, zoom],
  );

  const showActions = isSelected && editable && !isDragging && !isResizing;

  return (
    <motion.div
      layout={!isDragging && !isResizing}
      layoutId={`block-${block.id}`}
      onPointerDown={startDragging}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(block.id);
      }}
      onDoubleClick={() => {
        if (block.type !== "image" && block.type !== "chart") {
          setIsFocusedEditing(true);
        }
      }}
      animate={{
        scale: isDragging ? 1.02 : 1,
        boxShadow: isDragging
          ? "0 24px 48px rgba(0,0,0,0.15)"
          : isSelected
            ? "var(--pd-shadow-glow)"
            : "none",
      }}
      transition={isDragging ? springDrag : springSnappy}
      className={cn(
        "group absolute overflow-hidden rounded-xl border transition-colors",
        isDragging && "z-50 cursor-grabbing",
        isSelected
          ? "border-pd-accent"
          : isHovered
            ? "border-pd-border-strong"
            : "border-transparent",
        block.locked && "opacity-70",
      )}
      style={{
        left: block.frame.x,
        top: block.frame.y,
        width: block.frame.width,
        height: block.frame.height,
        transform: `rotate(${block.frame.rotation}deg)`,
        zIndex: isDragging ? 50 : isSelected ? 10 : 1,
      }}
    >
      {/* ── Block Content ─────────────────────────────────────────── */}
      {block.type === "image" ? (
        <div className="flex h-full items-center justify-center bg-gradient-to-br from-pd-accent-ultra-soft to-pd-panel text-pd-text-secondary transition-colors group-hover:from-pd-accent-soft">
          <div className="text-center">
            <ImageIcon className="mx-auto h-8 w-8 opacity-60" />
            <p className="mt-2 text-xs opacity-60">Click to upload or drag</p>
          </div>
        </div>
      ) : block.type === "stat" ? (
        <div className="flex h-full flex-col items-center justify-center p-4">
          <div
            contentEditable={editable && isFocusedEditing}
            suppressContentEditableWarning
            spellCheck={false}
            onFocus={() => setIsFocusedEditing(true)}
            onBlur={(event) => {
              setIsFocusedEditing(false);
              onContentChange(block.id, event.currentTarget.textContent ?? "");
            }}
            className="font-display text-5xl font-bold text-pd-accent outline-none"
          >
            {block.content.statValue || block.content.text || "0"}
          </div>
          <p className="mt-2 text-sm text-pd-text-secondary">
            {block.content.statLabel || "Metric label"}
          </p>
        </div>
      ) : block.type === "quote" ? (
        <div className="flex h-full flex-col justify-center px-6 py-4">
          <div className="mb-2 text-4xl leading-none text-pd-accent">&ldquo;</div>
          <div
            contentEditable={editable && isFocusedEditing}
            suppressContentEditableWarning
            spellCheck
            onFocus={() => setIsFocusedEditing(true)}
            onBlur={(event) => {
              setIsFocusedEditing(false);
              onContentChange(block.id, event.currentTarget.textContent ?? "");
            }}
            className="font-editorial text-xl italic leading-relaxed text-pd-text outline-none"
          >
            {block.content.text || config.placeholder}
          </div>
          {block.content.quoteAuthor && (
            <p className="mt-3 text-sm font-medium text-pd-text-secondary">
              — {block.content.quoteAuthor}
            </p>
          )}
        </div>
      ) : (
        <div
          contentEditable={editable && (isFocusedEditing || !isSelected)}
          suppressContentEditableWarning
          spellCheck
          onFocus={() => setIsFocusedEditing(true)}
          onBlur={(event) => {
            setIsFocusedEditing(false);
            onContentChange(block.id, event.currentTarget.textContent ?? "");
          }}
          className={cn(
            "h-full w-full p-4 text-pd-text outline-none transition-colors",
            config.fontClass,
            isFocusedEditing && "bg-pd-accent-ultra-soft/30",
          )}
        >
          {block.content.text || config.placeholder}
        </div>
      )}

      {/* ── Locked indicator ──────────────────────────────────────── */}
      {block.locked && (
        <div className="absolute right-2 top-2 rounded-md bg-pd-warning-soft px-1.5 py-0.5">
          <Lock className="h-3 w-3 text-pd-warning" />
        </div>
      )}

      {/* ── Hover grip handle ─────────────────────────────────────── */}
      <AnimatePresence>
        {(isHovered || isSelected) && editable && !isFocusedEditing && !block.locked && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: motionTiming.quick, ease: motionEase.out }}
            className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2 -translate-y-1/2 cursor-grab items-center gap-0.5 rounded-full border border-pd-border bg-pd-elevated px-2 py-1 shadow-xs"
          >
            <GripVertical className="h-3 w-3 text-pd-muted" />
            <span className="text-[10px] font-medium text-pd-muted">{config.label}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Quick action buttons ──────────────────────────────────── */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            transition={{ duration: motionTiming.quick, ease: motionEase.out }}
            className="absolute -right-1 -top-9 z-20 flex items-center gap-1 rounded-lg border border-pd-border bg-pd-elevated p-1 shadow-float"
          >
            {onDuplicate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(block.id);
                }}
                className="rounded-md p-1 text-pd-text-secondary transition hover:bg-pd-accent-soft hover:text-pd-text"
                aria-label="Duplicate block"
              >
                <Copy className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              className="rounded-md p-1 text-pd-text-secondary transition hover:bg-pd-accent-soft hover:text-pd-accent"
              aria-label="AI enhance"
            >
              <Sparkles className="h-3 w-3" />
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(block.id);
                }}
                className="rounded-md p-1 text-pd-text-secondary transition hover:bg-pd-danger-soft hover:text-pd-danger"
                aria-label="Delete block"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Resize handles ────────────────────────────────────────── */}
      <AnimatePresence>
        {isSelected && editable && !block.locked && !isFocusedEditing && (
          <>
            {RESIZE_HANDLES.map((handle) => (
              <motion.div
                key={handle.id}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: motionTiming.quick, ease: motionEase.out }}
                onPointerDown={(e) => startResizing(handle.id, e as unknown as ReactPointerEvent<HTMLDivElement>)}
                className={cn(
                  "absolute z-20 h-2.5 w-2.5 rounded-full border-2 border-pd-accent bg-white shadow-xs",
                  handle.className,
                )}
                style={{ cursor: handle.cursor }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* ── Selection dimension badge ─────────────────────────────── */}
      <AnimatePresence>
        {isSelected && editable && !isFocusedEditing && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: motionTiming.quick }}
            className="absolute -bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-md bg-pd-text/80 px-2 py-0.5 text-[10px] font-medium text-pd-canvas"
          >
            {Math.round(block.frame.width)} × {Math.round(block.frame.height)}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
