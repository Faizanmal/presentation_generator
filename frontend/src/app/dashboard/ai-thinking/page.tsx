'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Brain, Zap, Sparkles, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ThinkingModeGenerator, ThinkingResultPreview } from '@/components/ai';
import { api } from '@/lib/api';
import type { ThinkingGenerationResult } from '@/types';

export default function AIThinkingPage() {
    const router = useRouter();
    const [result, setResult] = useState<ThinkingGenerationResult | null>(null);
    const [isCreatingProject, setIsCreatingProject] = useState(false);

    const handleComplete = useCallback((generationResult: ThinkingGenerationResult) => {
        setResult(generationResult);
        toast.success('Presentation generated successfully!', {
            description: `Quality score: ${generationResult.qualityReport.overallScore.toFixed(1)}/10`,
        });
    }, []);

    const handleError = useCallback((error: Error) => {
        toast.error('Generation failed', {
            description: error.message,
        });
    }, []);

    const handleCreateProject = useCallback(async () => {
        if (!result) { return; }

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
        } catch (_error) {
            toast.error('Failed to create project');
        } finally {
            setIsCreatingProject(false);
        }
    }, [result, router]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
            {/* Header */}
            <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/dashboard"
                                className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
                            >
                                <ArrowLeft className="h-5 w-5" />
                                <span>Back to Dashboard</span>
                            </Link>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30">
                                <Brain className="h-5 w-5 text-purple-400" />
                                <span className="text-sm font-medium text-white">AI Thinking Mode</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Hero Section */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 mb-6">
                        <Sparkles className="h-4 w-4 text-yellow-400" />
                        <span className="text-sm font-medium text-white">Advanced AI Generation</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                        AI{' '}
                        <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
                            Thinking Mode
                        </span>
                    </h1>
                    <p className="text-lg text-white/70 max-w-2xl mx-auto">
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
                                        className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                                    >
                                        {isCreatingProject ? 'Creating...' : 'Create Project'}
                                    </Button>
                                    <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                                        <Download className="h-4 w-4 mr-2" />
                                        Export
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-center p-12 rounded-2xl border border-white/10 bg-white/5">
                                    <Brain className="h-16 w-16 text-purple-400 mx-auto mb-4 opacity-50" />
                                    <h3 className="text-xl font-semibold text-white mb-2">
                                        Ready to generate
                                    </h3>
                                    <p className="text-white/60">
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
        purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400',
        blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400',
        green: 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30 text-emerald-400',
    };

    return (
        <div className={`p-6 rounded-xl border bg-gradient-to-br ${colorClasses[color]}`}>
            <div className="mb-4">{icon}</div>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-sm text-white/60">{description}</p>
        </div>
    );
}
