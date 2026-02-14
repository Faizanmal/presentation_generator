'use client';

import { useState, useRef } from 'react';
import {
    Palette,
    Upload,
    Loader2,
    Check,
    Sparkles,
    Pipette,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface ColorPaletteExtractorProps {
    onApplyTheme?: (theme: ExtractedTheme) => void;
}

interface ExtractedColor {
    hex: string;
    name: string;
    percentage: number;
}

interface ExtractedTheme {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    accent: string;
    colors: ExtractedColor[];
}

const PREDEFINED_PALETTES = [
    {
        name: 'Ocean Blue',
        colors: ['#0EA5E9', '#0284C7', '#0369A1', '#BAE6FD', '#F0F9FF'],
    },
    {
        name: 'Forest Green',
        colors: ['#10B981', '#059669', '#047857', '#D1FAE5', '#ECFDF5'],
    },
    {
        name: 'Sunset Orange',
        colors: ['#F97316', '#EA580C', '#C2410C', '#FED7AA', '#FFF7ED'],
    },
    {
        name: 'Royal Purple',
        colors: ['#8B5CF6', '#7C3AED', '#6D28D9', '#DDD6FE', '#F5F3FF'],
    },
    {
        name: 'Rose Pink',
        colors: ['#EC4899', '#DB2777', '#BE185D', '#FBCFE8', '#FDF2F8'],
    },
    {
        name: 'Slate Gray',
        colors: ['#64748B', '#475569', '#334155', '#CBD5E1', '#F1F5F9'],
    },
];

export function ColorPaletteExtractor({
    onApplyTheme,
}: ColorPaletteExtractorProps) {
    const [imageUrl, setImageUrl] = useState('');
    const [previewUrl, setPreviewUrl] = useState('');
    const [extractedTheme, setExtractedTheme] = useState<ExtractedTheme | null>(
        null,
    );
    const [themeName, setThemeName] = useState('');
    const [activeTab, setActiveTab] = useState<'extract' | 'predefined'>(
        'extract',
    );
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Extract palette from image
    const extractMutation = useMutation({
        mutationFn: async (url: string) => {
            const response = await api.post('/themes/extract-palette', {
                imageUrl: url,
            });
            return response.data;
        },
        onSuccess: (data) => {
            setExtractedTheme(data as ExtractedTheme);
        },
    });

    // Create theme from palette
    const createThemeMutation = useMutation({
        mutationFn: async () => {
            if (!extractedTheme || !themeName) { return; }
            const response = await api.post('/themes/create-from-palette', {
                themeName,
                palette: {
                    primary: extractedTheme.primary,
                    secondary: extractedTheme.secondary,
                    background: extractedTheme.background,
                    surface: extractedTheme.surface,
                    text: extractedTheme.text,
                    textMuted: extractedTheme.textMuted,
                    accent: extractedTheme.accent,
                },
            });
            return response.data;
        },
        onSuccess: (data) => {
            if (onApplyTheme && data) {
                onApplyTheme(data as ExtractedTheme);
            }
        },
    });

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // For demo, create object URL. In production, upload to storage first.
            const objectUrl = URL.createObjectURL(file);
            setPreviewUrl(objectUrl);
            // In real implementation, upload to storage and get URL
            // For now, we'll use a placeholder
            setImageUrl(objectUrl);
        }
    };

    const handleExtract = () => {
        if (imageUrl || previewUrl) {
            // In real implementation, use the uploaded image URL
            extractMutation.mutate(imageUrl || previewUrl);
        }
    };

    const handleUsePredefined = (palette: typeof PREDEFINED_PALETTES[0]) => {
        const theme: ExtractedTheme = {
            primary: palette.colors[0],
            secondary: palette.colors[1],
            background: palette.colors[4],
            surface: palette.colors[3],
            text: '#1E293B',
            textMuted: '#64748B',
            accent: palette.colors[2],
            colors: palette.colors.map((hex, i) => ({
                hex,
                name: `Color ${i + 1}`,
                percentage: 100 / palette.colors.length,
            })),
        };
        setExtractedTheme(theme);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-rose-500 to-orange-500 rounded-lg">
                    <Palette className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-900">Color Palette Tools</h3>
                    <p className="text-sm text-slate-600">
                        Extract colors from images or use presets
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('extract')}
                    className={`px-4 py-2 font-medium transition-colors ${activeTab === 'extract'
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    <Pipette className="w-4 h-4 inline mr-2" />
                    Extract from Image
                </button>
                <button
                    onClick={() => setActiveTab('predefined')}
                    className={`px-4 py-2 font-medium transition-colors ${activeTab === 'predefined'
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    <Palette className="w-4 h-4 inline mr-2" />
                    Presets
                </button>
            </div>

            {/* Extract Tab */}
            {activeTab === 'extract' && (
                <div className="space-y-4">
                    {/* Upload Area */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
                    >
                        {previewUrl ? (
                            <img
                                src={previewUrl}
                                alt="Preview"
                                className="w-full h-32 object-cover rounded"
                            />
                        ) : (
                            <>
                                <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                                <p className="text-sm text-slate-600">
                                    Click to upload an image
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    JPG, PNG up to 5MB
                                </p>
                            </>
                        )}
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                    />

                    {/* URL Input */}
                    <div className="relative">
                        <input
                            type="url"
                            placeholder="Or paste image URL..."
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                    </div>

                    {/* Extract Button */}
                    <button
                        onClick={handleExtract}
                        disabled={(!imageUrl && !previewUrl) || extractMutation.isPending}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2"
                    >
                        {extractMutation.isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Extracting Colors...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Extract Palette
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Predefined Tab */}
            {activeTab === 'predefined' && (
                <div className="grid grid-cols-2 gap-3">
                    {PREDEFINED_PALETTES.map((palette) => (
                        <button
                            key={palette.name}
                            onClick={() => handleUsePredefined(palette)}
                            className="p-3 border border-slate-200 rounded-lg hover:border-blue-500 transition-all text-left"
                        >
                            <div className="flex gap-1 mb-2">
                                {palette.colors.slice(0, 5).map((color) => (
                                    <div
                                        key={color}
                                        className="w-6 h-6 rounded"
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                            <div className="text-sm font-medium text-slate-900">
                                {palette.name}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Extracted Colors */}
            {extractedTheme && (
                <div className="space-y-4 pt-4 border-t border-slate-200">
                    <h4 className="font-medium text-slate-900">Extracted Colors</h4>

                    {/* Color Swatches */}
                    <div className="flex gap-2">
                        {extractedTheme.colors.slice(0, 6).map((color) => (
                            <div key={color.hex} className="text-center">
                                <div
                                    className="w-10 h-10 rounded-lg border border-slate-200 mb-1"
                                    style={{ backgroundColor: color.hex }}
                                />
                                <span className="text-xs text-slate-500">{color.hex}</span>
                            </div>
                        ))}
                    </div>

                    {/* Theme Preview */}
                    <div className="p-4 rounded-lg" style={{ backgroundColor: extractedTheme.surface }}>
                        <div
                            className="text-lg font-bold"
                            style={{ color: extractedTheme.primary }}
                        >
                            Theme Preview
                        </div>
                        <div style={{ color: extractedTheme.text }}>
                            Main text using extracted colors
                        </div>
                        <div style={{ color: extractedTheme.textMuted }}>
                            Secondary text in muted color
                        </div>
                        <button
                            className="mt-2 px-4 py-1 rounded text-white text-sm"
                            style={{ backgroundColor: extractedTheme.primary }}
                        >
                            Sample Button
                        </button>
                    </div>

                    {/* Create Theme */}
                    <div className="space-y-2">
                        <input
                            type="text"
                            placeholder="Theme name..."
                            value={themeName}
                            onChange={(e) => setThemeName(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                        <button
                            onClick={() => createThemeMutation.mutate()}
                            disabled={!themeName || createThemeMutation.isPending}
                            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2"
                        >
                            {createThemeMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : createThemeMutation.isSuccess ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    Theme Created!
                                </>
                            ) : (
                                'Create & Apply Theme'
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
