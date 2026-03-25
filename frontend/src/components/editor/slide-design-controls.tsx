'use client';

import { useState } from 'react';
import {
    Download,
    Loader2,
    Palette,
    LayoutGrid,
    MessageSquare,
    Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface SlideDesignControlsProps {
    projectId: string;
    slideId?: string;
    themes?: Array<{
        id: string;
        name: string;
        colors: { background: string; primary: string; text: string; accent?: string };
    }>;
    currentThemeId?: string;
    onThemeChange?: (themeId: string) => void;
    onExportPdf?: () => void;
    onLayoutDensityChange?: (density: number) => void;
    onToneChange?: (tone: number) => void;
}

export function SlideDesignControls({
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
        if (value < 33) { return 'Spacious'; }
        if (value < 66) { return 'Balanced'; }
        return 'Compact';
    };

    const getDensityIcon = (value: number) => {
        if (value < 33) {return '🧘';}
        if (value < 66) {return '⚖️';}
        return '📊';
    };

    const getToneLabel = (value: number) => {
        if (value < 25) { return 'Casual'; }
        if (value < 50) { return 'Neutral'; }
        if (value < 75) { return 'Professional'; }
        return 'Formal';
    };

    const getToneIcon = (value: number) => {
        if (value < 25) {return '😊';}
        if (value < 50) {return '🤝';}
        if (value < 75) {return '💼';}
        return '🎩';
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
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Palette className="h-4 w-4 text-violet-500" />
                    Slide Theme
                </h3>

                {themes.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                        {themes.map((theme, idx) => (
                            <motion.button
                                key={theme.id}
                                onClick={() => onThemeChange?.(theme.id)}
                                whileHover={{ scale: 1.05, y: -2 }}
                                whileTap={{ scale: 0.95 }}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                className={cn(
                                    "p-1.5 rounded-xl flex flex-col gap-1.5 group transition-all duration-200 overflow-hidden",
                                    currentThemeId === theme.id
                                        ? "ring-2 ring-violet-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-950 shadow-lg shadow-violet-500/10"
                                        : "ring-1 ring-gray-200 dark:ring-slate-700 hover:ring-gray-300 dark:hover:ring-slate-600 hover:shadow-md"
                                )}
                            >
                                <div
                                    className="w-full h-8 rounded-lg flex overflow-hidden relative"
                                    style={{ backgroundColor: theme.colors.background }}
                                >
                                    <div
                                        className="w-1/3 h-full"
                                        style={{ backgroundColor: theme.colors.primary }}
                                    />
                                    {theme.colors.accent && (
                                        <div
                                            className="absolute right-0 top-0 w-3 h-3 rounded-bl-lg"
                                            style={{ backgroundColor: theme.colors.accent }}
                                        />
                                    )}
                                </div>
                                <span className={cn(
                                    "text-[10px] font-semibold text-center truncate w-full",
                                    currentThemeId === theme.id ? "text-violet-600 dark:text-violet-400" : "text-gray-500 dark:text-gray-400"
                                )}>
                                    {theme.name}
                                </span>
                            </motion.button>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        <button className="p-2 ring-2 ring-violet-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-950 rounded-xl flex flex-col gap-2 shadow-md shadow-violet-500/10">
                            <div className="w-full h-8 bg-white border border-gray-200 rounded-lg flex overflow-hidden">
                                <div className="w-1/3 bg-slate-900 h-full" />
                            </div>
                            <span className="text-[10px] font-bold text-violet-600 text-center">Professional</span>
                        </button>
                        <button className="p-2 ring-1 ring-gray-200 dark:ring-slate-700 hover:ring-gray-300 rounded-xl flex flex-col gap-2 hover:shadow-md transition-all">
                            <div className="w-full h-8 bg-slate-900 border border-slate-700 rounded-lg flex overflow-hidden items-center justify-center">
                                <span className="text-[6px] text-white font-bold tracking-wider">DARK</span>
                            </div>
                            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 text-center">Midnight</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-slate-700 to-transparent" />

            {/* Layout Density Slider */}
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <LayoutGrid className="h-3.5 w-3.5 text-blue-500" />
                        Layout Density
                    </span>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <span>{getDensityIcon(layoutDensity)}</span>
                        {getDensityLabel(layoutDensity)}
                    </span>
                </div>
                <div className="relative">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={layoutDensity}
                        onChange={handleLayoutDensityChange}
                        className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                            [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-blue-500 [&::-webkit-slider-thumb]:to-blue-600
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                            [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-blue-500/30
                            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
                    />
                    <div
                        className="absolute top-0 left-0 h-2 rounded-full pointer-events-none"
                        style={{
                            width: `${layoutDensity}%`,
                            background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                        }}
                    />
                </div>
            </div>

            {/* Tone of Voice Slider */}
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-purple-500" />
                        Tone of Voice
                    </span>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <span>{getToneIcon(toneOfVoice)}</span>
                        {getToneLabel(toneOfVoice)}
                    </span>
                </div>
                <div className="relative">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={toneOfVoice}
                        onChange={handleToneChange}
                        className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                            [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-purple-500 [&::-webkit-slider-thumb]:to-purple-600
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                            [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-purple-500/30
                            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
                    />
                    <div
                        className="absolute top-0 left-0 h-2 rounded-full pointer-events-none"
                        style={{
                            width: `${toneOfVoice}%`,
                            background: 'linear-gradient(90deg, #8b5cf6, #d946ef)',
                        }}
                    />
                </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-slate-700 to-transparent" />

            {/* Export to PDF */}
            <div className="pt-2">
                <motion.button
                    onClick={handleExportPdf}
                    disabled={isExporting}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2.5 disabled:opacity-50 text-white shadow-lg"
                    style={{
                        background: 'linear-gradient(135deg, #111827, #1e293b)',
                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
                    }}
                >
                    {isExporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="h-4 w-4" />
                    )}
                    Export to PDF
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                </motion.button>
            </div>
        </div>
    );
}
