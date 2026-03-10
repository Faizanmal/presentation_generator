'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Globe,
    ExternalLink,
    Loader2,
    AlertCircle,
    Youtube,
    Figma,
    Twitter,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// =========================================================================
// OEmbed URL resolver — resolves embed URLs via noembed.com for safe iframes
// =========================================================================

interface OEmbedData {
    title?: string;
    html?: string;
    thumbnail_url?: string;
    provider_name?: string;
    type?: string;
    width?: number;
    height?: number;
}

type EmbedServiceType =
    | 'youtube'
    | 'vimeo'
    | 'figma'
    | 'miro'
    | 'twitter'
    | 'codepen'
    | 'loom'
    | 'generic';

/** Detect service from URL */
function detectService(url: string): EmbedServiceType {
    const u = url.toLowerCase();
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
    if (u.includes('vimeo.com')) return 'vimeo';
    if (u.includes('figma.com')) return 'figma';
    if (u.includes('miro.com')) return 'miro';
    if (u.includes('twitter.com') || u.includes('x.com')) return 'twitter';
    if (u.includes('codepen.io')) return 'codepen';
    if (u.includes('loom.com')) return 'loom';
    return 'generic';
}

/** Generate stable iframe HTML for known services */
function generateEmbedHtml(url: string, service: EmbedServiceType): string | null {
    switch (service) {
        case 'youtube': {
            const match = url.match(
                /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/,
            );
            if (match)
                return `<iframe src="https://www.youtube.com/embed/${match[1]}?rel=0" frameborder="0" allowfullscreen style="width:100%;height:100%;aspect-ratio:16/9" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`;
            break;
        }
        case 'vimeo': {
            const match = url.match(/vimeo\.com\/(\d+)/);
            if (match)
                return `<iframe src="https://player.vimeo.com/video/${match[1]}" frameborder="0" allowfullscreen style="width:100%;height:100%;aspect-ratio:16/9"></iframe>`;
            break;
        }
        case 'figma': {
            const encoded = encodeURIComponent(url);
            return `<iframe src="https://www.figma.com/embed?embed_host=presentation_designer&url=${encoded}" frameborder="0" allowfullscreen style="width:100%;height:100%;aspect-ratio:16/10"></iframe>`;
        }
        case 'miro': {
            // Miro share link → embed
            const embedUrl = url.replace('/board/', '/live-embed/');
            return `<iframe src="${embedUrl}" frameborder="0" scrolling="no" allowfullscreen style="width:100%;height:100%;aspect-ratio:16/10"></iframe>`;
        }
        case 'codepen': {
            const match = url.match(/codepen\.io\/([\w-]+)\/pen\/([\w-]+)/);
            if (match)
                return `<iframe src="https://codepen.io/${match[1]}/embed/${match[2]}?default-tab=result" frameborder="0" style="width:100%;height:100%;aspect-ratio:16/10" allowfullscreen></iframe>`;
            break;
        }
        case 'loom': {
            const match = url.match(/loom\.com\/(share|embed)\/([\w-]+)/);
            if (match)
                return `<iframe src="https://www.loom.com/embed/${match[2]}" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="width:100%;height:100%;aspect-ratio:16/9"></iframe>`;
            break;
        }
        default:
            break;
    }
    return null;
}

/** Try noembed.com API for services we don't have built-in support for */
async function resolveOembed(url: string): Promise<OEmbedData | null> {
    try {
        const res = await fetch(
            `https://noembed.com/embed?url=${encodeURIComponent(url)}&maxwidth=640`,
        );
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

function getServiceIcon(service: EmbedServiceType) {
    switch (service) {
        case 'youtube':
        case 'vimeo':
        case 'loom':
            return <Youtube className="h-4 w-4" />;
        case 'figma':
            return <Figma className="h-4 w-4" />;
        case 'twitter':
            return <Twitter className="h-4 w-4" />;
        default:
            return <Globe className="h-4 w-4" />;
    }
}

// =========================================================================
// OEmbedBlock component — renders inside the slide canvas
// =========================================================================

interface OEmbedBlockProps {
    embedUrl?: string;
    embedHtml?: string;
    embedType?: EmbedServiceType;
    embedAspectRatio?: string;
    isEditing?: boolean;
    onUpdate?: (data: {
        embedUrl: string;
        embedHtml: string;
        embedType: EmbedServiceType;
        embedAspectRatio: string;
    }) => void;
}

export function OEmbedBlock({
    embedUrl,
    embedHtml,
    embedType,
    embedAspectRatio,
    isEditing = false,
    onUpdate,
}: OEmbedBlockProps) {
    const [url, setUrl] = useState(embedUrl || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resolvedHtml, setResolvedHtml] = useState(embedHtml || '');
    const [service, setService] = useState<EmbedServiceType>(embedType || 'generic');

    useEffect(() => {
        if (embedHtml && !resolvedHtml) {
            setResolvedHtml(embedHtml);
        }
        if (embedType && service === 'generic') {
            setService(embedType);
        }
    }, [embedHtml, embedType, resolvedHtml, service]);

    const resolveUrl = useCallback(
        async (inputUrl: string) => {
            if (!inputUrl.trim()) return;
            setLoading(true);
            setError('');

            const detected = detectService(inputUrl);
            setService(detected);

            // Try built-in generator first
            const builtIn = generateEmbedHtml(inputUrl, detected);
            if (builtIn) {
                setResolvedHtml(builtIn);
                setLoading(false);
                onUpdate?.({
                    embedUrl: inputUrl,
                    embedHtml: builtIn,
                    embedType: detected,
                    embedAspectRatio: '16/9',
                });
                return;
            }

            // Fall back to noembed.com
            const data = await resolveOembed(inputUrl);
            if (data?.html) {
                setResolvedHtml(data.html);
                onUpdate?.({
                    embedUrl: inputUrl,
                    embedHtml: data.html,
                    embedType: detected,
                    embedAspectRatio:
                        data.width && data.height
                            ? `${data.width}/${data.height}`
                            : '16/9',
                });
            } else {
                // Last resort: raw iframe
                const raw = `<iframe src="${inputUrl}" frameborder="0" style="width:100%;height:100%;aspect-ratio:16/9" allowfullscreen sandbox="allow-scripts allow-same-origin allow-popups"></iframe>`;
                setResolvedHtml(raw);
                onUpdate?.({
                    embedUrl: inputUrl,
                    embedHtml: raw,
                    embedType: 'generic',
                    embedAspectRatio: '16/9',
                });
            }
            setLoading(false);
        },
        [onUpdate],
    );

    // If we have HTML, render it
    if (resolvedHtml && !isEditing) {
        return (
            <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-black">
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs text-white">
                    {getServiceIcon(service)}
                    <span className="capitalize">{service}</span>
                    {embedUrl && (
                        <a
                            href={embedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 hover:text-blue-300 transition-colors"
                        >
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    )}
                </div>
                <div
                    className="w-full"
                    style={{ aspectRatio: embedAspectRatio || '16/9' }}
                    dangerouslySetInnerHTML={{ __html: resolvedHtml }}
                />
            </div>
        );
    }

    // Show URL input form
    return (
        <div
            className={cn(
                'rounded-xl border-2 border-dashed p-8 transition-all',
                'border-slate-300 dark:border-slate-600',
                'bg-slate-50/50 dark:bg-slate-800/50',
            )}
        >
            <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center mx-auto">
                    <Globe className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Embed External Content
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        YouTube, Vimeo, Figma, Miro, Twitter, CodePen, Loom, and more
                    </p>
                </div>

                <div className="flex gap-2 max-w-md mx-auto">
                    <Input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Paste a URL to embed..."
                        className="flex-1 text-sm"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') resolveUrl(url);
                        }}
                    />
                    <Button
                        size="sm"
                        onClick={() => resolveUrl(url)}
                        disabled={loading || !url.trim()}
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            'Embed'
                        )}
                    </Button>
                </div>

                {error && (
                    <p className="text-xs text-red-500 flex items-center justify-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {error}
                    </p>
                )}

                <div className="flex items-center justify-center gap-3 pt-2">
                    {(['youtube', 'figma', 'miro', 'vimeo', 'twitter', 'codepen', 'loom'] as EmbedServiceType[]).map(
                        (s) => (
                            <div
                                key={s}
                                className="flex items-center gap-1 text-[10px] text-slate-400 capitalize"
                            >
                                {getServiceIcon(s)}
                                {s}
                            </div>
                        ),
                    )}
                </div>
            </div>
        </div>
    );
}

export { detectService, generateEmbedHtml, resolveOembed };
export type { OEmbedData, EmbedServiceType };
