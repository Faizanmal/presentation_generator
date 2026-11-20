'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
    RefreshCw,
    Wand2,
    Trash2,
    Loader2,
    Sparkles,
    Image as ImageIcon,
    Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getTopicImageSuggestions } from '@/lib/slide-media';

interface ImageAIControlsProps {
    imageUrl?: string;
    imageAlt?: string;
    blockId: string;
    slideId: string;
    projectId: string;
    topicContext?: string;
    /** Fill the parent (bleed media panels) instead of a 16:9 strip */
    fillContainer?: boolean;
    primaryColor?: string;
    secondaryColor?: string;
    onImageUpdate?: (newUrl: string, newAlt?: string) => void;
    onDelete?: () => void;
}

export function ImageAIControls({
    imageUrl,
    imageAlt,
    blockId,
    slideId,
    projectId,
    topicContext,
    fillContainer = false,
    primaryColor = '#0F172A',
    secondaryColor = '#334155',
    onImageUpdate,
    onDelete,
}: ImageAIControlsProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [isImageLoading, setIsImageLoading] = useState(false);
    const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
    const [customUrlInput, setCustomUrlInput] = useState('');

    useEffect(() => {
        setLoadFailed(false);
        setIsImageLoading(Boolean(imageUrl));
    }, [imageUrl]);

    const contextForSuggestions = [topicContext, imageAlt, 'presentation visual']
        .filter(Boolean)
        .join(' ');
    const topicSuggestions = getTopicImageSuggestions(contextForSuggestions, 4);

    const regenerateImageMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch('/api/ai/regenerate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    slideId,
                    blockId,
                    currentImage: imageUrl,
                    prompt: contextForSuggestions,
                }),
            });
            return response.json();
        },
        onSuccess: (data: { imageUrl?: string; alt?: string }) => {
            if (data?.imageUrl) {
                setLoadFailed(false);
                onImageUpdate?.(data.imageUrl, data.alt);
            }
        },
    });

    const enhanceImageMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch('/api/ai/enhance-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    imageUrl,
                }),
            });
            return response.json();
        },
        onSuccess: (data: { imageUrl?: string }) => {
            if (data?.imageUrl) {
                setLoadFailed(false);
                onImageUpdate?.(data.imageUrl);
            }
        },
    });

    const handleRegenerate = () => {
        regenerateImageMutation.mutate();
    };

    const handleSelectSuggestion = (url: string, title?: string) => {
        setLoadFailed(false);
        onImageUpdate?.(url, title || imageAlt);
        setIsReplaceModalOpen(false);
    };

    const handleApplyCustomUrl = () => {
        if (!customUrlInput.trim()) return;
        setLoadFailed(false);
        onImageUpdate?.(customUrlInput.trim(), imageAlt);
        setCustomUrlInput('');
        setIsReplaceModalOpen(false);
    };

    const showImage = Boolean(imageUrl) && !loadFailed;

    return (
        <div
            className={cn(
                'relative group/image w-full',
                fillContainer ? 'h-full min-h-0' : 'h-full',
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {showImage ? (
                <div
                    className={cn(
                        'relative w-full overflow-hidden bg-slate-900',
                        fillContainer
                            ? 'h-full min-h-0 rounded-none'
                            : 'aspect-video rounded-xl',
                    )}
                >
                    {/* Direct img tag guarantees instant load, no proxy failures, and matches thumbnail */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={imageUrl || ''}
                        alt={imageAlt || 'Slide Visual'}
                        loading="eager"
                        decoding="async"
                        className="w-full h-full object-cover absolute inset-0 z-0"
                        onError={(err) => {
                            console.error('[ImageAIControls] Image failed to render, falling back to styled panel:', imageUrl, err);
                            setIsImageLoading(false);
                            setLoadFailed(true);
                        }}
                        onLoad={() => {
                            setIsImageLoading(false);
                            setLoadFailed(false);
                        }}
                    />

                    {isImageLoading && (
                        <div
                            className="absolute inset-0 flex items-center justify-center animate-pulse pointer-events-none z-1"
                            style={{
                                background: `linear-gradient(145deg, ${primaryColor}25, ${secondaryColor}35)`,
                            }}
                        >
                            <ImageIcon className="h-8 w-8 text-white/50 animate-pulse" />
                        </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-0 group-hover/image:opacity-100 transition-opacity pointer-events-none z-1" />

                    {imageUrl && !/picsum\.photos/i.test(imageUrl) && (
                        <div className="absolute bottom-4 left-4 text-white font-medium text-xs bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-sm pointer-events-none z-2">
                            <Sparkles className="inline h-3 w-3 mr-1" />
                            Visual Asset
                        </div>
                    )}

                    {/* Hover controls */}
                    <div
                        className={cn(
                            'absolute top-4 right-4 flex gap-1.5 transition-all duration-200 z-10',
                            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
                        )}
                    >
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        onClick={() => setIsReplaceModalOpen(true)}
                                        aria-label="Replace image"
                                        className="bg-white/90 backdrop-blur text-slate-700 hover:text-blue-600 px-2.5 py-1.5 rounded-md text-xs font-semibold shadow-sm flex items-center gap-1 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
                                    >
                                        <ImageIcon className="h-3.5 w-3.5" />
                                        Replace
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>Replace with topic suggestions or custom URL</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        onClick={handleRegenerate}
                                        disabled={regenerateImageMutation.isPending}
                                        aria-label="Regenerate this image with AI"
                                        className="bg-white/90 backdrop-blur text-slate-700 hover:text-blue-600 px-2.5 py-1.5 rounded-md text-xs font-semibold shadow-sm flex items-center gap-1 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
                                    >
                                        {regenerateImageMutation.isPending ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <RefreshCw className="h-3.5 w-3.5" />
                                        )}
                                        Regenerate
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>Generate a new AI image</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        onClick={() => enhanceImageMutation.mutate()}
                                        disabled={enhanceImageMutation.isPending}
                                        aria-label="Enhance image quality"
                                        className="bg-white/90 backdrop-blur text-slate-700 hover:text-purple-600 p-1.5 rounded-md shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
                                    >
                                        {enhanceImageMutation.isPending ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Wand2 className="h-3.5 w-3.5" />
                                        )}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>Enhance image quality</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        onClick={onDelete}
                                        aria-label="Remove image"
                                        className="bg-white/90 backdrop-blur text-slate-700 hover:text-red-600 p-1.5 rounded-md shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-red-500"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>Remove image</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
            ) : (
                /* Styled fallback — rich gradient with icon and Replace button, never a pale/empty box */
                <div
                    className={cn(
                        'relative flex flex-col items-center justify-center p-6 text-center overflow-hidden transition-all',
                        fillContainer ? 'h-full min-h-0 rounded-none' : 'w-full aspect-video rounded-xl',
                    )}
                    style={{
                        background: `linear-gradient(135deg, ${primaryColor}33 0%, ${secondaryColor}44 50%, #0b1220 100%)`,
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                    }}
                >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md shadow-md text-white mb-3">
                        <ImageIcon className="h-7 w-7 text-white/90" />
                    </div>
                    <p className="text-sm font-semibold text-white/95 max-w-xs truncate mb-1">
                        {imageAlt || 'Slide Visual Asset'}
                    </p>
                    <p className="text-xs text-white/70 max-w-xs mb-4">
                        {loadFailed
                            ? 'Image was unreachable. Choose a topic replacement or reload.'
                            : 'Topic-matched presentation visual.'}
                    </p>
                    <div className="flex items-center gap-2 z-10">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setIsReplaceModalOpen(true)}
                            className="bg-white/95 text-slate-800 hover:bg-white text-xs font-semibold shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
                            Replace Image
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRegenerate}
                            disabled={regenerateImageMutation.isPending}
                            className="border-white/30 text-white hover:bg-white/10 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            {regenerateImageMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Regenerate
                        </Button>
                    </div>
                </div>
            )}

            {/* Replace Image Dialog */}
            <Dialog open={isReplaceModalOpen} onOpenChange={setIsReplaceModalOpen}>
                <DialogContent className="sm:max-w-xl bg-white dark:bg-slate-900">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                            Replace Slide Image
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Pick a topic-matched visual or provide an image URL.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Topic suggestions */}
                        <div>
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                                Recommended for this topic
                            </label>
                            <div className="grid grid-cols-2 gap-2.5">
                                {topicSuggestions.map((url, i) => (
                                    <button
                                        key={url || i}
                                        type="button"
                                        onClick={() => handleSelectSuggestion(url, `${imageAlt || 'Slide visual'} #${i + 1}`)}
                                        className="group/item relative flex flex-col rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:ring-2 hover:ring-blue-500 text-left transition-all"
                                    >
                                        <div className="aspect-video w-full bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={url}
                                                alt={`Suggestion ${i + 1}`}
                                                className="w-full h-full object-cover group-hover/item:scale-105 transition-transform duration-300"
                                            />
                                            {imageUrl === url && (
                                                <div className="absolute top-1.5 right-1.5 bg-blue-600 text-white rounded-full p-0.5">
                                                    <Check className="h-3 w-3" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-2 bg-slate-50 dark:bg-slate-950">
                                            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                                                {imageAlt ? `${imageAlt} #${i + 1}` : `Visual Suggestion ${i + 1}`}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom URL */}
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                                Custom image URL
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="https://images.unsplash.com/photo-..."
                                    value={customUrlInput}
                                    onChange={(e) => setCustomUrlInput(e.target.value)}
                                    className="text-xs"
                                    onKeyDown={(e) => e.key === 'Enter' && handleApplyCustomUrl()}
                                />
                                <Button
                                    size="sm"
                                    onClick={handleApplyCustomUrl}
                                    disabled={!customUrlInput.trim()}
                                    className="shrink-0 text-xs"
                                >
                                    Apply
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
