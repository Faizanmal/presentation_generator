"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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

export default function SlideCanvas({ projectId, slide, theme }: SlideCanvasProps) {

  const { updateBlock, deleteBlock, reorderBlocks } = useEditorStore();
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

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
  };

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
  }, [slide.blocks?.length, slide.id, addBlockMutation]);

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
  // const primaryColor = theme?.colors?.primary || "#3b82f6";
  // const secondaryColor = theme?.colors?.secondary || "#8b5cf6";
  // const accentColor = theme?.colors?.accent || "#10b981";

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

  // Handle block reorder
  const handleBlockReorder = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !slide.blocks) { return; }

    const oldIndex = slide.blocks.findIndex((b) => b.id === active.id);
    const newIndex = slide.blocks.findIndex((b) => b.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      reorderBlocks(slide.id, oldIndex, newIndex);
      // Update via API
      const reordered = arrayMove(slide.blocks, oldIndex, newIndex);
      api.blocks.reorder(
        projectId,
        slide.id,
        reordered.map((b, i) => ({ id: b.id, order: i }))
      );
    }
  };

  // Sort blocks by order
  const sortedBlocks = [...(slide.blocks || [])].sort((a, b) => a.order - b.order);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleBlockReorder}
    >
      <div
        ref={canvasRef}
        className="w-full max-w-4xl aspect-16/10 rounded-lg shadow-xl overflow-hidden relative"
        style={{
          backgroundColor: bgColor,
          color: textColor,
          fontFamily: theme?.fonts?.body || "system-ui",
        }}
      >
        <div className="h-full p-8 overflow-y-auto">
          <SortableContext
            items={sortedBlocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedBlocks.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <p className="mb-2">Click the + button above to add content</p>
                  <p className="text-sm">
                    or type{" "}
                    <span className="bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-gray-300 font-mono text-xs">
                      /
                    </span>{" "}
                    for commands
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedBlocks.map((block) => (
                  <BlockRenderer
                    key={block.id}
                    block={block}
                    theme={theme}
                    isActive={activeBlockId === block.id}
                    onFocus={() => setActiveBlockId(block.id)}
                    onBlur={() => setActiveBlockId(null)}
                    onChange={(content) => handleBlockChange(block.id, content)}
                    onDelete={() => handleBlockDelete(block.id)}
                  />
                ))}

                {/* Slash command hint at end of content */}
                <div className="text-slate-400 italic text-sm py-2">
                  Type{" "}
                  <span className="bg-gray-100 dark:bg-slate-700 px-1 rounded border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-gray-300 font-mono text-xs">
                    /
                  </span>{" "}
                  for commands
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
