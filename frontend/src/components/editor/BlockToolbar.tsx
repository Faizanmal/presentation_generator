"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slide, BlockType } from "@/types";
import { api } from "@/lib/api";
import { useEditorStore } from "@/stores/editor-store";

interface BlockToolbarProps {
  projectId: string;
  slide?: Slide;
}

const BLOCK_TYPES = [
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

export default function BlockToolbar({ projectId, slide }: BlockToolbarProps) {
  const queryClient = useQueryClient();
  const { addBlock } = useEditorStore();
  const [isAdding, setIsAdding] = useState(false);

  // Add block mutation
  const addBlockMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (data: { projectId: string; blockType: BlockType; content: any; order: number }) =>
      api.blocks.create(projectId, slide!.id, data),
    onSuccess: (newBlock) => {
      addBlock(slide!.id, newBlock);
      toast.success("Block added");
    },
    onError: () => {
      toast.error("Failed to add block");
    },
    onSettled: () => {
      setIsAdding(false);
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAddBlock = (type: BlockType, content: any) => {
    if (!slide) return;
    setIsAdding(true);
    const order = slide.blocks?.length || 0;
    addBlockMutation.mutate({ projectId, blockType: type, content, order });
  };

  if (!slide) return null;

  return (
    <div className="h-12 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 gap-2 flex-shrink-0">
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
    </div>
  );
}
