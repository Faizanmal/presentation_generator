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
import type { Slide, Theme, UpdateBlockInput, BlockContent, BlockType, BlockStyle } from "@/types";
import { api } from "@/lib/api";
import { useEditorStore } from "@/stores/editor-store";
import { SlashCommandMenu, useSlashCommands } from "./slash-commands";
import { LayoutCompiler } from "./LayoutCompiler";
import dynamic from "next/dynamic";

// Lazy-load 3D background to avoid SSR issues and reduce initial bundle
const Ambient3DBackground = dynamic(
  () => import("./ambient-3d-background").then(m => m.Ambient3DBackground),
  { ssr: false }
);

interface SlideCanvasProps {
  projectId: string;
  slide: Slide;
  theme?: Theme;
  presentationDensity?: number;
  presentationTone?: number;
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
  bentoGrid: {
    type: "BENTO_GRID", content: {
      items: [
        { id: '1', title: 'Revenue Growth', subtitle: '+124% YOY', icon: 'TrendingUp', color: 'accent', span: 'col-span-2 row-span-1' },
        { id: '2', title: 'Active Users', subtitle: '45.2K', icon: 'Users', color: 'primary', span: 'col-span-1 row-span-2' },
        { id: '3', title: 'Global Reach', subtitle: '12 Countries', icon: 'Zap', color: 'secondary', span: 'col-span-1 row-span-1' },
        { id: '4', title: 'New Features', subtitle: 'Automated AI workflows', icon: 'Sparkles', color: 'primary', span: 'col-span-2 row-span-1' },
      ]
    }
  },
  timeline: {
    type: "TIMELINE", content: {
      items: [
        { id: '1', title: 'Q1: Foundation', description: 'Core product development.', status: 'completed' },
        { id: '2', title: 'Q2: Marketing', description: 'Expand user base.', status: 'current' },
        { id: '3', title: 'Q3: Scaling', description: 'Enter new markets.', status: 'upcoming' },
      ]
    }
  },
  aiGenerate: { type: "PARAGRAPH", content: { text: "AI Generated content..." } },
  comparison: { type: "COMPARISON", content: { items: ["Option A: Fast and simple", "Option B: Powerful and flexible"] } },
  statsGrid: { type: "STATS_GRID", content: { items: ["📊 98% Accuracy", "⚡ 2x Faster", "🎯 500+ Users", "💰 $1.2M Saved"] } },
  // New block types
  embed: { type: "OEMBED", content: { embedUrl: "", embedType: "generic", embedHtml: "", embedAspectRatio: "16/9" } },
  shape: { type: "SHAPE", content: { svg: "", shapeName: "rectangle", shapeColor: "#3b82f6" } },
  threeDModel: { type: "3D_MODEL", content: { url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb" } },
};

import { motion } from "framer-motion";

/** Generate a subtle decorative background SVG pattern with modern animated glass blobs */
const getDecoPattern = (primaryColor: string, accentColor: string, layout: string): React.ReactNode => {
  const rPrimary = parseInt(primaryColor.slice(1, 3), 16) || 59;
  const gPrimary = parseInt(primaryColor.slice(3, 5), 16) || 130;
  const bPrimary = parseInt(primaryColor.slice(5, 7), 16) || 246;
  const colorLight = `rgba(${rPrimary}, ${gPrimary}, ${bPrimary}, 0.08)`;
  const colorMedium = `rgba(${rPrimary}, ${gPrimary}, ${bPrimary}, 0.15)`;

  const rAccent = parseInt(accentColor?.slice(1, 3) || '10', 16) || 16;
  const gAccent = parseInt(accentColor?.slice(3, 5) || 'b9', 16) || 185;
  const bAccent = parseInt(accentColor?.slice(5, 7) || '81', 16) || 129;
  const accentLight = `rgba(${rAccent}, ${gAccent}, ${bAccent}, 0.1)`;

  if (layout === 'title') {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* Animated large blob top right */}
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 90, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-40 -right-40 w-150 h-150 rounded-full blur-3xl opacity-70"
          style={{ background: `radial-gradient(circle, ${colorMedium} 0%, transparent 70%)` }}
        />
        {/* Animated blob bottom left */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, -90, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-40 -left-20 w-125 h-125 rounded-full blur-2xl opacity-60"
          style={{ background: `radial-gradient(circle, ${accentLight} 0%, transparent 70%)` }}
        />
        {/* Noise overlay for premium texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")" }} />
      </div>
    );
  }

  if (layout === 'stats-grid' || layout === 'chart-focus') {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(${colorMedium} 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute top-0 right-0 w-full h-125 bg-linear-to-b from-white/10 to-transparent blur-3xl opacity-50 dark:from-black/10" />
      </div>
    );
  }

  if (layout === 'quote-highlight') {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className="absolute -top-10 left-10 text-[300px] leading-none font-serif opacity-[0.02] pointer-events-none select-none"
          style={{ color: primaryColor }}
        >
          &ldquo;
        </div>
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-0 right-0 w-100 h-100 rounded-tl-full blur-2xl opacity-40"
          style={{ background: `radial-gradient(circle at bottom right, ${colorLight} 0%, transparent 70%)` }}
        />
      </div>
    );
  }

  if (layout === 'timeline') {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className="absolute left-18 top-8 bottom-8 w-px opacity-20"
          style={{ background: `linear-gradient(to bottom, transparent, ${primaryColor}, transparent)` }}
        />
        <div className="absolute bottom-0 right-0 w-full h-1/2 bg-linear-to-t from-[rgba(0,0,0,0.02)] to-transparent dark:from-[rgba(255,255,255,0.02)]" />
      </div>
    );
  }

  if (layout === 'comparison') {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 bg-linear-to-r from-transparent via-[rgba(0,0,0,0.02)] to-transparent dark:via-[rgba(255,255,255,0.02)]">
        <div
          className="absolute top-12 bottom-12 left-1/2 w-px opacity-20"
          style={{ background: `linear-gradient(to bottom, transparent, ${primaryColor}, transparent)` }}
        />
      </div>
    );
  }

  // Default subtle accent for content slides
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <motion.div
        animate={{ opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-40 -right-20 w-125 h-125 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle at center, ${colorLight} 0%, transparent 60%)` }}
      />
      {/* Premium subtle border glow at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px opacity-40" style={{ background: `linear-gradient(90deg, transparent, ${colorMedium}, transparent)` }} />
    </div>
  );
};

export default function SlideCanvas({
  projectId,
  slide,
  theme,
  presentationDensity = 60,
  presentationTone = 70,
}: SlideCanvasProps) {
  const updateBlock = useEditorStore((state) => state.updateBlock);
  const deleteBlock = useEditorStore((state) => state.deleteBlock);
  const reorderBlocks = useEditorStore((state) => state.reorderBlocks);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pendingBlockSyncTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
  const accentColor = theme?.colors?.accent || "#10b981";

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

  useEffect(() => {
    const timers = pendingBlockSyncTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const queueBlockSync = useCallback(
    (blockId: string, data: UpdateBlockInput, delayMs = 300) => {
      const pending = pendingBlockSyncTimersRef.current.get(blockId);
      if (pending) {
        clearTimeout(pending);
      }

      const timer = setTimeout(() => {
        updateBlockMutation.mutate({ blockId, data });
        pendingBlockSyncTimersRef.current.delete(blockId);
      }, delayMs);

      pendingBlockSyncTimersRef.current.set(blockId, timer);
    },
    [updateBlockMutation]
  );

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
      queueBlockSync(blockId, { content: blockContent }, 320);
    },
    [slide.id, updateBlock, queueBlockSync]
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
      updateBlock(slide.id, blockId, { style: newStyle as BlockStyle });
      queueBlockSync(blockId, { style: newStyle as BlockStyle }, 140);
    },
    [slide.id, slide.blocks, updateBlock, queueBlockSync]
  );

  // Hydrate zone from style JSON so LayoutCompiler can split columns
  const sortedBlocks = useMemo(
    () =>
      [...(slide.blocks || [])]
        .sort((a, b) => a.order - b.order)
        .map((block) => {
          const zoneFromStyle =
            typeof block.style?.zone === "number" ? block.style.zone : undefined;
          if (zoneFromStyle === undefined || block.zone !== undefined) return block;
          return { ...block, zone: zoneFromStyle };
        }),
    [slide.blocks]
  );

  // Expose position handler for advanced canvas mode (used by WhiteboardCanvas integration)
  void handleBlockPositionChange;

  // Normalize DSL + legacy layout names for chrome / deco
  const rawLayout = slide.layout || 'content';
  const slideLayout =
    rawLayout === 'title-hero' || rawLayout === 'title-subtitle' ? 'title' :
    rawLayout === 'quote-centered' ? 'quote-highlight' :
    rawLayout === 'single-column' || rawLayout === 'title-content' ? 'content' :
    rawLayout;
  const isDenseCanvas = presentationDensity >= 66;
  // Asymmetric safe margins (wider L/R) read more editorial than uniform padding
  const canvasPaddingClass = isDenseCanvas
    ? 'px-10 py-7'
    : presentationDensity < 34
      ? 'px-14 py-11'
      : 'px-12 py-9';

  const isTitleSlide =
    slideLayout === 'title' ||
    rawLayout === 'title-hero' ||
    rawLayout === 'title-subtitle' ||
    sortedBlocks.some(
      (b) => (b.type || b.blockType) === 'HEADING' && b.order === 0 && sortedBlocks.length <= 3
    );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleBlockReorder}
    >
      <div
        ref={canvasRef}
        className="w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden relative transition-all duration-500"
        style={{
          aspectRatio: '16 / 9',
          backgroundColor: bgColor,
          color: textColor,
          fontFamily: theme?.fonts?.body || 'var(--font-dm-sans), system-ui, sans-serif',
          boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)`,
        }}
      >
        {/* Decorative background pattern based on layout */}
        {getDecoPattern(primaryColor, accentColor, isTitleSlide ? 'title' : slideLayout)}

        {/* Quieter 3D ambient — title/hero only */}
        {isTitleSlide && (
          <Ambient3DBackground
            primaryColor={primaryColor}
            accentColor={accentColor}
            variant="floating-spheres"
            intensity={0.28}
          />
        )}

        <div
          className={`h-full overflow-hidden relative z-10 ${isTitleSlide
            ? `flex flex-col items-center justify-center ${canvasPaddingClass}`
            : canvasPaddingClass
            }`}
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
            <div className="w-full h-full">
              <LayoutCompiler
                layoutType={rawLayout}
                blocks={sortedBlocks}
                theme={theme}
                presentationDensity={presentationDensity}
                presentationTone={presentationTone}
                activeBlockId={activeBlockId}
                onFocus={setActiveBlockId}
                onBlur={() => setActiveBlockId(null)}
                onChange={handleBlockChange}
                onDelete={handleBlockDelete}
              />
            </div>
          )}
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
