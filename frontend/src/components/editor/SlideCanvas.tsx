"use client";

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
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
import { Slide, Theme, Block, UpdateBlockInput } from "@/types";
import { api } from "@/lib/api";
import { useEditorStore } from "@/stores/editor-store";
import BlockRenderer from "./BlockRenderer";

interface SlideCanvasProps {
  projectId: string;
  slide: Slide;
  theme?: Theme;
}

export default function SlideCanvas({ projectId, slide, theme }: SlideCanvasProps) {
  const queryClient = useQueryClient();
  const { updateBlock, deleteBlock, reorderBlocks } = useEditorStore();
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  // Theme colors
  const bgColor = theme?.colors?.background || "#ffffff";
  const textColor = theme?.colors?.text || "#1f2937";
  const primaryColor = theme?.colors?.primary || "#3b82f6";
  const secondaryColor = theme?.colors?.secondary || "#8b5cf6";
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (blockId: string, content: any) => {
      updateBlock(slide.id, blockId, { content });
      updateBlockMutation.mutate({ blockId, data: { content } });
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
    if (!over || active.id === over.id || !slide.blocks) return;

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
        className="w-full max-w-4xl aspect-[16/10] rounded-lg shadow-xl overflow-hidden"
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
                <p>Click the + button above to add content</p>
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
              </div>
            )}
          </SortableContext>
        </div>
      </div>
    </DndContext>
  );
}
