'use client';

import { useState } from 'react';
import {
    Download,
    ChevronDown,
    Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SlideDesignControlsProps {
    projectId: string;
    slideId?: string;
    themes?: Array<{
        id: string;
        name: string;
        colors: { background: string; primary: string; text: string };
    }>;
    currentThemeId?: string;
    onThemeChange?: (themeId: string) => void;
    onExportPdf?: () => void;
    onLayoutDensityChange?: (density: number) => void;
    onToneChange?: (tone: number) => void;
}

export function SlideDesignControls({
    projectId,
    slideId,
    themes = [],
    currentThemeId,
    onThemeChange,
    onExportPdf,
    onLayoutDensityChange,
    onToneChange,
}: SlideDesignControlsProps) {
    const [layoutDensity, setLayoutDensity] = useState(66);
    const [toneOfVoice, setToneOfVoice] = useState(75);
    const [isExporting, setIsExporting] = useState(false);

    const handleLayoutDensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        setLayoutDensity(value);
        onLayoutDensityChange?.(value);
    };

    const handleToneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        setToneOfVoice(value);
        onToneChange?.(value);
    };

    const getDensityLabel = (value: number) => {
        if (value < 33) return 'Spacious';
        if (value < 66) return 'Balanced';
        return 'Compact';
    };

    const getToneLabel = (value: number) => {
        if (value < 25) return 'Casual';
        if (value < 50) return 'Neutral';
        if (value < 75) return 'Professional';
        return 'Formal';
    };

    const handleExportPdf = async () => {
        setIsExporting(true);
        try {
            onExportPdf?.();
        } finally {
            setTimeout(() => setIsExporting(false), 2000);
        }
    };

    return (
        <div className="space-y-6">
            {/* Theme Controls */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-gray-400">style</span>
                    Slide Theme
                </h3>

                {themes.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                        {themes.slice(0, 4).map((theme) => (
                            <button
                                key={theme.id}
                                onClick={() => onThemeChange?.(theme.id)}
                                className={cn(
                                    "p-2 border rounded-lg flex flex-col gap-2 group transition-all",
                                    currentThemeId === theme.id
                                        ? "border-blue-600 bg-blue-50 dark:bg-blue-950/20"
                                        : "border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500"
                                )}
                            >
                                <div
                                    className="w-full h-8 rounded flex overflow-hidden border"
                                    style={{
                                        backgroundColor: theme.colors.background,
                                        borderColor: theme.colors.primary + '40'
                                    }}
                                >
                                    <div
                                        className="w-1/3 h-full"
                                        style={{ backgroundColor: theme.colors.primary }}
                                    />
                                </div>
                                <span className={cn(
                                    "text-xs font-medium text-center",
                                    currentThemeId === theme.id ? "text-blue-600" : "text-gray-600 dark:text-gray-400"
                                )}>
                                    {theme.name}
                                </span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        <button className="p-2 border border-blue-600 bg-blue-50 dark:bg-blue-950/20 rounded-lg flex flex-col gap-2">
                            <div className="w-full h-8 bg-white border border-gray-200 rounded flex overflow-hidden">
                                <div className="w-1/3 bg-slate-900 h-full" />
                            </div>
                            <span className="text-xs font-medium text-blue-600 text-center">Professional</span>
                        </button>
                        <button className="p-2 border border-gray-200 dark:border-slate-600 hover:border-gray-300 rounded-lg flex flex-col gap-2">
                            <div className="w-full h-8 bg-slate-900 border border-slate-700 rounded flex overflow-hidden items-center justify-center">
                                <span className="text-[6px] text-white">DARK</span>
                            </div>
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 text-center">Midnight</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Layout Density Slider */}
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Layout Density</span>
                    <span className="text-xs text-gray-400">{getDensityLabel(layoutDensity)}</span>
                </div>
                <div className="relative">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={layoutDensity}
                        onChange={handleLayoutDensityChange}
                        className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-600
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                            [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                            [&::-webkit-slider-thumb]:shadow-md"
                    />
                    <div
                        className="absolute top-0 left-0 h-1.5 bg-blue-600 rounded-full pointer-events-none"
                        style={{ width: `${layoutDensity}%` }}
                    />
                </div>
            </div>

            {/* Tone of Voice Slider */}
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Tone of Voice</span>
                    <span className="text-xs text-gray-400">{getToneLabel(toneOfVoice)}</span>
                </div>
                <div className="relative">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={toneOfVoice}
                        onChange={handleToneChange}
                        className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-600
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                            [&::-webkit-slider-thumb]:bg-purple-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                            [&::-webkit-slider-thumb]:shadow-md"
                    />
                    <div
                        className="absolute top-0 left-0 h-1.5 bg-purple-500 rounded-full pointer-events-none"
                        style={{ width: `${toneOfVoice}%` }}
                    />
                </div>
            </div>

            {/* Export to PDF */}
            <div className="pt-4 mt-auto">
                <button
                    onClick={handleExportPdf}
                    disabled={isExporting}
                    className="w-full py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {isExporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="h-4 w-4" />
                    )}
                    Export to PDF
                </button>
            </div>
        </div>
    );
}
