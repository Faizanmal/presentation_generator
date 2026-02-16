'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
    Loader2,
    Check,
    RefreshCw,
    Send,
    ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Block } from '@/types';

interface AISuggestion {
    id: string;
    icon: string;
    iconColor: string;
    label: string;
    description?: string;
    action: string;
    category: 'content' | 'visual' | 'layout' | 'style';
}

interface AISuggestionsPanelProps {
    projectId: string;
    slideId?: string;
    blocks?: Block[];
    slideTitle?: string;
    onApplySuggestion?: (action: string, data?: Record<string, unknown>) => void;
    onOpenChat?: () => void;
}

const DEFAULT_SUGGESTIONS: AISuggestion[] = [
    {
        id: 'simplify',
        icon: 'short_text',
        iconColor: 'text-blue-500',
        label: 'Simplify text for readability',
        description: 'Make content more concise and clear',
        action: 'simplify_text',
        category: 'content',
    },
    {
        id: 'icons',
        icon: 'palette',
        iconColor: 'text-purple-500',
        label: 'Generate matching icon set',
        description: 'Auto-select icons that match your content',
        action: 'generate_icons',
        category: 'visual',
    },
    {
        id: 'process-layout',
        icon: 'view_quilt',
        iconColor: 'text-green-500',
        label: 'Try "Process" layout',
        description: 'Arrange content in a step-by-step flow',
        action: 'process_layout',
        category: 'layout',
    },
    {
        id: 'add-chart',
        icon: 'bar_chart',
        iconColor: 'text-amber-500',
        label: 'Add data visualization',
        description: 'Convert data to charts or graphs',
        action: 'add_chart',
        category: 'visual',
    },
    {
        id: 'enhance-visuals',
        icon: 'auto_fix_high',
        iconColor: 'text-pink-500',
        label: 'Enhance visual hierarchy',
        description: 'Improve text sizing and spacing',
        action: 'enhance_hierarchy',
        category: 'style',
    },
    {
        id: 'add-image',
        icon: 'image',
        iconColor: 'text-indigo-500',
        label: 'Generate relevant image',
        description: 'AI-generated image for this slide',
        action: 'generate_image',
        category: 'visual',
    },
];

export function AISuggestionsPanel({
    projectId,
    slideId,
    blocks,
    slideTitle,
    onApplySuggestion,
    onOpenChat,
}: AISuggestionsPanelProps) {
    const [aiPrompt, setAiPrompt] = useState('');
    const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
    const [isApplying, setIsApplying] = useState<string | null>(null);
    const [contextualSuggestions, setContextualSuggestions] = useState<AISuggestion[]>(DEFAULT_SUGGESTIONS);

    // Generate contextual suggestions based on slide content
    const generateSuggestionsMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch('/api/ai/suggestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    slideId,
                    blocks: blocks?.map(b => ({ type: b.type, content: b.content })),
                    heading: slideTitle,
                }),
            });
            if (!response.ok) { return DEFAULT_SUGGESTIONS; }
            return response.json();
        },
        onSuccess: (data: AISuggestion[]) => {
            if (Array.isArray(data) && data.length > 0) {
                setContextualSuggestions(data);
            }
        },
    });

    // Apply AI prompt mutation
    const applyPromptMutation = useMutation({
        mutationFn: async (prompt: string) => {
            const response = await fetch('/api/ai/refine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    slideId,
                    prompt,
                    blocks: blocks?.map(b => ({ type: b.type, content: b.content })),
                }),
            });
            return response.json();
        },
        onSuccess: () => {
            setAiPrompt('');
        },
    });

    // Load contextual suggestions when slide changes
    useEffect(() => {
        if (slideId && blocks && blocks.length > 0) {
            // Only fetch if we have real content
            const hasContent = blocks.some(b => b.content?.text && b.content.text.length > 10);
            if (hasContent) {
                generateSuggestionsMutation.mutate();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slideId]);

    const handleApplySuggestion = useCallback(async (suggestion: AISuggestion) => {
        setIsApplying(suggestion.id);
        try {
            onApplySuggestion?.(suggestion.action, {
                slideId,
                blocks: blocks?.map(b => ({ type: b.type, content: b.content })),
            });
            setAppliedSuggestions((prev: Set<string>) => new Set([...prev, suggestion.id]));
        } finally {
            setTimeout(() => setIsApplying(null), 500);
        }
    }, [onApplySuggestion, slideId, blocks]);

    const handleSendPrompt = () => {
        if (!aiPrompt.trim()) { return; }
        applyPromptMutation.mutate(aiPrompt);
    };

    const displaySuggestions = contextualSuggestions.slice(0, 6);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-600 font-semibold">
                    <span className="material-symbols-outlined">colors_spark</span>
                    <h3>AI Assistant</h3>
                </div>
                {onOpenChat && (
                    <Button variant="ghost" size="sm" onClick={onOpenChat}>
                        Open Chat
                    </Button>
                )}
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 rounded-xl p-4 border border-blue-100 dark:border-slate-700">
                {/* AI Avatar + intro message */}
                <div className="flex gap-3 mb-3">
                    <div className="size-8 rounded-full bg-white dark:bg-slate-950 flex items-center justify-center shadow-sm text-blue-600 shrink-0">
                        <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                    </div>
                    <div className="bg-white dark:bg-slate-950 p-3 rounded-r-xl rounded-bl-xl shadow-sm text-sm text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-slate-800">
                        I can help improve this slide. Here are some suggestions:
                    </div>
                </div>

                {/* AI Suggestion Buttons */}
                <div className="space-y-2 pl-11">
                    {displaySuggestions.map((suggestion) => {
                        const isApplied = appliedSuggestions.has(suggestion.id);
                        const isCurrentlyApplying = isApplying === suggestion.id;

                        return (
                            <button
                                key={suggestion.id}
                                onClick={() => handleApplySuggestion(suggestion)}
                                disabled={isCurrentlyApplying}
                                className={cn(
                                    "w-full text-left p-2 bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10",
                                    "border border-transparent hover:border-blue-200 dark:hover:border-slate-600",
                                    "rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300",
                                    "transition-all flex items-center gap-2 group",
                                    isApplied && "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                                )}
                            >
                                {isCurrentlyApplying ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                ) : isApplied ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                    <span className={cn("material-symbols-outlined text-[16px] group-hover:scale-110 transition-transform", suggestion.iconColor)}>
                                        {suggestion.icon}
                                    </span>
                                )}
                                <span className="flex-1">{suggestion.label}</span>
                                {!isApplied && !isCurrentlyApplying && (
                                    <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Refresh suggestions */}
                <div className="mt-3 pl-11">
                    <button
                        onClick={() => generateSuggestionsMutation.mutate()}
                        disabled={generateSuggestionsMutation.isPending}
                        className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1 font-medium"
                    >
                        {generateSuggestionsMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <RefreshCw className="h-3 w-3" />
                        )}
                        Refresh suggestions
                    </button>
                </div>

                {/* AI Text Prompt */}
                <div className="mt-4 relative">
                    <Input
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt()}
                        placeholder="Ask AI to change something..."
                        className="pr-10 bg-white dark:bg-slate-950 border-gray-200 dark:border-slate-600"
                    />
                    <button
                        onClick={handleSendPrompt}
                        disabled={!aiPrompt.trim() || applyPromptMutation.isPending}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-700 p-1 disabled:opacity-40"
                    >
                        {applyPromptMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
