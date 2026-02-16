'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
    Wand2,
    Loader2,
    Layout,
    Columns2,
    LayoutGrid,
    AlignCenter,
    Image as ImageIcon,
    Check,
    Sparkles,
} from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Block } from '@/types';

interface MagicLayoutButtonProps {
    projectId: string;
    slideId?: string;
    blocks?: Block[];
    heading?: string;
    onApplyLayout?: (layout: LayoutResult) => void;
}

export interface LayoutResult {
    name: string;
    description: string;
    layout: {
        type: string;
        alignment: string;
        spacing: string;
        blocks: unknown[];
    };
}

const QUICK_LAYOUTS = [
    { id: 'single-column', name: 'Single Column', icon: Layout, description: 'Clean single-column layout' },
    { id: 'two-column', name: 'Two Columns', icon: Columns2, description: 'Split content into two columns' },
    { id: 'grid', name: 'Grid', icon: LayoutGrid, description: 'Arrange in a grid pattern' },
    { id: 'hero', name: 'Hero Image', icon: ImageIcon, description: 'Large image with text overlay' },
    { id: 'centered', name: 'Centered', icon: AlignCenter, description: 'Center-aligned content' },
];

export function MagicLayoutButton({
    projectId,
    slideId,
    blocks,
    heading,
    onApplyLayout,
}: MagicLayoutButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [appliedLayout, setAppliedLayout] = useState<string | null>(null);
    const [suggestedLayouts, setSuggestedLayouts] = useState<LayoutResult[]>([]);

    const magicLayoutMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch('/api/ai/auto-layout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    slideId,
                    blocks: blocks?.map(b => ({
                        type: b.type,
                        content: b.content,
                    })),
                    heading,
                }),
            });
            return response.json();
        },
        onSuccess: (data) => {
            if (data?.suggestions) {
                setSuggestedLayouts(data.suggestions);
            } else if (data?.layout) {
                onApplyLayout?.(data);
                setAppliedLayout('ai-suggested');
            }
        },
    });

    const applyQuickLayoutMutation = useMutation({
        mutationFn: async (layoutType: string) => {
            const response = await fetch('/api/ai/apply-layout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    slideId,
                    layoutType,
                    blocks: blocks?.map(b => ({
                        type: b.type,
                        content: b.content,
                    })),
                }),
            });
            return response.json();
        },
        onSuccess: (data, layoutType) => {
            if (data?.layout) {
                onApplyLayout?.(data);
                setAppliedLayout(layoutType);
            }
        },
    });

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-medium flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/30">
                    <Wand2 className="h-4 w-4" />
                    <span>Magic Layout</span>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="center" side="top">
                <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                        Magic Layout
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                        AI will auto-arrange your slide content
                    </p>
                </div>

                {/* AI Suggested */}
                <div className="p-2">
                    <button
                        onClick={() => magicLayoutMutation.mutate()}
                        disabled={magicLayoutMutation.isPending}
                        className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                            "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
                            "hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-950/50 dark:hover:to-indigo-950/50",
                            "border border-blue-200 dark:border-blue-800"
                        )}
                    >
                        {magicLayoutMutation.isPending ? (
                            <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                        ) : (
                            <Wand2 className="h-5 w-5 text-blue-600" />
                        )}
                        <div className="text-left flex-1">
                            <div className="text-sm font-medium text-blue-700 dark:text-blue-400">
                                Auto Layout with AI
                            </div>
                            <div className="text-xs text-blue-500 dark:text-blue-500">
                                Let AI pick the best layout
                            </div>
                        </div>
                        {appliedLayout === 'ai-suggested' && (
                            <Check className="h-4 w-4 text-green-500" />
                        )}
                    </button>
                </div>

                {/* Divider */}
                <div className="px-3">
                    <div className="border-t border-slate-200 dark:border-slate-700" />
                    <p className="text-xs text-slate-400 mt-2 mb-1 px-1">Quick Layouts</p>
                </div>

                {/* Quick layout options */}
                <div className="p-2 grid grid-cols-1 gap-1 max-h-60 overflow-y-auto">
                    {QUICK_LAYOUTS.map((layout) => {
                        const Icon = layout.icon;
                        const isApplied = appliedLayout === layout.id;
                        const isApplying = applyQuickLayoutMutation.isPending && applyQuickLayoutMutation.variables === layout.id;

                        return (
                            <button
                                key={layout.id}
                                onClick={() => applyQuickLayoutMutation.mutate(layout.id)}
                                disabled={isApplying}
                                className={cn(
                                    "w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left",
                                    isApplied
                                        ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
                                        : "hover:bg-slate-50 dark:hover:bg-slate-800"
                                )}
                            >
                                <div className={cn(
                                    "p-1.5 rounded-md",
                                    isApplied ? "bg-green-100 text-green-600" : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                                )}>
                                    {isApplying ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Icon className="h-4 w-4" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-900 dark:text-white">{layout.name}</div>
                                    <div className="text-xs text-slate-500 truncate">{layout.description}</div>
                                </div>
                                {isApplied && <Check className="h-4 w-4 text-green-500" />}
                            </button>
                        );
                    })}
                </div>

                {/* AI Suggested Layouts from response */}
                {suggestedLayouts.length > 0 && (
                    <>
                        <div className="px-3">
                            <div className="border-t border-slate-200 dark:border-slate-700" />
                            <p className="text-xs text-slate-400 mt-2 mb-1 px-1">AI Recommendations</p>
                        </div>
                        <div className="p-2 space-y-1">
                            {suggestedLayouts.map((layout, index) => (
                                <button
                                    key={layout.name || `ai-layout-${index}`}
                                    onClick={() => {
                                        onApplyLayout?.(layout);
                                        setAppliedLayout(`ai-${index}`);
                                        setIsOpen(false);
                                    }}
                                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                                >
                                    <Sparkles className="h-4 w-4 text-amber-500" />
                                    <div className="flex-1">
                                        <div className="text-sm font-medium">{layout.name}</div>
                                        <div className="text-xs text-slate-500">{layout.description}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </PopoverContent>
        </Popover>
    );
}
