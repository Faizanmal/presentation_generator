'use client';

import React from 'react';
import type { ThinkingGenerationResult, QualityScore } from '@/types';
import {
    CheckCircle,
    AlertCircle,
    Clock,
    Layers,
    Zap,
    TrendingUp,
    Star,
    ChevronDown,
    ChevronUp,
    Monitor,
    List as ListIcon,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChartBlock } from '@/components/editor/chart-block';

interface ThinkingResultPreviewProps {
    result: ThinkingGenerationResult;
    className?: string;
}

export function ThinkingResultPreview({ result, className = '' }: ThinkingResultPreviewProps) {
    const [expandedSections, setExpandedSections] = React.useState<Set<number>>(new Set([0]));
    const [viewMode, setViewMode] = React.useState<'list' | 'slides'>('list');
    const [currentSlideIndex, setCurrentSlideIndex] = React.useState(0);

    const toggleSection = (index: number) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedSections(newExpanded);
    };

    const getScoreColor = (score: number) => {
        if (score >= 8) { return 'text-emerald-400'; }
        if (score >= 6) { return 'text-yellow-400'; }
        return 'text-red-400';
    };

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Quality Overview */}
            {result.qualityReport ? (
                <div className="bg-linear-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Star className="h-5 w-5 text-yellow-400" />
                        Quality Report
                    </h3>

                    {/* Overall Score */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-sm text-white/60 mb-1">Overall Quality Score</p>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-4xl font-bold ${getScoreColor(result.qualityReport.overallScore)}`}>
                                    {result.qualityReport.overallScore.toFixed(1)}
                                </span>
                                <span className="text-xl text-white/40">/10</span>
                            </div>
                        </div>
                        <div
                            className={`px-4 py-2 rounded-full ${result.qualityReport.passedQualityThreshold
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                                }`}
                        >
                            {result.qualityReport.passedQualityThreshold ? (
                                <span className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4" />
                                    Passed Quality Check
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" />
                                    Needs Improvement
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Category Scores */}
                    <div className="space-y-3">
                        {result.qualityReport.categoryScores?.map((score) => (
                            <CategoryScoreBar key={score.criterion} score={score} />
                        )) || <p className="text-gray-500">No category scores available</p>}
                    </div>
                </div>
            ) : (
                <div className="bg-linear-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Star className="h-5 w-5 text-yellow-400" />
                        Quality Report
                    </h3>
                    <p className="text-gray-500">Quality report not available</p>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    icon={<Layers className="h-5 w-5" />}
                    label="Slides"
                    value={result.presentation.sections.length.toString()}
                    color="purple"
                />
                <StatCard
                    icon={<Zap className="h-5 w-5" />}
                    label="Iterations"
                    value={result.metadata.totalIterations.toString()}
                    color="blue"
                />
                <StatCard
                    icon={<Clock className="h-5 w-5" />}
                    label="Time"
                    value={`${(result.metadata.generationTimeMs / 1000).toFixed(1)}s`}
                    color="green"
                />
                <StatCard
                    icon={<TrendingUp className="h-5 w-5" />}
                    label="Improvement"
                    value={result.metadata.qualityImprovement > 0 ? `+${result.metadata.qualityImprovement.toFixed(0)}%` : '-'}
                    color="yellow"
                />
            </div>

            {/* Presentation Preview */}
            <div className="bg-linear-to-br from-slate-800 to-slate-900 rounded-xl border border-white/10 overflow-hidden">
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-white">{result.presentation.title}</h3>
                        {result.presentation.subtitle && (
                            <p className="text-white/60 mt-1">{result.presentation.subtitle}</p>
                        )}
                        <div className="flex items-center gap-4 mt-4 text-sm text-white/50">
                            <span>{result.presentation.metadata.category}</span>
                            <span>•</span>
                            <span>~{result.presentation.metadata.estimatedDuration} min</span>
                            <span>•</span>
                            <span className="capitalize">{result.presentation.metadata.difficulty}</span>
                        </div>
                    </div>

                    {/* View Toggle */}
                    <div className="flex bg-slate-950/50 p-1 rounded-lg border border-white/10">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list'
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                            title="List View"
                        >
                            <ListIcon className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('slides')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'slides'
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                            title="Slide View"
                        >
                            <Monitor className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {viewMode === 'slides' ? (
                    <div className="relative bg-slate-950 aspect-video w-full flex flex-col">
                        {/* Slide Content */}
                        <div className="flex-1 p-12 overflow-y-auto bg-white text-slate-900 m-8 rounded-lg shadow-2xl">
                            <div className={`h-full flex flex-col ${result.presentation.sections[currentSlideIndex].layout === 'two-column' ? 'grid grid-cols-2 gap-8' : ''}`}>
                                <header className="mb-8">
                                    <h2 className="text-4xl font-bold text-slate-900 mb-2">
                                        {result.presentation.sections[currentSlideIndex].heading}
                                    </h2>
                                    {result.presentation.sections[currentSlideIndex].subheading && (
                                        <p className="text-xl text-slate-500">
                                            {result.presentation.sections[currentSlideIndex].subheading}
                                        </p>
                                    )}
                                </header>

                                <div className="space-y-6">
                                    {/* Suggested Image - Visual Placeholder */}
                                    {result.presentation.sections[currentSlideIndex].suggestedImage && (
                                        <div className="mb-6 p-4 bg-purple-50 rounded-xl border border-purple-100 flex items-start gap-4">
                                            <div className="h-24 w-24 bg-purple-200 rounded-lg flex items-center justify-center shrink-0">
                                                <span className="text-2xl">🖼️</span>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-purple-900 mb-1">AI Image Suggestion</h4>
                                                <p className="text-sm text-purple-700 italic">
                                                    "{result.presentation.sections[currentSlideIndex].suggestedImage?.prompt}"
                                                </p>
                                                <div className="flex gap-2 mt-2">
                                                    <span className="text-xs px-2 py-1 bg-purple-200 text-purple-800 rounded-full">
                                                        {result.presentation.sections[currentSlideIndex].suggestedImage?.style}
                                                    </span>
                                                    <span className="text-xs px-2 py-1 bg-purple-200 text-purple-800 rounded-full">
                                                        {result.presentation.sections[currentSlideIndex].suggestedImage?.placement}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {result.presentation.sections[currentSlideIndex].blocks.map((block, idx) => {
                                        if (block.type === 'chart' && block.chartData) {
                                            const cData = block.chartData as unknown as { type: string; datasets: { data: number[]; backgroundColor: string | string[] }[]; labels: string[] };
                                            const chartProps = {
                                                type: (cData.type || 'bar') as 'bar' | 'pie' | 'line' | 'doughnut',
                                                data: (cData.labels || []).map((label: string, i: number) => ({
                                                    label,
                                                    value: cData.datasets?.[0]?.data?.[i] || 0,
                                                    color: Array.isArray(cData.datasets?.[0]?.backgroundColor)
                                                        ? cData.datasets[0].backgroundColor[i]
                                                        : cData.datasets?.[0]?.backgroundColor
                                                })),
                                                title: typeof block.content === 'string' ? block.content : undefined
                                            };

                                            // Ensure we have valid data before rendering chart
                                            if (!chartProps.data.length && cData.datasets?.[0]?.data) {
                                                // Fallback if labels are missing but data exists
                                                chartProps.data = cData.datasets[0].data.map((val: number, i: number) => ({
                                                    label: `Item ${i + 1}`,
                                                    value: val,
                                                    color: '#3b82f6'
                                                }));
                                            }

                                            return (
                                                <div
                                                     
                                                    key={block.id || `block-${idx}`}
                                                    className="h-64 w-full"
                                                >
                                                    <ChartBlock
                                                        data={chartProps}
                                                        isEditable={false}
                                                        className="h-full border-none shadow-none"
                                                    />
                                                </div>
                                            );
                                        }

                                        if (block.type === 'paragraph') {
                                            const isCard = block.formatting?.variant === 'card';
                                            return (
                                                <div
                                                     
                                                    key={block.id || `paragraph-${idx}`}
                                                    className={`text-lg leading-relaxed ${isCard
                                                        ? 'p-6 bg-slate-50 rounded-xl border border-slate-200 shadow-sm'
                                                        : ''
                                                        } ${block.formatting?.color === 'primary' ? 'text-blue-600' : 'text-slate-700'}`}
                                                >
                                                    {block.content}
                                                </div>
                                            );
                                        }

                                        return (
                                            <div
                                                 
                                                key={block.id || `generic-${idx}`}
                                                className="p-4 bg-slate-50 rounded-lg border border-slate-200"
                                            >
                                                <span className="text-xs font-mono text-slate-400 uppercase mb-2 block">{block.type}</span>
                                                <p className="text-slate-700">{typeof block.content === 'string' ? block.content : JSON.stringify(block.content)}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Navigation Controls */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-slate-900/90 backdrop-blur border-t border-white/10 flex items-center justify-between">
                            <Button
                                variant="ghost"
                                onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                                disabled={currentSlideIndex === 0}
                                className="text-white hover:bg-white/10"
                            >
                                <ChevronLeft className="h-4 w-4 mr-2" />
                                Previous
                            </Button>

                            <span className="text-white/70 font-medium">
                                Slide {currentSlideIndex + 1} of {result.presentation.sections.length}
                            </span>

                            <Button
                                variant="ghost"
                                onClick={() => setCurrentSlideIndex(Math.min(result.presentation.sections.length - 1, currentSlideIndex + 1))}
                                disabled={currentSlideIndex === result.presentation.sections.length - 1}
                                className="text-white hover:bg-white/10"
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* Sections List */
                    <div className="divide-y divide-white/10">
                        {result.presentation.sections.map((section, index) => (
                            <div
                                 
                                key={section.id || index}
                                className="transition-all"
                            >
                                <button
                                    onClick={() => toggleSection(index)}
                                    className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-sm font-medium">
                                            {index + 1}
                                        </span>
                                        <div className="text-left">
                                            <h4 className="font-medium text-white">{section.heading}</h4>
                                            <p className="text-sm text-white/50">
                                                {section.blocks.length} blocks • {section.layout}
                                            </p>
                                        </div>
                                    </div>
                                    {expandedSections.has(index) ? (
                                        <ChevronUp className="h-5 w-5 text-white/50" />
                                    ) : (
                                        <ChevronDown className="h-5 w-5 text-white/50" />
                                    )}
                                </button>

                                {expandedSections.has(index) && (
                                    <div className="px-4 pb-4 pl-16 space-y-2">
                                        {section.subheading && (
                                            <p className="text-sm text-white/70 italic">{section.subheading}</p>
                                        )}
                                        {section.blocks.map((block, blockIndex) => (
                                            <div
                                                 
                                                key={block.id || blockIndex}
                                                className="p-3 rounded-lg bg-white/5 text-sm text-white/80"
                                            >
                                                <span className="inline-block px-2 py-0.5 rounded text-xs bg-white/10 text-white/60 mb-2">
                                                    {block.type}
                                                </span>
                                                <p className="line-clamp-2">
                                                    {typeof block.content === 'string' ? block.content : JSON.stringify(block.content)}
                                                </p>
                                            </div>
                                        ))}
                                        {section.speakerNotes && (
                                            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                                <p className="text-xs text-blue-400 mb-1">Speaker Notes</p>
                                                <p className="text-sm text-white/70">{section.speakerNotes}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Improvement Suggestions */}
            {result.qualityReport.improvements.length > 0 && (
                <div className="bg-linear-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">Improvement Suggestions</h3>
                    <div className="space-y-3">
                        {result.qualityReport.improvements.slice(0, 5).map((improvement) => (
                            <div
                                key={`${improvement.area}-${improvement.suggestedChange}`}
                                className="p-4 rounded-lg bg-white/5 border border-white/10"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span
                                        className={`px-2 py-0.5 rounded text-xs font-medium ${improvement.priority === 'high'
                                            ? 'bg-red-500/20 text-red-400'
                                            : improvement.priority === 'medium'
                                                ? 'bg-yellow-500/20 text-yellow-400'
                                                : 'bg-green-500/20 text-green-400'
                                            }`}
                                    >
                                        {improvement.priority}
                                    </span>
                                    <span className="text-sm font-medium text-white">{improvement.area}</span>
                                </div>
                                <p className="text-sm text-white/60">{improvement.suggestedChange}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function CategoryScoreBar({ score }: { score: QualityScore }) {
    const percentage = (score.score / score.maxScore) * 100;

    const getBarColor = (pct: number) => {
        if (pct >= 80) { return 'bg-emerald-500'; }
        if (pct >= 60) { return 'bg-yellow-500'; }
        return 'bg-red-500';
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white/70">{score.criterion}</span>
                <span className="text-sm font-medium text-white">
                    {score.score}/{score.maxScore}
                </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${getBarColor(percentage)}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            {score.feedback && (
                <p className="text-xs text-white/50 mt-1">{score.feedback}</p>
            )}
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    color: 'purple' | 'blue' | 'green' | 'yellow';
}) {
    const colorClasses = {
        purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400',
        blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400',
        green: 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30 text-emerald-400',
        yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30 text-yellow-400',
    };

    return (
        <div className={`p-4 rounded-xl border bg-linear-to-br ${colorClasses[color]}`}>
            <div className="mb-2">{icon}</div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-sm text-white/60">{label}</p>
        </div>
    );
}

export default ThinkingResultPreview;
