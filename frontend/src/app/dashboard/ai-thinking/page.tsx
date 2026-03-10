'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, Brain, Zap, Sparkles, Eye, Download, Loader2 } from 'lucide-react';
import { ThemeToggleSimple } from '@/components/ui/theme-toggle';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { ThinkingGenerationResult } from '@/types';

// Dynamically import heavy AI components
const ThinkingModeGenerator = dynamic(
    () => import('@/components/ai').then(mod => mod.ThinkingModeGenerator),
    {
        loading: () => <div className="flex justify-center items-center h-96"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>,
        ssr: false
    }
);

const ThinkingResultPreview = dynamic(
    () => import('@/components/ai').then(mod => mod.ThinkingResultPreview),
    {
        loading: () => <div className="flex justify-center items-center h-96"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>,
        ssr: false
    }
);

export default function AIThinkingPage() {
    const router = useRouter();
    const [result, setResult] = useState<ThinkingGenerationResult | null>(null);
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [savedProjectId, setSavedProjectId] = useState<string | null>(null);

    const handleComplete = useCallback(async (generationResult: ThinkingGenerationResult) => {
        setResult(generationResult);
        toast.success('Presentation generated successfully!', {
            description: `Quality score: ${generationResult.qualityReport.overallScore.toFixed(1)}/10`,
        });

        // Auto-save to dashboard
        setIsCreatingProject(true);
        try {
            toast.info('Saving to dashboard...');
            const projectResult = await api.createProjectFromThinkingResult({
                presentation: generationResult.presentation,
                title: generationResult.presentation.title,
                description: generationResult.presentation.metadata.summary,
                generateImages: generationResult.metadata.generateImages,
            });
            setSavedProjectId(projectResult.projectId);
            toast.success('Saved to dashboard');
        } catch (error: unknown) {
            console.error('Failed to auto-save project:', error);
            let errorMessage = 'Failed to save to dashboard';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null) {
                const err = error as { response?: { data?: { message?: string } | string } };
                const data = err?.response?.data;
                if (typeof data === 'string') {
                    errorMessage = data;
                } else if (data && typeof data === 'object' && data.message) {
                    errorMessage = data.message;
                }
            }
            toast.error('Failed to save to dashboard', {
                description: errorMessage,
            });
        } finally {
            setIsCreatingProject(false);
        }
    }, []);

    const handleError = useCallback((error: Error) => {
        toast.error('Generation failed', {
            description: error.message,
        });
    }, []);

    const handleCreateProject = useCallback(async () => {
        if (!result || isCreatingProject) { return; }

        // If already saved, just navigate
        if (savedProjectId) {
            router.push(`/editor/${savedProjectId}`);
            return;
        }

        setIsCreatingProject(true);
        try {
            // Create a project from the generated presentation using the thinking API
            const projectResult = await api.createProjectFromThinkingResult({
                presentation: result.presentation,
                title: result.presentation.title,
                description: result.presentation.metadata.summary,
                generateImages: result.metadata.generateImages,
            });

            // Navigate to editor with the generated content
            toast.success(`Project created with ${projectResult.slideCount} slides!`);
            router.push(`/editor/${projectResult.projectId}`);
        } catch (error: unknown) {
            let errorMessage = 'Failed to create project';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null) {
                const err = error as { response?: { data?: { message?: string } | string } };
                const data = err?.response?.data;
                if (typeof data === 'string') {
                    errorMessage = data;
                } else if (data && typeof data === 'object' && data.message) {
                    errorMessage = data.message;
                }
            }
            toast.error('Failed to create project', {
                description: errorMessage,
            });
        } finally {
            setIsCreatingProject(false);
        }
    }, [result, router, savedProjectId, isCreatingProject]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/dashboard"
                                className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                            >
                                <ArrowLeft className="h-5 w-5" />
                                <span>Back to Dashboard</span>
                            </Link>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-linear-to-r from-purple-500/20 to-blue-500/20 dark:from-purple-500/30 dark:to-blue-500/30 border border-purple-500/30 dark:border-purple-500/40">
                                <Brain className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">AI Thinking Mode</span>
                            </div>

                            {/* theme toggle */}
                            <ThemeToggleSimple />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Hero Section */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-linear-to-r from-purple-500/20 to-blue-500/20 dark:from-purple-500/30 dark:to-blue-500/30 border border-purple-500/30 dark:border-purple-500/40 mb-6">
                        <Sparkles className="h-4 w-4 text-yellow-500 dark:text-yellow-300" />
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Advanced AI Generation</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                        AI{' '}
                        <span className="bg-linear-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
                            Thinking Mode
                        </span>
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
                        Generate high-quality presentations using multi-step reasoning. Our AI plans, creates,
                        evaluates, and refines your content through iterative improvement cycles.
                    </p>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <FeatureCard
                        icon={<Brain className="h-6 w-6" />}
                        title="Deep Planning"
                        description="Analyzes topic, audience, and creates comprehensive content strategy"
                        color="purple"
                    />
                    <FeatureCard
                        icon={<Eye className="h-6 w-6" />}
                        title="Quality Evaluation"
                        description="Evaluates content across 7 criteria including clarity, engagement, and structure"
                        color="blue"
                    />
                    <FeatureCard
                        icon={<Zap className="h-6 w-6" />}
                        title="Iterative Refinement"
                        description="Automatically improves content until quality targets are met"
                        color="green"
                    />
                </div>

                {/* Generator */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <ThinkingModeGenerator
                            onComplete={handleComplete}
                            onError={handleError}
                            onOpenInEditor={handleCreateProject}
                        />
                    </div>

                    {/* Result Preview */}
                    <div>
                        {result ? (
                            <div className="space-y-6">
                                <ThinkingResultPreview result={result} />

                                <div className="flex gap-4">
                                    <Button
                                        onClick={handleCreateProject}
                                        disabled={isCreatingProject}
                                        className="flex-1 bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 dark:from-purple-700 dark:to-blue-700 dark:hover:from-purple-800 dark:hover:to-blue-800"
                                    >
                                        {isCreatingProject ? 'Creating...' : 'Create Project'}
                                    </Button>
                                    <Button variant="outline" className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800">
                                        <Download className="h-4 w-4 mr-2" />
                                        Export
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-center p-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                                    <Brain className="h-16 w-16 text-purple-600 dark:text-purple-300 mx-auto mb-4 opacity-50" />
                                    <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                                        Ready to generate
                                    </h3>
                                    <p className="text-slate-600 dark:text-slate-400">
                                        Enter a topic and click generate to see the AI thinking process in action
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

function FeatureCard({
    icon,
    title,
    description,
    color,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    color: 'purple' | 'blue' | 'green';
}) {
    const colorClasses = {
        purple: 'from-purple-500/20 to-purple-600/20 dark:from-purple-500/30 dark:to-purple-600/30 border-purple-500/30 dark:border-purple-500/40 text-purple-600 dark:text-purple-300',
        blue: 'from-blue-500/20 to-blue-600/20 dark:from-blue-500/30 dark:to-blue-600/30 border-blue-500/30 dark:border-blue-500/40 text-blue-600 dark:text-blue-300',
        green: 'from-emerald-500/20 to-emerald-600/20 dark:from-emerald-500/30 dark:to-emerald-600/30 border-emerald-500/30 dark:border-emerald-500/40 text-emerald-600 dark:text-emerald-300',
    };

    return (
        <div className={`p-6 rounded-xl border bg-linear-to-br ${colorClasses[color]}`}>
            <div className="mb-4">{icon}</div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
        </div>
    );
}
