'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
    RefreshCw,
    Wand2,
    Trash2,
    Loader2,
    Sparkles,
    Download,
    Image as ImageIcon,
} from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { BrandedMediaPlaceholder } from './BrandedMediaPlaceholder';

interface ImageAIControlsProps {
    imageUrl?: string;
    imageAlt?: string;
    blockId: string;
    slideId: string;
    projectId: string;
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
    fillContainer = false,
    primaryColor = '#0F172A',
    secondaryColor = '#334155',
    onImageUpdate,
    onDelete,
}: ImageAIControlsProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [isImageLoading, setIsImageLoading] = useState(false);

    useEffect(() => {
        setLoadFailed(false);
        setIsImageLoading(Boolean(imageUrl));
    }, [imageUrl]);

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
                    prompt: imageAlt || 'Generate a relevant presentation image',
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
                        'relative w-full overflow-hidden bg-slate-100 dark:bg-slate-800',
                        fillContainer
                            ? 'h-full min-h-0 rounded-none'
                            : 'aspect-video rounded-xl',
                    )}
                >
                    <Image
                        src={imageUrl || ''}
                        alt={imageAlt || 'Image'}
                        fill
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        priority
                        unoptimized
                        className="object-cover"
                        onError={(err) => {
                            console.error('[ImageAIControls] Image failed to render, falling back to styled panel:', imageUrl, err);
                            setIsImageLoading(false);
                            setLoadFailed(true);
                        }}
                        onLoad={() => {
                            setIsImageLoading(false);
                            setLoadFailed(false);
                        }}
                        onLoadingComplete={() => {
                            setIsImageLoading(false);
                            setLoadFailed(false);
                        }}
                    />

                    {isImageLoading && (
                        <div
                            className="absolute inset-0 flex items-center justify-center animate-pulse pointer-events-none z-0"
                            style={{
                                background: `linear-gradient(145deg, ${primaryColor}15, ${secondaryColor}25)`,
                            }}
                        >
                            <ImageIcon className="h-8 w-8 text-slate-400/50 animate-pulse" />
                        </div>
                    )}

                    <div className="absolute inset-0 bg-linear-to-t from-slate-900/40 to-transparent opacity-0 group-hover/image:opacity-100 transition-opacity pointer-events-none" />

                    {imageUrl && !/picsum\.photos/i.test(imageUrl) && (
                        <div className="absolute bottom-4 left-4 text-white font-medium text-xs bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-sm pointer-events-none">
                            <Sparkles className="inline h-3 w-3 mr-1" />
                            Visual Asset
                        </div>
                    )}

                    <div
                        className={cn(
                            'absolute top-4 right-4 flex gap-2 transition-all duration-200 z-10',
                            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
                        )}
                    >
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        onClick={handleRegenerate}
                                        disabled={regenerateImageMutation.isPending}
                                        aria-label="Regenerate this image with AI"
                                        className="bg-white/90 backdrop-blur text-slate-700 hover:text-blue-600 px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm flex items-center gap-1 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
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
                /* Styled fallback — never an empty or pale unstyled pane */
                <div
                    className={cn(
                        'relative flex flex-col items-center justify-center p-6 text-center overflow-hidden transition-all',
                        fillContainer ? 'h-full min-h-0 rounded-none' : 'w-full aspect-video rounded-xl',
                    )}
                    style={{
                        background: `linear-gradient(135deg, ${primaryColor}22 0%, ${secondaryColor}33 50%, #0b1220 100%)`,
                        border: '1px solid rgba(255, 255, 255, 0.1)',
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
                            ? 'Image source was unreachable. Click regenerate to reload.'
                            : 'Topic-matched presentation visual.'}
                    </p>
                    <div className="flex items-center gap-2 z-10">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleRegenerate}
                            disabled={regenerateImageMutation.isPending}
                            className="bg-white/90 text-slate-800 hover:bg-white text-xs font-semibold shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            {regenerateImageMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Regenerate Image
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
