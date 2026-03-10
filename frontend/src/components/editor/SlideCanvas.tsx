"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import type {
  DragEndEvent
} from "@dnd-kit/core";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import type { Slide, Theme, UpdateBlockInput, BlockContent, BlockType } from "@/types";
import { api } from "@/lib/api";
import { useEditorStore } from "@/stores/editor-store";
import BlockRenderer from "./BlockRenderer";
import { SlashCommandMenu, useSlashCommands } from "./slash-commands";

interface SlideCanvasProps {
  projectId: string;
  slide: Slide;
  theme?: Theme;
}

// Slash command block type mapping
const COMMAND_TO_BLOCK: Record<string, { type: BlockType; content: BlockContent }> = {
  heading1: { type: "HEADING", content: { text: "Heading" } },
  heading2: { type: "SUBHEADING", content: { text: "Subheading" } },
  paragraph: { type: "PARAGRAPH", content: { text: "Start typing..." } },
  bulletList: { type: "BULLET_LIST", content: { items: ["Item 1", "Item 2", "Item 3"] } },
  numberedList: { type: "NUMBERED_LIST", content: { items: ["Item 1", "Item 2", "Item 3"] } },
  quote: { type: "QUOTE", content: { text: "Quote text...", author: "" } },
  code: { type: "CODE", content: { code: "// Your code here", language: "javascript" } },
  image: { type: "IMAGE", content: { url: "", alt: "" } },
  video: { type: "EMBED", content: { url: "" } },
  chart: { type: "EMBED", content: { url: "" } },
  table: { type: "TABLE", content: { rows: [["Header 1", "Header 2", "Header 3"], ["Cell 1", "Cell 2", "Cell 3"]] } },
  divider: { type: "DIVIDER", content: {} },
  columns: { type: "PARAGRAPH", content: { text: "Column layout" } },
  link: { type: "PARAGRAPH", content: { text: "Link text" } },
  aiGenerate: { type: "PARAGRAPH", content: { text: "AI Generated content..." } },
  // New block types
  embed: { type: "OEMBED", content: { embedUrl: "", embedType: "generic", embedHtml: "", embedAspectRatio: "16/9" } },
  shape: { type: "SHAPE", content: { svg: "", shapeName: "rectangle", shapeColor: "#3b82f6" } },
};

/** Generate a subtle decorative background SVG pattern */
const getDecoPattern = (primaryColor: string, layout: string): React.ReactNode => {
  const r = parseInt(primaryColor.slice(1, 3), 16);
  const g = parseInt(primaryColor.slice(3, 5), 16);
  const b = parseInt(primaryColor.slice(5, 7), 16);
  const colorLight = `rgba(${r}, ${g}, ${b}, 0.04)`;
  const colorMedium = `rgba(${r}, ${g}, ${b}, 0.07)`;

  if (layout === 'title') {
    return (
      <>
        {/* Large gradient circle - top right */}
        <div
          className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-60 pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${colorMedium} 0%, transparent 70%)`,
          }}
        />
        {/* Smaller circle - bottom left */}
        <div
          className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full opacity-40 pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${colorMedium} 0%, transparent 70%)`,
          }}
        />
        {/* Subtle diagonal line accent */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, transparent 40%, ${colorLight} 50%, transparent 60%)`,
          }}
        />
      </>
    );
  }

  if (layout === 'stats-grid' || layout === 'chart-focus') {
    return (
      <>
        {/* Grid dots pattern */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(${colorMedium} 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
      </>
    );
  }

  if (layout === 'quote-highlight') {
    return (
      <>
        {/* Large decorative quote background */}
        <div
          className="absolute top-4 left-4 text-[200px] leading-none font-serif opacity-[0.03] pointer-events-none select-none"
          style={{ color: primaryColor }}
        >
          &ldquo;
        </div>
        <div
          className="absolute bottom-0 right-0 w-64 h-64 rounded-tl-full opacity-30 pointer-events-none"
          style={{
            background: `radial-gradient(circle at bottom right, ${colorLight} 0%, transparent 70%)`,
          }}
        />
      </>
    );
  }

  if (layout === 'timeline') {
    return (
      <>
        {/* Vertical timeline accent */}
        <div
          className="absolute left-12 top-8 bottom-8 w-0.5 opacity-15 pointer-events-none"
          style={{
            background: `repeating-linear-gradient(180deg, ${primaryColor} 0px, ${primaryColor} 8px, transparent 8px, transparent 16px)`,
          }}
        />
        {/* Small dots at intervals */}
        {[20, 40, 60, 80].map((pct) => (
          <div
            key={pct}
            className="absolute left-[44px] w-2 h-2 rounded-full opacity-15 pointer-events-none"
            style={{
              top: `${pct}%`,
              backgroundColor: primaryColor,
            }}
          />
        ))}
      </>
    );
  }

  if (layout === 'comparison') {
    return (
      <>
        {/* Center divider */}
        <div
          className="absolute top-8 bottom-8 left-1/2 w-px opacity-15 pointer-events-none"
          style={{ backgroundColor: primaryColor }}
        />
        {/* VS badge */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full opacity-10 pointer-events-none flex items-center justify-center"
          style={{ backgroundColor: primaryColor }}
        />
      </>
    );
  }

  // Default subtle accent for content slides
  return (
    <>
      <div
        className="absolute top-0 right-0 w-48 h-48 rounded-bl-full opacity-30 pointer-events-none"
        style={{
          background: `radial-gradient(circle at top right, ${colorLight} 0%, transparent 70%)`,
        }}
      />
      {/* Subtle bottom gradient accent */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1 opacity-60 pointer-events-none"
        style={{
          background: `linear-gradient(90deg, ${colorMedium}, transparent 50%, ${colorMedium})`,
        }}
      />
    </>
  );
};

export default function SlideCanvas({ projectId, slide, theme }: SlideCanvasProps) {
  const updateBlock = useEditorStore((state) => state.updateBlock);
  const deleteBlock = useEditorStore((state) => state.deleteBlock);
  const reorderBlocks = useEditorStore((state) => state.reorderBlocks);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Add block from slash command
  const addBlockMutation = useMutation({
    mutationFn: (data: { blockType: BlockType; content: BlockContent; order: number }) =>
      api.blocks.create(projectId, slide.id, { projectId, ...data }),
    onSuccess: (newBlock) => {
      const { addBlock } = useEditorStore.getState();
      addBlock(slide.id, newBlock);
      toast.success("Block added");
    },
    onError: () => {
      toast.error("Failed to add block");
    },
  });

  const handleInsertBlock = useCallback((commandId: string) => {
    const blockDef = COMMAND_TO_BLOCK[commandId];
    if (blockDef) {
      const order = slide.blocks?.length || 0;
      addBlockMutation.mutate({ blockType: blockDef.type, content: blockDef.content, order });
    }
  }, [slide.blocks?.length, addBlockMutation]);

  // Slash commands integration
  const {
    isOpen: isSlashMenuOpen,
    position: slashMenuPosition,
    handleKeyDown: slashHandleKeyDown,
    handleSelect: slashHandleSelect,
    handleClose: slashHandleClose,
  } = useSlashCommands(handleInsertBlock);

  // Attach slash commands keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      slashHandleKeyDown(e);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [slashHandleKeyDown]);

  // Theme colors
  const bgColor = theme?.colors?.background || "#ffffff";
  const textColor = theme?.colors?.text || "#1f2937";
  const primaryColor = theme?.colors?.primary || "#3b82f6";

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Update block mutation
  const updateBlockMutation = useMutation({
    mutationFn: ({ blockId, data }: { blockId: string; data: UpdateBlockInput }) =>
      api.blocks.update(projectId, slide.id, blockId, data),
    onError: () => {
      toast.error("Failed to update block");
    },
  });

  // Delete block mutation
  const deleteBlockMutation = useMutation({
    mutationFn: (blockId: string) => api.blocks.delete(projectId, slide.id, blockId),
    onSuccess: (_, blockId) => {
      deleteBlock(slide.id, blockId);
    },
    onError: () => {
      toast.error("Failed to delete block");
    },
  });

  // Handle block content change
  const handleBlockChange = useCallback(

    (blockId: string, content: Record<string, unknown>) => {
      const blockContent = content as BlockContent;
      updateBlock(slide.id, blockId, { content: blockContent });
      updateBlockMutation.mutate({ blockId, data: { content: blockContent } });
    },
    [slide.id, updateBlock, updateBlockMutation]
  );

  // Handle block delete
  const handleBlockDelete = useCallback(
    (blockId: string) => {
      deleteBlockMutation.mutate(blockId);
    },
    [deleteBlockMutation]
  );

  // Handle block focus/blur
  const _handleBlockFocus = useCallback((blockId: string) => {
    setActiveBlockId(blockId);
  }, []);

  const _handleBlockBlur = useCallback(() => {
    setActiveBlockId(null);
  }, []);

  // Handle block reorder — also persists position data when blocks have absolute style
  const handleBlockReorder = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !slide.blocks) { return; }

    const oldIndex = slide.blocks.findIndex((b) => b.id === active.id);
    const newIndex = slide.blocks.findIndex((b) => b.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      reorderBlocks(slide.id, oldIndex, newIndex);
      const reordered = arrayMove(slide.blocks, oldIndex, newIndex);
      api.blocks.reorder(
        projectId,
        slide.id,
        reordered.map((b, i) => ({ id: b.id, order: i }))
      );
    }
  };

  // Save absolute position when a block is dragged on the canvas
  const handleBlockPositionChange = useCallback(
    (blockId: string, position: { x: number; y: number; width?: number; height?: number }) => {
      const currentBlock = slide.blocks?.find(b => b.id === blockId);
      const newStyle = {
        ...((currentBlock?.style || {}) as Record<string, unknown>),
        x: position.x,
        y: position.y,
        ...(position.width != null && { width: position.width }),
        ...(position.height != null && { height: position.height }),
      };
      updateBlock(slide.id, blockId, { style: newStyle as import('@/types').BlockStyle });
      updateBlockMutation.mutate({ blockId, data: { style: newStyle as import('@/types').BlockStyle } });
    },
    [slide.id, slide.blocks, updateBlock, updateBlockMutation]
  );

  // Sort blocks by order
  const sortedBlocks = useMemo(() => [...(slide.blocks || [])].sort((a, b) => a.order - b.order), [slide.blocks]);

  // Expose position handler for advanced canvas mode (used by WhiteboardCanvas integration)
  void handleBlockPositionChange;

  // Determine layout for decorative treatment
  const slideLayout = slide.layout || 'content';

  // Determine if this is a title slide (first slide usually)
  const isTitleSlide = slideLayout === 'title' || sortedBlocks.some(
    b => (b.type || b.blockType) === 'HEADING' && b.order === 0 && sortedBlocks.length <= 3
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleBlockReorder}
    >
      <div
        ref={canvasRef}
        className="w-full max-w-4xl aspect-16/10 rounded-2xl shadow-2xl overflow-hidden relative transition-all duration-300"
        style={{
          backgroundColor: bgColor,
          color: textColor,
          fontFamily: theme?.fonts?.body || "'Inter', system-ui",
          boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)`,
        }}
      >
        {/* Decorative background pattern based on layout */}
        {getDecoPattern(primaryColor, isTitleSlide ? 'title' : slideLayout)}

        <div
          className={`h-full overflow-y-auto relative z-10 ${isTitleSlide
            ? "flex flex-col items-center justify-center p-12"
            : "p-8"
            }`}
        >
          <SortableContext
            items={sortedBlocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedBlocks.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">✨</span>
                  </div>
                  <p className="text-lg font-medium text-slate-500 dark:text-slate-400">
                    Click the + button above to add content
                  </p>
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    or type{" "}
                    <span className="inline-flex items-center bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-mono text-xs shadow-sm">
                      /
                    </span>{" "}
                    for commands
                  </p>
                </div>
              </div>
            ) : (
              <div className={`space-y-5 ${isTitleSlide ? "text-center w-full max-w-2xl" : ""}`}>
                {sortedBlocks.map((block, index) => (
                  <BlockRenderer
                    key={block.id}
                    block={block}
                    theme={theme}
                    isActive={activeBlockId === block.id}
                    blockIndex={index}
                    onFocus={() => setActiveBlockId(block.id)}
                    onBlur={() => setActiveBlockId(null)}
                    onChange={(content) => handleBlockChange(block.id, content)}
                    onDelete={() => handleBlockDelete(block.id)}
                  />
                ))}

                {/* Slash command hint at end of content */}
                <div className="text-slate-400/60 italic text-sm py-3 flex items-center justify-center gap-1.5">
                  <span>Type</span>
                  <span className="inline-flex items-center bg-slate-100/60 dark:bg-slate-700/60 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-600/60 text-slate-500 dark:text-slate-400 font-mono text-xs">
                    /
                  </span>
                  <span>for commands</span>
                </div>
              </div>
            )}
          </SortableContext>
        </div>

        {/* Slash Command Menu */}
        <SlashCommandMenu
          isOpen={isSlashMenuOpen}
          position={slashMenuPosition}
          onClose={slashHandleClose}
          onSelect={slashHandleSelect}
        />
      </div>
    </DndContext>
  );
}
