"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useEditorStore } from "@/stores/editor-store";
import type { Block, BlockType, Slide } from "@/types";

const TEXT_BLOCK_TYPES: BlockType[] = [
  "HEADING",
  "SUBHEADING",
  "PARAGRAPH",
  "QUOTE",
  "BULLET_LIST",
  "NUMBERED_LIST",
];

function getBlockText(block: Block): string {
  const content = block.content;
  if (typeof content?.text === "string" && content.text.trim()) {
    return content.text;
  }
  if (Array.isArray(content?.items) && content.items.length > 0) {
    return content.items
      .map((item) => (typeof item === "string" ? item : String((item as { text?: string }).text || "")))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function slidePlainText(slide: Slide | undefined): string {
  if (!slide?.blocks?.length) {
    return "";
  }
  return slide.blocks
    .map((block) => getBlockText(block))
    .filter(Boolean)
    .join("\n\n");
}

const ACTION_INSTRUCTIONS: Record<string, string> = {
  enhance: "Improve clarity, tone, and impact while keeping the original meaning. Return only the rewritten text.",
  improve: "Improve clarity, tone, and impact while keeping the original meaning. Return only the rewritten text.",
  summarize: "Summarize this slide into concise presentation copy. Keep key facts. Return only the rewritten text.",
  shorten: "Make this text shorter and more concise while keeping the key message. Return only the rewritten text.",
  expand: "Expand this text with one or two concrete details while staying slide-appropriate. Return only the rewritten text.",
  prompt: "Rewrite this slide content to better match the user's request. Return only the rewritten text.",
};

export function useEditorAiActions(projectId: string) {
  const queryClient = useQueryClient();
  const addBlock = useEditorStore((state) => state.addBlock);
  const updateBlock = useEditorStore((state) => state.updateBlock);
  const updateSlide = useEditorStore((state) => state.updateSlide);

  const refreshProject = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
  }, [projectId, queryClient]);

  const enhanceCurrentSlide = useCallback(
    async (action: string, prompt?: string) => {
      const { project, currentSlideIndex } = useEditorStore.getState();
      const slide = project?.slides?.[currentSlideIndex];
      if (!slide) {
        toast.error("No slide selected");
        return;
      }

      const textBlocks = (slide.blocks || [])
        .filter((block) => TEXT_BLOCK_TYPES.includes(block.type || (block.blockType as BlockType)))
        .map((block) => ({ block, text: getBlockText(block) }))
        .filter((item) => item.text.trim().length > 0)
        .slice(0, 10);

      if (textBlocks.length === 0) {
        toast.error("This slide has no text to enhance");
        return;
      }

      const instruction =
        action === "prompt" && prompt
          ? `${ACTION_INSTRUCTIONS.prompt} User request: ${prompt}`
          : ACTION_INSTRUCTIONS[action] || ACTION_INSTRUCTIONS.enhance;

      const loading = toast.loading("Enhancing slide with AI...");
      try {
        const { results } = await api.batchEnhance(
          textBlocks.map(({ block, text }) => ({ id: block.id, content: text })),
          instruction,
        );

        await Promise.all(
          results
            .filter((result) => result.success && result.content)
            .map(async (result) => {
              const original = textBlocks.find((item) => item.block.id === result.id);
              if (!original) {
                return;
              }
              const nextContent = { ...original.block.content, text: result.content };
              updateBlock(slide.id, result.id, { content: nextContent });
              await api.blocks.update(projectId, slide.id, result.id, { content: nextContent });
            }),
        );

        toast.success("Slide updated");
        refreshProject();
      } catch {
        toast.error("AI enhancement failed. Check your plan limit and try again.");
      } finally {
        toast.dismiss(loading);
      }
    },
    [projectId, refreshProject, updateBlock],
  );

  const generateSpeakerNotes = useCallback(async () => {
    const { project, currentSlideIndex } = useEditorStore.getState();
    const slide = project?.slides?.[currentSlideIndex];
    const content = slidePlainText(slide);
    if (!slide || !content) {
      toast.error("This slide has no content for speaker notes");
      return;
    }

    const loading = toast.loading("Generating speaker notes...");
    try {
      const { notes } = await api.generateSpeakerNotes(content);
      if (!notes) {
        throw new Error("Empty notes");
      }
      updateSlide(slide.id, { speakerNotes: notes });
      await api.updateSlide(slide.id, { speakerNotes: notes });
      toast.success("Speaker notes added");
      refreshProject();
    } catch {
      toast.error("Failed to generate speaker notes");
    } finally {
      toast.dismiss(loading);
    }
  }, [refreshProject, updateSlide]);

  const addVisualsToSlide = useCallback(async () => {
    const { project, currentSlideIndex } = useEditorStore.getState();
    const slide = project?.slides?.[currentSlideIndex];
    if (!slide) {
      toast.error("No slide selected");
      return;
    }

    const promptSource = slidePlainText(slide) || slide.title || project?.title || "presentation visual";
    const loading = toast.loading("Generating a slide visual...");
    try {
      const response = await api.generateImage(
        `Professional 16:9 presentation photograph, no text overlay. Visual for: ${promptSource.slice(0, 400)}`,
        { size: "1792x1024", style: "natural" },
      );
      const imageUrl = response.data?.imageUrl;
      if (!imageUrl) {
        throw new Error("No image URL");
      }

      const newBlock = await api.blocks.create(projectId, slide.id, {
        projectId,
        blockType: "IMAGE",
        content: { url: imageUrl, alt: slide.title || "Generated visual" },
        order: slide.blocks?.length || 0,
      });
      addBlock(slide.id, newBlock);
      toast.success("Visual added to slide");
      refreshProject();
    } catch {
      toast.error("Failed to generate a visual");
    } finally {
      toast.dismiss(loading);
    }
  }, [addBlock, projectId, refreshProject]);

  const runAiAction = useCallback(
    async (action: string, prompt?: string) => {
      if (action === "speaker-notes") {
        await generateSpeakerNotes();
        return;
      }
      if (action === "add-visuals" || action === "visuals") {
        await addVisualsToSlide();
        return;
      }
      await enhanceCurrentSlide(action, prompt);
    },
    [addVisualsToSlide, enhanceCurrentSlide, generateSpeakerNotes],
  );

  return { runAiAction };
}
