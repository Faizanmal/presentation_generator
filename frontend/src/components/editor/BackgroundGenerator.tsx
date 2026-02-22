'use client';

import { useState } from 'react';
import { Sparkles, Palette, Loader2, Download, Check } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface BackgroundGeneratorProps {
    onApply?: (imageUrl: string) => void;
}

const STYLE_OPTIONS = [
    { value: 'professional', label: 'Professional', description: 'Clean corporate style' },
    { value: 'abstract', label: 'Abstract', description: 'Artistic patterns' },
    { value: 'gradient', label: 'Gradient', description: 'Smooth flowing colors' },
    { value: 'geometric', label: 'Geometric', description: 'Shapes and patterns' },
    { value: 'minimal', label: 'Minimal', description: 'Clean and simple' },
    { value: 'nature', label: 'Nature', description: 'Organic elements' },
    { value: 'creative', label: 'Creative', description: 'Imaginative design' },
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

export function BackgroundGenerator({ onApply }: BackgroundGeneratorProps) {
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('professional');
    const [colorScheme, setColorScheme] = useState('');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [applied, setApplied] = useState(false);

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
            setGeneratedImage(data.url);
            setApplied(false);
        },
    });

    const handleApply = () => {
        if (generatedImage && onApply) {
            onApply(generatedImage);
            setApplied(true);
        }
    };

    const handleDownload = () => {
        if (generatedImage) {
            const link = document.createElement('a');
            link.href = generatedImage;
            link.download = `background-${Date.now()}.png`;
            link.click();
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 bg-linear-to-br from-purple-500 to-pink-500 rounded-lg">
                    <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-900">AI Background Generator</h3>
                    <p className="text-sm text-slate-600">
                        Create custom backgrounds from your imagination
                    </p>
                </div>
            </div>

            {/* Prompt Input */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                    Describe your background
                </label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., Tech-inspired digital network, futuristic cityscape, peaceful mountain landscape..."
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                />
            </div>

            {/* Style Selection */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Style</label>
                <div className="grid grid-cols-2 gap-2">
                    {STYLE_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => setStyle(option.value)}
                            className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${style === option.value
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <div className="font-medium text-sm text-slate-900">
                                {option.label}
                            </div>
                            <div className="text-xs text-slate-600">{option.description}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Color Scheme */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                    Color Scheme (optional)
                </label>
                <select
                    value={colorScheme}
                    onChange={(e) => setColorScheme(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    <option value="">Any colors</option>
                    {COLOR_SCHEMES.map((scheme) => (
                        <option key={scheme} value={scheme}>
                            {scheme}
                        </option>
                    ))}
                </select>
            </div>

            {/* Generate Button */}
            <button
                onClick={() => generateMutation.mutate()}
                disabled={!prompt.trim() || generateMutation.isPending}
                className="w-full bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-slate-400 disabled:to-slate-400 text-white font-medium py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
            >
                {generateMutation.isPending ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating...
                    </>
                ) : (
                    <>
                        <Palette className="w-5 h-5" />
                        Generate Background
                    </>
                )}
            </button>

            {/* Generated Image Preview */}
            {generatedImage && (
                <div className="space-y-4">
                    <div className="relative rounded-lg overflow-hidden border-2 border-slate-200">
                        <img
                            src={generatedImage}
                            alt="Generated background"
                            className="w-full h-48 object-cover"
                        />
                        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Generated
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleApply}
                            disabled={applied}
                            className={`flex-1 border-2 font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 ${applied
                                ? 'border-green-500 bg-green-50 text-green-700'
                                : 'border-blue-500 text-blue-600 hover:bg-blue-50'
                                }`}
                        >
                            {applied ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    Applied
                                </>
                            ) : (
                                'Apply to Slides'
                            )}
                        </button>
                        <button
                            onClick={handleDownload}
                            className="border-2 border-slate-200 hover:border-slate-300 text-slate-700 font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Download
                        </button>
                    </div>
                </div>
            )}

            {/* Error Message */}
            {generateMutation.isError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">
                        Failed to generate background. Please try again.
                    </p>
                </div>
            )}

            {/* Info */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                    <strong>💡 Tip:</strong> Be specific about what you want. Include details
                    about mood, colors, and elements. Generated backgrounds are optimized for
                    text overlay.
                </p>
            </div>
        </div>
    );
}
