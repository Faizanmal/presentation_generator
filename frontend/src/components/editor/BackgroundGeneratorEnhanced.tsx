'use client';

import { useState } from 'react';
import {
    Sparkles,
    Palette,
    Loader2,
    Download,
    Check,
    Grid3x3,
    Lightbulb,
    Save,
    Clock,
    Trash2,
} from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface BackgroundGeneratorProps {
    onApply?: (imageUrl: string) => void;
}

const STYLE_OPTIONS = [
    { value: 'professional', label: 'Professional', emoji: '💼' },
    { value: 'abstract', label: 'Abstract', emoji: '🎨' },
    { value: 'gradient', label: 'Gradient', emoji: '🌈' },
    { value: 'geometric', label: 'Geometric', emoji: '⬛' },
    { value: 'minimal', label: 'Minimal', emoji: '⚪' },
    { value: 'nature', label: 'Nature', emoji: '🌿' },
    { value: 'tech', label: 'Tech', emoji: '💻' },
    { value: 'elegant', label: 'Elegant', emoji: '✨' },
    { value: 'vibrant', label: 'Vibrant', emoji: '⚡' },
    { value: 'creative', label: 'Creative', emoji: '🎭' },
];

const COLOR_SCHEMES = [
    'Blue and white',
    'Purple and pink',
    'Orange and yellow',
    'Green and teal',
    'Red and orange',
    'Navy and gold',
    'Black and white',
    'Pastel colors',
    'Vibrant colors',
    'Earth tones',
];

const INDUSTRIES = [
    { value: 'business', label: 'Business' },
    { value: 'tech', label: 'Technology' },
    { value: 'finance', label: 'Finance' },
    { value: 'education', label: 'Education' },
    { value: 'creative', label: 'Creative' },
];

export function BackgroundGeneratorEnhanced({
    onApply,
}: BackgroundGeneratorProps) {
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('professional');
    const [colorScheme, setColorScheme] = useState('');
    const [industry, setIndustry] = useState('business');
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'generate' | 'presets' | 'library'>(
        'generate',
    );

    // Fetch background library
    const { data: library, refetch: refetchLibrary } = useQuery({
        queryKey: ['background-library'],
        queryFn: async () => {
            const response = await api.get('/ai/background-library');
            return (response.data as { backgrounds: { id: string, url: string }[] }).backgrounds;
        },
    });

    // Fetch presets
    const { data: presets } = useQuery({
        queryKey: ['background-presets', industry, style],
        queryFn: async () => {
            const response = await api.post('/ai/background-presets', {
                industry,
                style,
            });
            return (response.data as { presets: string[] }).presets;
        },
    });

    // Generate single background
    const generateMutation = useMutation<{ url: string }>({
        mutationFn: async () => {
            const response = await api.post<{ url: string }>('/ai/generate-background', {
                prompt,
                style,
                colorScheme,
            });
            return response.data;
        },
        onSuccess: (data) => {
            setGeneratedImages([data.url]);
            setSelectedImage(data.url);
        },
    });

    // Generate batch variations
    const batchMutation = useMutation<
        { results: { success: boolean; url: string }[] },
        Error,
        string[]
    >({
        mutationFn: async (prompts: string[]) => {
            const response = await api.post<{ results: { success: boolean; url: string }[] }>('/ai/generate-backgrounds-batch', {
                prompts,
                style,
                colorScheme,
            });
            return response.data;
        },
        onSuccess: (data) => {
            const urls = data.results
                .filter((r) => r.success)
                .map((r) => r.url);
            setGeneratedImages(urls);
            if (urls.length > 0) { setSelectedImage(urls[0]); }
        },
    });

    // Save to library
    const saveMutation = useMutation({
        mutationFn: async (imageUrl: string) => {
            const response = await api.post('/ai/background-library/save', {
                url: imageUrl,
                prompt,
                style,
                colorScheme,
            });
            return response.data;
        },
        onSuccess: () => {
            refetchLibrary();
        },
    });

    // Delete from library
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/ai/background-library/${id}`);
        },
        onSuccess: () => {
            refetchLibrary();
        },
    });

    const handleGenerateVariations = () => {
        const variations = [
            prompt,
            `${prompt} with subtle patterns`,
            `${prompt} with soft lighting`,
            `${prompt} with dynamic composition`,
        ];
        batchMutation.mutate(variations);
    };

    const handleApply = (imageUrl: string) => {
        if (onApply) {
            onApply(imageUrl);
        }
    };

    const handleUsePreset = (preset: string) => {
        setPrompt(preset);
        setActiveTab('generate');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 bg-linear-to-br from-purple-500 to-pink-500 rounded-lg">
                    <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-900">
                        AI Background Generator Pro
                    </h3>
                    <p className="text-sm text-slate-600">
                        Create, save, and manage custom backgrounds
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('generate')}
                    className={`px-4 py-2 font-medium transition-colors ${activeTab === 'generate'
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    <Palette className="w-4 h-4 inline mr-2" />
                    Generate
                </button>
                <button
                    onClick={() => setActiveTab('presets')}
                    className={`px-4 py-2 font-medium transition-colors ${activeTab === 'presets'
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    <Lightbulb className="w-4 h-4 inline mr-2" />
                    Presets
                </button>
                <button
                    onClick={() => setActiveTab('library')}
                    className={`px-4 py-2 font-medium transition-colors ${activeTab === 'library'
                        ? 'border-b-2 border-blue-500 text-blue-600'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    <Clock className="w-4 h-4 inline mr-2" />
                    Library
                </button>
            </div>

            {/* Generate Tab */}
            {activeTab === 'generate' && (
                <div className="space-y-4">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe your background..."
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                        rows={3}
                    />

                    {/* Style Grid */}
                    <div className="grid grid-cols-5 gap-2">
                        {STYLE_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setStyle(option.value)}
                                className={`p-3 rounded-lg border-2 transition-all text-center ${style === option.value
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <div className="text-2xl mb-1">{option.emoji}</div>
                                <div className="text-xs font-medium">{option.label}</div>
                            </button>
                        ))}
                    </div>

                    <select
                        value={colorScheme}
                        onChange={(e) => setColorScheme(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                    >
                        <option value="">Any colors</option>
                        {COLOR_SCHEMES.map((scheme) => (
                            <option key={scheme} value={scheme}>
                                {scheme}
                            </option>
                        ))}
                    </select>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => generateMutation.mutate()}
                            disabled={!prompt.trim() || generateMutation.isPending}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                            {generateMutation.isPending ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Palette className="w-5 h-5" />
                                    Generate
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleGenerateVariations}
                            disabled={!prompt.trim() || batchMutation.isPending}
                            className="flex-1 border-2 border-purple-500 text-purple-600 hover:bg-purple-50 disabled:border-slate-300 disabled:text-slate-400 font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                            {batchMutation.isPending ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Grid3x3 className="w-5 h-5" />
                                    4 Variations
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Presets Tab */}
            {activeTab === 'presets' && (
                <div className="space-y-4">
                    <select
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                    >
                        {INDUSTRIES.map((ind) => (
                            <option key={ind.value} value={ind.value}>
                                {ind.label}
                            </option>
                        ))}
                    </select>

                    <div className="space-y-2">
                        {presets?.map((preset) => (
                            <button
                                key={preset}
                                onClick={() => handleUsePreset(preset)}
                                className="w-full text-left px-4 py-3 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
                            >
                                <div className="font-medium text-slate-900">{preset}</div>
                                <div className="text-xs text-slate-500">Click to use</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Library Tab */}
            {activeTab === 'library' && (
                <div className="space-y-2">
                    {library?.map((bg) => (
                        <div
                            key={bg.id}
                            className="relative group border border-slate-200 rounded-lg overflow-hidden hover:border-blue-500 transition-all"
                        >
                            <img
                                src={bg.url}
                                alt={`Background pattern ${bg.id}`}
                                className="w-full h-32 object-cover"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                    onClick={() => handleApply(bg.url)}
                                    className="px-3 py-1 bg-blue-600 text-white rounded"
                                >
                                    Apply
                                </button>
                                <button
                                    onClick={() => deleteMutation.mutate(bg.id)}
                                    className="px-3 py-1 bg-red-600 text-white rounded"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Generated Images Grid */}
            {generatedImages.length > 0 && activeTab === 'generate' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        {generatedImages.map((url, index) => (
                            <div
                                key={url}
                                onClick={() => setSelectedImage(url)}
                                className={`relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${selectedImage === url
                                    ? 'border-blue-500 ring-2 ring-blue-200'
                                    : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <img src={url} alt={`Generated visual variation ${index + 1}`} className="w-full h-32 object-cover" />
                                {selectedImage === url && (
                                    <div className="absolute top-2 right-2 bg-blue-500 text-white p-1 rounded-full">
                                        <Check className="w-4 h-4" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {selectedImage && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleApply(selectedImage)}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg"
                            >
                                Apply to Slides
                            </button>
                            <button
                                onClick={() => saveMutation.mutate(selectedImage)}
                                className="flex-1 border-2 border-green-500 text-green-600 hover:bg-green-50 font-medium py-2 rounded-lg flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                Save to Library
                            </button>
                            <a
                                href={selectedImage}
                                download
                                className="border-2 border-slate-200 hover:border-slate-300 px-4 py-2 rounded-lg flex items-center justify-center"
                            >
                                <Download className="w-4 h-4" />
                            </a>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
