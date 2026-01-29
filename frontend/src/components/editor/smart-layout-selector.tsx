'use client';

import { useState } from 'react';
import { Check, Layout, LayoutGrid as LayoutGridIcon, Columns2, Image, FileText, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type LayoutType =
  | 'title'
  | 'title-content'
  | 'two-column'
  | 'image-left'
  | 'image-right'
  | 'full-image'
  | 'comparison'
  | 'quote'
  | 'chart'
  | 'list'
  | 'timeline';

interface LayoutOption {
  id: LayoutType;
  name: string;
  description: string;
  icon: React.ReactNode;
  preview: React.ReactNode;
}

const LAYOUTS: LayoutOption[] = [
  {
    id: 'title',
    name: 'Title Slide',
    description: 'Large centered title with subtitle',
    icon: <Layout className="h-4 w-4" />,
    preview: (
      <div className="w-full h-full flex flex-col items-center justify-center p-2">
        <div className="w-3/4 h-3 bg-slate-400 rounded mb-2" />
        <div className="w-1/2 h-2 bg-slate-300 rounded" />
      </div>
    ),
  },
  {
    id: 'title-content',
    name: 'Title + Content',
    description: 'Title with body content below',
    icon: <FileText className="h-4 w-4" />,
    preview: (
      <div className="w-full h-full p-2">
        <div className="w-2/3 h-2 bg-slate-400 rounded mb-2" />
        <div className="space-y-1">
          <div className="w-full h-1.5 bg-slate-200 rounded" />
          <div className="w-full h-1.5 bg-slate-200 rounded" />
          <div className="w-3/4 h-1.5 bg-slate-200 rounded" />
        </div>
      </div>
    ),
  },
  {
    id: 'two-column',
    name: 'Two Columns',
    description: 'Side by side content columns',
    icon: <Columns2 className="h-4 w-4" />,
    preview: (
      <div className="w-full h-full p-2">
        <div className="w-2/3 h-2 bg-slate-400 rounded mb-2" />
        <div className="flex gap-1">
          <div className="flex-1 space-y-1">
            <div className="w-full h-1.5 bg-slate-200 rounded" />
            <div className="w-full h-1.5 bg-slate-200 rounded" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="w-full h-1.5 bg-slate-200 rounded" />
            <div className="w-full h-1.5 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'image-left',
    name: 'Image Left',
    description: 'Image on left, content on right',
    icon: <Image className="h-4 w-4" />,
    preview: (
      <div className="w-full h-full p-2 flex gap-1">
        <div className="w-1/2 h-full bg-slate-300 rounded" />
        <div className="w-1/2 space-y-1">
          <div className="w-full h-2 bg-slate-400 rounded" />
          <div className="w-full h-1.5 bg-slate-200 rounded" />
          <div className="w-3/4 h-1.5 bg-slate-200 rounded" />
        </div>
      </div>
    ),
  },
  {
    id: 'image-right',
    name: 'Image Right',
    description: 'Content on left, image on right',
    icon: <Image className="h-4 w-4" />,
    preview: (
      <div className="w-full h-full p-2 flex gap-1">
        <div className="w-1/2 space-y-1">
          <div className="w-full h-2 bg-slate-400 rounded" />
          <div className="w-full h-1.5 bg-slate-200 rounded" />
          <div className="w-3/4 h-1.5 bg-slate-200 rounded" />
        </div>
        <div className="w-1/2 h-full bg-slate-300 rounded" />
      </div>
    ),
  },
  {
    id: 'full-image',
    name: 'Full Image',
    description: 'Full-bleed background image',
    icon: <Image className="h-4 w-4" />,
    preview: (
      <div className="w-full h-full bg-slate-300 rounded flex items-end p-1">
        <div className="w-2/3 h-2 bg-white/80 rounded" />
      </div>
    ),
  },
  {
    id: 'comparison',
    name: 'Comparison',
    description: 'Compare two items side by side',
    icon: <LayoutGridIcon className="h-4 w-4" />,
    preview: (
      <div className="w-full h-full p-2">
        <div className="w-1/2 h-2 bg-slate-400 rounded mb-2 mx-auto" />
        <div className="flex gap-1">
          <div className="flex-1 border border-slate-300 rounded p-1">
            <div className="w-full h-1 bg-green-300 rounded mb-1" />
            <div className="w-full h-1 bg-slate-200 rounded" />
          </div>
          <div className="flex-1 border border-slate-300 rounded p-1">
            <div className="w-full h-1 bg-red-300 rounded mb-1" />
            <div className="w-full h-1 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'quote',
    name: 'Quote',
    description: 'Large quote with attribution',
    icon: <FileText className="h-4 w-4" />,
    preview: (
      <div className="w-full h-full flex flex-col items-center justify-center p-2">
        <div className="w-4 h-4 text-slate-300 text-2xl">&ldquo;</div>
        <div className="w-3/4 h-2 bg-slate-300 rounded mb-1" />
        <div className="w-1/3 h-1.5 bg-slate-200 rounded" />
      </div>
    ),
  },
  {
    id: 'chart',
    name: 'Chart',
    description: 'Data visualization slide',
    icon: <BarChart3 className="h-4 w-4" />,
    preview: (
      <div className="w-full h-full p-2">
        <div className="w-1/2 h-2 bg-slate-400 rounded mb-2" />
        <div className="flex items-end gap-1 h-[60%]">
          <div className="flex-1 h-[40%] bg-blue-300 rounded-t" />
          <div className="flex-1 h-[70%] bg-blue-400 rounded-t" />
          <div className="flex-1 h-[50%] bg-blue-300 rounded-t" />
          <div className="flex-1 h-[90%] bg-blue-500 rounded-t" />
        </div>
      </div>
    ),
  },
  {
    id: 'list',
    name: 'Bullet List',
    description: 'Title with bullet points',
    icon: <FileText className="h-4 w-4" />,
    preview: (
      <div className="w-full h-full p-2">
        <div className="w-2/3 h-2 bg-slate-400 rounded mb-2" />
        <div className="space-y-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="w-1 h-1 bg-blue-400 rounded-full" />
              <div className={`h-1.5 bg-slate-200 rounded`} style={{ width: `${70 - i * 10}%` }} />
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'timeline',
    name: 'Timeline',
    description: 'Sequential events or steps',
    icon: <LayoutGridIcon className="h-4 w-4" />,
    preview: (
      <div className="w-full h-full p-2">
        <div className="w-1/2 h-2 bg-slate-400 rounded mb-2" />
        <div className="flex items-center gap-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div className="w-3 h-3 bg-blue-400 rounded-full" />
              <div className="w-0.5 h-2 bg-slate-300" />
              <div className="w-full h-1 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

interface SmartLayoutSelectorProps {
  currentLayout?: LayoutType;
  onLayoutChange: (layout: LayoutType) => void;
  className?: string;
  compact?: boolean;
}

export function SmartLayoutSelector({
  currentLayout = 'title-content',
  onLayoutChange,
  className,
  compact = false,
}: SmartLayoutSelectorProps) {
  const [open, setOpen] = useState(false);

  const currentLayoutData = LAYOUTS.find((l) => l.id === currentLayout);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={compact ? 'sm' : 'default'}
          className={cn('justify-start', className)}
        >
          {currentLayoutData?.icon}
          {!compact && (
            <span className="ml-2">{currentLayoutData?.name || 'Select Layout'}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="p-4 border-b">
          <h4 className="font-semibold">Choose Layout</h4>
          <p className="text-sm text-slate-500">Select a layout for your slide</p>
        </div>
        <div className="grid grid-cols-3 gap-2 p-4 max-h-[400px] overflow-y-auto">
          {LAYOUTS.map((layout) => (
            <button
              key={layout.id}
              className={cn(
                'relative rounded-lg border-2 p-1 transition-colors hover:border-blue-400',
                currentLayout === layout.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200',
              )}
              onClick={() => {
                onLayoutChange(layout.id);
                setOpen(false);
              }}
            >
              {/* Preview */}
              <div className="aspect-video bg-white rounded border border-slate-100 overflow-hidden">
                {layout.preview}
              </div>
              {/* Label */}
              <p className="text-xs text-center mt-1 font-medium text-slate-700 truncate">
                {layout.name}
              </p>
              {/* Checkmark */}
              {currentLayout === layout.id && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Layout grid for displaying multiple layouts
export function LayoutGrid({
  onSelect,
  className,
}: {
  onSelect: (layout: LayoutType) => void;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-4 gap-3', className)}>
      {LAYOUTS.map((layout) => (
        <button
          key={layout.id}
          className="rounded-lg border-2 border-slate-200 p-2 transition-all hover:border-blue-400 hover:shadow-md group"
          onClick={() => onSelect(layout.id)}
        >
          <div className="aspect-video bg-slate-50 rounded mb-2 overflow-hidden group-hover:bg-blue-50">
            {layout.preview}
          </div>
          <p className="text-xs font-medium text-slate-700">{layout.name}</p>
          <p className="text-xs text-slate-400 truncate">{layout.description}</p>
        </button>
      ))}
    </div>
  );
}

export default SmartLayoutSelector;
