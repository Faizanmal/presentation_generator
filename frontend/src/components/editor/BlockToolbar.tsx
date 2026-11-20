"use client";

import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ComponentType } from "react";
import {
  Plus,
  Type,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Image,
  Code2,
  Quote,
  Minus,
  Table,
  Video,
  ChevronDown,
  Layout,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Slide, BlockType, BlockContent } from "@/types";
import { api } from "@/lib/api";
import { useEditorStore } from "@/stores/editor-store";

interface BlockToolbarProps {
  projectId: string;
  slide?: Slide;
  onRegenerateSlide?: () => void;
  onLayoutChange?: (layout: string) => void;
}

const LAYOUT_OPTIONS = [
  { id: 'title-hero', label: 'Title Hero' },
  { id: 'two-column', label: 'Two Column' },
  { id: 'three-column', label: 'Three Column Cards' },
  { id: 'image-left', label: 'Image Left' },
  { id: 'image-right', label: 'Image Right' },
  { id: 'stats-grid', label: 'Stats Grid' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'quote-highlight', label: 'Quote Highlight' },
  { id: 'bento-grid', label: 'Bento Grid' },
  { id: 'single-column', label: 'Single Column' },
];

const BLOCK_TYPES: { type: BlockType; label: string; icon: ComponentType<{ className?: string }>; content: BlockContent }[] = [
  { type: "HEADING" as BlockType, label: "Heading", icon: Heading1, content: { text: "Heading" } },
  { type: "SUBHEADING" as BlockType, label: "Subheading", icon: Heading2, content: { text: "Subheading" } },
  { type: "PARAGRAPH" as BlockType, label: "Paragraph", icon: Type, content: { text: "Start typing..." } },
  { type: "BULLET_LIST" as BlockType, label: "Bullet List", icon: List, content: { items: ["Item 1", "Item 2", "Item 3"] } },
  { type: "NUMBERED_LIST" as BlockType, label: "Numbered List", icon: ListOrdered, content: { items: ["Item 1", "Item 2", "Item 3"] } },
  { type: "IMAGE" as BlockType, label: "Image", icon: Image, content: { url: "", alt: "" } },
  { type: "CODE" as BlockType, label: "Code", icon: Code2, content: { code: "// Your code here", language: "javascript" } },
  { type: "QUOTE" as BlockType, label: "Quote", icon: Quote, content: { text: "Quote text...", author: "" } },
  { type: "DIVIDER" as BlockType, label: "Divider", icon: Minus, content: {} },
  { type: "TABLE" as BlockType, label: "Table", icon: Table, content: { rows: [["Header 1", "Header 2", "Header 3"], ["Cell 1", "Cell 2", "Cell 3"]] } },
  { type: "EMBED" as BlockType, label: "Embed", icon: Video, content: { url: "" } },
];

export default function BlockToolbar({
  projectId,
  slide,
  onRegenerateSlide,
  onLayoutChange,
}: BlockToolbarProps) {

  const addBlock = useEditorStore((state) => state.addBlock);
  const [isAdding, setIsAdding] = useState(false);

  // Add block mutation
  const addBlockMutation = useMutation({

    mutationFn: (data: { projectId: string; blockType: BlockType; content: BlockContent; order: number }) => {
      if (!slide?.id) { throw new Error("Slide not found"); }
      return api.blocks.create(projectId, slide.id, data);
    },
    onSuccess: (newBlock) => {
      if (slide?.id) { addBlock(slide.id, newBlock); }
      toast.success("Block added");
    },
    onError: () => {
      toast.error("Failed to add block");
    },
    onSettled: () => {
      setIsAdding(false);
    },
  });


  const handleAddBlock = useCallback((type: BlockType, content: BlockContent) => {
    if (!slide) { return; }
    setIsAdding(true);
    const order = slide.blocks?.length || 0;
    addBlockMutation.mutate({ projectId, blockType: type, content, order });
  }, [slide, projectId, addBlockMutation]);

  if (!slide) { return null; }

  return (
    <div className="h-12 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 gap-2 shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isAdding}>
            <Plus className="h-4 w-4 mr-2" />
            Add Block
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
            Text
          </div>
          {BLOCK_TYPES.slice(0, 3).map((block) => (
            <DropdownMenuItem
              key={block.type}
              onClick={() => handleAddBlock(block.type, block.content)}
            >
              <block.icon className="mr-2 h-4 w-4" />
              {block.label}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
            Lists
          </div>
          {BLOCK_TYPES.slice(3, 5).map((block) => (
            <DropdownMenuItem
              key={block.type}
              onClick={() => handleAddBlock(block.type, block.content)}
            >
              <block.icon className="mr-2 h-4 w-4" />
              {block.label}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
            Media & Code
          </div>
          {BLOCK_TYPES.slice(5, 8).map((block) => (
            <DropdownMenuItem
              key={block.type}
              onClick={() => handleAddBlock(block.type, block.content)}
            >
              <block.icon className="mr-2 h-4 w-4" />
              {block.label}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
            Layout
          </div>
          {BLOCK_TYPES.slice(8).map((block) => (
            <DropdownMenuItem
              key={block.type}
              onClick={() => handleAddBlock(block.type, block.content)}
            >
              <block.icon className="mr-2 h-4 w-4" />
              {block.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Quick add buttons */}
      <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-2 ml-2">
        {BLOCK_TYPES.slice(0, 5).map((block) => (
          <Button
            key={block.type}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleAddBlock(block.type, block.content)}
            disabled={isAdding}
            title={block.label}
          >
            <block.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      {onLayoutChange && slide && (
        <div className="flex items-center border-l border-slate-200 dark:border-slate-700 pl-2 ml-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 text-xs font-medium text-slate-700 dark:text-slate-300">
                <Layout className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                <span className="hidden sm:inline">Layout: </span>{slide.layout || 'Default'}
                <ChevronDown className="h-3 w-3 ml-1 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {LAYOUT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.id}
                  onClick={() => onLayoutChange(opt.id)}
                  className={slide.layout === opt.id ? "bg-slate-100 dark:bg-slate-800 font-semibold" : ""}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {onRegenerateSlide && (
        <div className="flex items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRegenerateSlide}
                  className="h-8 text-xs font-medium text-slate-700 dark:text-slate-300"
                  aria-label="Regenerate this slide"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                  <span className="hidden md:inline">Regenerate this slide</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Re-pick visuals and layout for this slide only</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
