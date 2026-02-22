'use client';

import { useState } from 'react';
import {
    Wand2,
    Layout,
    LayoutGrid,
    AlignCenter,
    Columns2,
    Image as ImageIcon,
    Loader2,
    Check,
    Sparkles,
} from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

import type { LucideIcon } from 'lucide-react';
import type { BlockContent } from '@/types';

interface AutoLayoutEngineProps {
    blocks: { id: string; type: string; content: BlockContent }[];
    heading?: string;
    onApplyLayout?: (layout: LayoutSuggestion) => void;
}

export interface LayoutSuggestion {
    name: string;
    description: string;
    score: number;
    layout: {
        type: string;
        alignment: string;
        spacing: string;
        blocks: unknown[];
    };
}

const LAYOUT_ICONS: Record<string, LucideIcon> = {
    'single-column': Layout,
    'two-column': Columns2,
    'grid': LayoutGrid,
    'hero': ImageIcon,
    'split': Columns2,
    'centered': AlignCenter,
};

export function AutoLayoutEngine({
    blocks,
    heading,
    onApplyLayout,
}: AutoLayoutEngineProps) {
    const [selectedLayout, setSelectedLayout] = useState<LayoutSuggestion | null>(
        null,
    );

    // Get layout suggestions
    const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
        queryKey: ['layout-suggestions', blocks.map((b) => b.type).join('-')],
        queryFn: async () => {
            if (blocks.length === 0) { return []; }
            const response = await api.post('/ai/layout-suggestions', {
                blocks,
                heading,
            });
            return (response.data as { suggestions: LayoutSuggestion[] }).suggestions;
        },
        enabled: blocks.length > 0,
    });

    // Auto-layout with AI
    const autoLayoutMutation = useMutation({
        mutationFn: async () => {
            const response = await api.post('/ai/auto-layout', {
                blocks,
                heading,
            });
            return (response.data as { layout: LayoutSuggestion['layout'] }).layout;
        },
        onSuccess: (layout) => {
            if (onApplyLayout) {
                onApplyLayout({
                    name: 'AI Optimized',
                    description: 'AI-selected optimal layout',
                    score: 100,
                    layout,
                });
            }
        },
    });

    // Get recommendations
    const { data: recommendations } = useQuery({
        queryKey: ['layout-recommendations', blocks.map((b) => b.type).join('-')],
        queryFn: async () => {
            if (blocks.length === 0) { return []; }
            const response = await api.post('/ai/layout-recommendations', {
                blockTypes: blocks.map((b) => b.type),
            });
            return (response.data as { recommendations: { layout: string; reason: string }[] }).recommendations;
        },
        enabled: blocks.length > 0,
    });

    const handleApplyLayout = (suggestion: LayoutSuggestion) => {
        setSelectedLayout(suggestion);
        if (onApplyLayout) {
            onApplyLayout(suggestion);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 bg-linear-to-br from-blue-500 to-cyan-500 rounded-lg">
                    <Wand2 className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-900">Auto Layout Engine</h3>
                    <p className="text-sm text-slate-600">
                        AI-powered slide layouts
                    </p>
                </div>
            </div>

            {/* Magic Button */}
            <button
                onClick={() => autoLayoutMutation.mutate()}
                disabled={blocks.length === 0 || autoLayoutMutation.isPending}
                className="w-full bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-400 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
            >
                {autoLayoutMutation.isPending ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Optimizing Layout...
                    </>
                ) : (
                    <>
                        <Sparkles className="w-5 h-5" />
                        ✨ Magic Auto-Layout
                    </>
                )}
            </button>

            {/* Content Analysis */}
            <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-sm font-medium text-slate-700 mb-2">
                    Current Content
                </div>
                <div className="flex flex-wrap gap-1">
                    {blocks.map((block) => (
                        <span
                            key={block.id}
                            className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600"
                        >
                            {block.type}
                        </span>
                    ))}
                    {blocks.length === 0 && (
                        <span className="text-xs text-slate-400">No blocks yet</span>
                    )}
                </div>
            </div>

            {/* Recommendations */}
            {recommendations && recommendations.length > 0 && (
                <div className="space-y-2">
                    <div className="text-sm font-medium text-slate-700">
                        💡 Recommendations
                    </div>
                    {recommendations.map((rec) => (
                        <div
                            key={`${rec.layout}-${rec.reason.substring(0, 30)}`}
                            className="p-2 bg-blue-50 border border-blue-100 rounded-lg text-sm"
                        >
                            <span className="font-medium text-blue-700">{rec.layout}:</span>{' '}
                            <span className="text-blue-600">{rec.reason}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Layout Suggestions */}
            {suggestionsLoading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
            ) : suggestions && suggestions.length > 0 ? (
                <div className="space-y-2">
                    <div className="text-sm font-medium text-slate-700">
                        Layout Options
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {suggestions.map((suggestion) => {
                            const IconComponent =
                                LAYOUT_ICONS[suggestion.layout.type] || Layout;
                            const isSelected = selectedLayout?.name === suggestion.name;

                            return (
                                <button
                                    key={suggestion.name}
                                    onClick={() => handleApplyLayout(suggestion)}
                                    className={`p-3 border-2 rounded-lg text-left transition-all ${isSelected
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <IconComponent
                                            className={`w-5 h-5 ${isSelected ? 'text-blue-600' : 'text-slate-500'
                                                }`}
                                        />
                                        <span
                                            className={`font-medium text-sm ${isSelected ? 'text-blue-700' : 'text-slate-700'
                                                }`}
                                        >
                                            {suggestion.name}
                                        </span>
                                        {isSelected && (
                                            <Check className="w-4 h-4 text-blue-600 ml-auto" />
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mb-2">
                                        {suggestion.description}
                                    </p>
                                    <div className="flex items-center gap-1">
                                        <div
                                            className="h-1.5 bg-green-500 rounded-full"
                                            style={{ width: `${suggestion.score}%` }}
                                        />
                                        <span className="text-xs text-slate-400">
                                            {suggestion.score}%
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="text-center py-6 text-slate-500">
                    <Layout className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Add content to get layout suggestions</p>
                </div>
            )}

            {/* Layout Preview */}
            {selectedLayout && (
                <div className="p-4 border border-slate-200 rounded-lg">
                    <div className="text-sm font-medium text-slate-700 mb-3">
                        Layout Preview
                    </div>
                    <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                            {(() => {
                                const IconComponent =
                                    LAYOUT_ICONS[selectedLayout.layout.type] || Layout;
                                return (
                                    <IconComponent className="w-12 h-12 mx-auto text-slate-400 mb-2" />
                                );
                            })()}
                            <div className="text-sm font-medium text-slate-600">
                                {selectedLayout.name}
                            </div>
                            <div className="text-xs text-slate-400">
                                {selectedLayout.layout.alignment} •{' '}
                                {selectedLayout.layout.spacing}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tips */}
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-700">
                    <strong>💡 Tip:</strong> The AI analyzes your content type
                    (text, images, charts) to suggest the most effective layout.
                </p>
            </div>
        </div>
    );
}
