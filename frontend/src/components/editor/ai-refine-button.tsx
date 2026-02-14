'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
    Sparkles,
    Loader2,
    Check,
    RefreshCw,
    Wand2,
    Type,
    Layout,
    Palette,
    ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Block } from '@/types';

interface AIRefineButtonProps {
    projectId: string;
    slideId?: string;
    blocks?: Block[];
    slideTitle?: string;
    onRefineComplete?: (result: unknown) => void;
}

const REFINE_OPTIONS = [
    {
        id: 'improve_clarity',
        icon: 'auto_fix_high',
        label: 'Improve Clarity',
        description: 'Make text clearer and more concise',
    },
    {
        id: 'enhance_design',
        icon: 'palette',
        label: 'Enhance Design',
        description: 'Improve visual hierarchy and styling',
    },
    {
        id: 'fix_grammar',
        icon: 'spellcheck',
        label: 'Fix Grammar & Spelling',
        description: 'Correct any language errors',
    },
    {
        id: 'professional_tone',
        icon: 'business_center',
        label: 'Professional Tone',
        description: 'Adjust to formal business language',
    },
    {
        id: 'casual_tone',
        icon: 'emoji_emotions',
        label: 'Casual Tone',
        description: 'Make it more conversational',
    },
    {
        id: 'add_statistics',
        icon: 'trending_up',
        label: 'Add Statistics',
        description: 'Suggest relevant data points',
    },
];

export function AIRefineButton({
    projectId,
    slideId,
    blocks,
    slideTitle,
    onRefineComplete,
}: AIRefineButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [refiningOption, setRefiningOption] = useState<string | null>(null);

    const refineMutation = useMutation({
        mutationFn: async (option: string) => {
            setRefiningOption(option);
            const response = await fetch('/api/ai/refine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    slideId,
                    action: option,
                    blocks: blocks?.map(b => ({
                        id: b.id,
                        type: b.type,
                        content: b.content,
                    })),
                    heading: slideTitle,
                }),
            });
            return response.json();
        },
        onSuccess: (data, option) => {
            onRefineComplete?.(data);
            const optionLabel = REFINE_OPTIONS.find(o => o.id === option)?.label || option;
            toast.success(`Applied: ${optionLabel}`);
            setRefiningOption(null);
            setIsOpen(false);
        },
        onError: () => {
            toast.error('Failed to refine slide');
            setRefiningOption(null);
        },
    });

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold bg-blue-600/10 text-blue-600 hover:bg-blue-600/20 transition-colors border border-blue-600/20">
                    <span className="material-symbols-outlined text-[18px]">temp_preferences_custom</span>
                    <span>AI Refine</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
                <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
                    <h4 className="font-semibold text-sm flex items-center gap-2 text-blue-700 dark:text-blue-400">
                        <Sparkles className="h-4 w-4" />
                        AI Refine
                    </h4>
                    <p className="text-xs text-blue-500 dark:text-blue-500 mt-0.5">
                        Instantly improve your current slide
                    </p>
                </div>

                <div className="p-1.5 max-h-80 overflow-y-auto">
                    {REFINE_OPTIONS.map((option) => {
                        const isRefining = refiningOption === option.id;

                        return (
                            <button
                                key={option.id}
                                onClick={() => refineMutation.mutate(option.id)}
                                disabled={refineMutation.isPending}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                                    "hover:bg-slate-50 dark:hover:bg-slate-800",
                                    isRefining && "bg-blue-50 dark:bg-blue-950/30"
                                )}
                            >
                                <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700">
                                    {isRefining ? (
                                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                                    ) : (
                                        <span className="material-symbols-outlined text-[16px] text-slate-500">
                                            {option.icon}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-900 dark:text-white">{option.label}</div>
                                    <div className="text-xs text-slate-500 truncate">{option.description}</div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-xs text-slate-400 text-center">
                        Changes will be applied to the current slide
                    </p>
                </div>
            </PopoverContent>
        </Popover>
    );
}
