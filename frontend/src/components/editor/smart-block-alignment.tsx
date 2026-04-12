"use client";

import { useState } from "react";
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

export interface BlockPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
}

export interface AlignmentGuide {
  type: "vertical" | "horizontal";
  position: number;
  color: string;
}

interface SmartBlockAlignmentProps {
  blocks: Array<{
    id: string;
    position: BlockPosition;
  }>;
  onUpdateBlocks: (updates: Record<string, BlockPosition>) => void;
  onShowGuides?: (guides: AlignmentGuide[]) => void;
}

const SPACING_OPTIONS = [0, 8, 16, 24, 32, 48];
const ALIGNMENT_PRESETS = [
  {
    name: "Grid 2x2",
    description: "Arrange in 2x2 grid",
    layout: "grid",
  },
  {
    name: "Horizontal Stack",
    description: "Stack horizontally with equal spacing",
    layout: "horizontal",
  },
  {
    name: "Vertical Stack",
    description: "Stack vertically with equal spacing",
    layout: "vertical",
  },
  {
    name: "Circular",
    description: "Arrange in circular pattern",
    layout: "circular",
  },
  {
    name: "Diagonal",
    description: "Arrange diagonally",
    layout: "diagonal",
  },
  {
    name: "Center Cluster",
    description: "Cluster around center",
    layout: "center",
  },
];

export function SmartBlockAlignment({
  blocks,
  onUpdateBlocks,
}: SmartBlockAlignmentProps) {
  const [spacing, setSpacing] = useState(16);
  const [selectedLayout, setSelectedLayout] = useState<string>("grid");

  const alignLeft = () => {
    if (blocks.length === 0) {return;}
    const minX = Math.min(...blocks.map((b) => b.position.x));
    const updates: Record<string, BlockPosition> = {};
    blocks.forEach((block) => {
      updates[block.id] = {
        ...block.position,
        x: minX,
      };
    });
    onUpdateBlocks(updates);
    toast.success("Aligned to left");
  };

  const alignCenter = () => {
    if (blocks.length === 0) {return;}
    const minX = Math.min(...blocks.map((b) => b.position.x));
    const maxX = Math.max(...blocks.map((b) => b.position.x + b.position.width));
    const centerX = (minX + maxX) / 2;
    const updates: Record<string, BlockPosition> = {};
    blocks.forEach((block) => {
      updates[block.id] = {
        ...block.position,
        x: centerX - block.position.width / 2,
      };
    });
    onUpdateBlocks(updates);
    toast.success("Aligned to center");
  };

  const alignRight = () => {
    if (blocks.length === 0) {return;}
    const maxX = Math.max(...blocks.map((b) => b.position.x + b.position.width));
    const updates: Record<string, BlockPosition> = {};
    blocks.forEach((block) => {
      updates[block.id] = {
        ...block.position,
        x: maxX - block.position.width,
      };
    });
    onUpdateBlocks(updates);
    toast.success("Aligned to right");
  };

  const alignTop = () => {
    if (blocks.length === 0) {return;}
    const minY = Math.min(...blocks.map((b) => b.position.y));
    const updates: Record<string, BlockPosition> = {};
    blocks.forEach((block) => {
      updates[block.id] = {
        ...block.position,
        y: minY,
      };
    });
    onUpdateBlocks(updates);
    toast.success("Aligned to top");
  };

  const alignMiddle = () => {
    if (blocks.length === 0) {return;}
    const minY = Math.min(...blocks.map((b) => b.position.y));
    const maxY = Math.max(...blocks.map((b) => b.position.y + b.position.height));
    const centerY = (minY + maxY) / 2;
    const updates: Record<string, BlockPosition> = {};
    blocks.forEach((block) => {
      updates[block.id] = {
        ...block.position,
        y: centerY - block.position.height / 2,
      };
    });
    onUpdateBlocks(updates);
    toast.success("Aligned to middle");
  };

  const alignBottom = () => {
    if (blocks.length === 0) {return;}
    const maxY = Math.max(...blocks.map((b) => b.position.y + b.position.height));
    const updates: Record<string, BlockPosition> = {};
    blocks.forEach((block) => {
      updates[block.id] = {
        ...block.position,
        y: maxY - block.position.height,
      };
    });
    onUpdateBlocks(updates);
    toast.success("Aligned to bottom");
  };

  const distributeHorizontally = () => {
    if (blocks.length < 2) {return;}
    const sorted = [...blocks].sort((a, b) => a.position.x - b.position.x);
    const totalWidth = Math.max(...sorted.map((b) => b.position.x + b.position.width)) -
      Math.min(...sorted.map((b) => b.position.x));
    const totalItemWidth = sorted.reduce((sum, b) => sum + b.position.width, 0);
    const gap = (totalWidth - totalItemWidth) / (sorted.length - 1);

    const updates: Record<string, BlockPosition> = {};
    let currentX = sorted[0].position.x;
    sorted.forEach((block, index) => {
      if (index === 0) {
        updates[block.id] = { ...block.position };
      } else {
        currentX += sorted[index - 1].position.width + gap;
        updates[block.id] = {
          ...block.position,
          x: currentX,
        };
      }
    });
    onUpdateBlocks(updates);
    toast.success("Distributed horizontally");
  };

  const distributeVertically = () => {
    if (blocks.length < 2) {return;}
    const sorted = [...blocks].sort((a, b) => a.position.y - b.position.y);
    const totalHeight = Math.max(...sorted.map((b) => b.position.y + b.position.height)) -
      Math.min(...sorted.map((b) => b.position.y));
    const totalItemHeight = sorted.reduce((sum, b) => sum + b.position.height, 0);
    const gap = (totalHeight - totalItemHeight) / (sorted.length - 1);

    const updates: Record<string, BlockPosition> = {};
    let currentY = sorted[0].position.y;
    sorted.forEach((block, index) => {
      if (index === 0) {
        updates[block.id] = { ...block.position };
      } else {
        currentY += sorted[index - 1].position.height + gap;
        updates[block.id] = {
          ...block.position,
          y: currentY,
        };
      }
    });
    onUpdateBlocks(updates);
    toast.success("Distributed vertically");
  };

  return (
    <div className="space-y-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg border border-blue-200 dark:border-blue-800">
      {/* Alignment Buttons - Horizontal */}
      <div>
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Horizontal Alignment
        </h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={alignLeft}
            title="Align left"
            className="flex-1"
          >
            <AlignLeft className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={alignCenter}
            title="Align center"
            className="flex-1"
          >
            <AlignCenter className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={alignRight}
            title="Align right"
            className="flex-1"
          >
            <AlignRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Alignment Buttons - Vertical */}
      <div>
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Vertical Alignment
        </h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={alignTop}
            title="Align top"
            className="flex-1"
          >
            ↑ Top
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={alignMiddle}
            title="Align middle"
            className="flex-1"
          >
            ↔ Mid
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={alignBottom}
            title="Align bottom"
            className="flex-1"
          >
            ↓ Bot
          </Button>
        </div>
      </div>

      {/* Distribution */}
      <div>
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Distribution
        </h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={distributeHorizontally}
            className="flex-1 text-xs"
          >
            Distribute H
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={distributeVertically}
            className="flex-1 text-xs"
          >
            Distribute V
          </Button>
        </div>
      </div>

      {/* Spacing Control */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Gap Between Items
          </label>
          <span className="text-xs font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded">
            {spacing}px
          </span>
        </div>
        <Slider
          value={[spacing]}
          onValueChange={(v) => setSpacing(v[0])}
          min={0}
          max={64}
          step={4}
          className="w-full"
        />
        <div className="flex gap-1 flex-wrap">
          {SPACING_OPTIONS.map((sp) => (
            <button
              key={sp}
              onClick={() => setSpacing(sp)}
              className={`px-2 py-1 text-xs rounded transition-all ${
                spacing === sp
                  ? "bg-blue-500 text-white"
                  : "bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {sp}
            </button>
          ))}
        </div>
      </div>

      {/* Layout Presets */}
      <div>
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Layout Presets
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {ALIGNMENT_PRESETS.map((preset) => (
            <button
              key={preset.layout}
              onClick={() => setSelectedLayout(preset.layout)}
              className={`p-3 rounded-lg text-xs text-center transition-all ${
                selectedLayout === preset.layout
                  ? "bg-blue-500 text-white shadow-lg"
                  : "bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 hover:border-blue-400"
              }`}
              title={preset.description}
            >
              <div className="font-semibold">{preset.name}</div>
              <div className="text-[10px] opacity-75 mt-1">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-600">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          💡 Select multiple blocks to use alignment and distribution tools. Precision positioning for perfect layouts.
        </p>
      </div>
    </div>
  );
}
