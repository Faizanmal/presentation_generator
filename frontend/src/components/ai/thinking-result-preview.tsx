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
import { DESIGN_TEMPLATES } from './design-customization-types';

interface ThinkingResultPreviewProps {
    result: ThinkingGenerationResult;
    className?: string;
}

export function ThinkingResultPreview({ result, className = '' }: ThinkingResultPreviewProps) {
    const [expandedSections, setExpandedSections] = React.useState<Set<number>>(new Set([0]));
    const [viewMode, setViewMode] = React.useState<'list' | 'slides'>('list');
    const [currentSlideIndex, setCurrentSlideIndex] = React.useState(0);
    const [selectedTemplateName, setSelectedTemplateName] = React.useState(DESIGN_TEMPLATES[0].name);

    const checkTheme = DESIGN_TEMPLATES.find(t => t.name === selectedTemplateName) || DESIGN_TEMPLATES[0];

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
                {result.metadata.modelUsed && (
                    <StatCard
                        icon={<Monitor className="h-5 w-5" />}
                        label="Model"
                        value={result.metadata.modelUsed}
                        color="gray"
                    />
                )}
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
                    <div className="relative bg-slate-950 aspect-video w-full flex">
                        {/* Slide Content */}
                        <div className="flex-1 flex flex-col relative overflow-hidden">
                            <div
                                className="flex-1 p-12 overflow-y-auto m-8 rounded-lg shadow-2xl transition-colors duration-500 ease-in-out"
                                style={{
                                    backgroundColor: checkTheme.colors.background,
                                    color: checkTheme.colors.text,
                                    fontFamily: checkTheme.fonts.body,
                                    borderRadius: checkTheme.borderRadius,
                                }}
                            >
                                <div className={`h-full flex flex-col ${result.presentation.sections[currentSlideIndex].layout === 'two-column' ? 'grid grid-cols-2 gap-8' : ''}`}>
                                    <header className="mb-8">
                                        <h2
                                            className="text-4xl font-bold mb-2 transition-colors duration-500"
                                            style={{
                                                color: checkTheme.colors.primary,
                                                fontFamily: checkTheme.fonts.heading
                                            }}
                                        >
                                            {result.presentation.sections[currentSlideIndex].heading}
                                        </h2>
                                        {result.presentation.sections[currentSlideIndex].subheading && (
                                            <p
                                                className="text-xl transition-colors duration-500"
                                                style={{ color: checkTheme.colors.textMuted }}
                                            >
                                                {result.presentation.sections[currentSlideIndex].subheading}
                                            </p>
                                        )}
                                    </header>

                                    <div className="space-y-6">
                                        {/* Suggested Image - Beautiful Placeholder */}
                                        {result.presentation.sections[currentSlideIndex].suggestedImage && (
                                            <div className="mb-8 w-full overflow-hidden rounded-2xl shadow-lg border border-slate-100 group relative">
                                                {/* We use source.unsplash for visually stunning placeholders based on AI prompt */}
                                                <div
                                                    className="w-full h-48 md:h-72 lg:h-80 bg-slate-200 relative bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                                                    style={{
                                                        backgroundImage: `url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop')`, // generic abstract tech placeholder
                                                    }}
                                                >
                                                    {/* This img tag loads over the background image, grabbing a real image from unsplash dynamically based on the AI keyword. For production, switch to an official stock API */}
                                                    <img
                                                        src={`https://source.unsplash.com/featured/1200x800/?${encodeURIComponent(result.presentation.sections[currentSlideIndex].suggestedImage?.prompt.split(' ')[0] || 'business')}`}
                                                        alt={result.presentation.sections[currentSlideIndex].suggestedImage?.prompt}
                                                        className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-90"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                    <div className="absolute inset-0 bg-linear-to-t from-slate-900/80 via-slate-900/20 to-transparent"></div>

                                                    <div className="absolute bottom-4 left-4 right-4 text-white">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="text-xs font-semibold px-2.5 py-1 bg-white/20 backdrop-blur-md text-white rounded-full">
                                                                {result.presentation.sections[currentSlideIndex].suggestedImage?.style}
                                                            </span>
                                                            <span className="text-xs font-semibold px-2.5 py-1 bg-white/20 backdrop-blur-md text-white rounded-full">
                                                                {result.presentation.sections[currentSlideIndex].suggestedImage?.placement}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-white/90 drop-shadow-md">
                                                            <span className="font-semibold text-white">AI Suggestion:</span> &quot;{result.presentation.sections[currentSlideIndex].suggestedImage?.prompt}&quot;
                                                        </p>
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
                                                const alignmentClass =
                                                    block.formatting?.alignment === 'center' ? 'text-center' :
                                                        block.formatting?.alignment === 'right' ? 'text-right' : 'text-left';

                                                const customColor = block.formatting?.color?.startsWith('#')
                                                    ? block.formatting.color
                                                    : undefined;

                                                const colorClass = !customColor ? (
                                                    block.formatting?.color === 'primary' ? 'font-medium' :
                                                        block.formatting?.color === 'muted' ? 'opacity-70' : ''
                                                ) : '';

                                                // Map standard styles to dynamic theme styles
                                                const inlineStyles: React.CSSProperties = {
                                                    color: customColor || (block.formatting?.color === 'primary' ? checkTheme.colors.primary : checkTheme.colors.text),
                                                };

                                                return (
                                                    <div
                                                        key={block.id || `paragraph-${idx}`}
                                                        className={`text-[1.1rem] leading-relaxed ${alignmentClass} ${colorClass} ${isCard
                                                            ? 'p-6 rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300'
                                                            : ''
                                                            } ${block.formatting?.bold ? 'font-bold' : ''}`}
                                                        style={Object.assign({}, inlineStyles, isCard ? {
                                                            backgroundColor: checkTheme.colors.surface,
                                                            borderColor: `${checkTheme.colors.primary}20`,
                                                            borderRadius: checkTheme.borderRadius,
                                                        } : {})}
                                                    >
                                                        {block.content}
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div
                                                    key={block.id || `generic-${idx}`}
                                                    className="p-5 rounded-xl border transition-all duration-300"
                                                    style={{
                                                        backgroundColor: checkTheme.colors.surface,
                                                        borderColor: `${checkTheme.colors.primary}20`,
                                                        borderRadius: checkTheme.borderRadius
                                                    }}
                                                >
                                                    <span
                                                        className="text-xs font-mono uppercase mb-3 block tracking-wider px-2 py-1 rounded inline-block"
                                                        style={{
                                                            backgroundColor: checkTheme.colors.background,
                                                            color: checkTheme.colors.textMuted
                                                        }}
                                                    >
                                                        {block.type}
                                                    </span>
                                                    <div className="font-medium whitespace-pre-wrap" style={{ color: checkTheme.colors.text }}>
                                                        {typeof block.content === 'string' ? block.content : JSON.stringify(block.content, null, 2)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Navigation Controls */}
                            <div className="absolute bottom-0 left-0 right-0 p-4 bg-slate-900/40 backdrop-blur-sm border-t border-white/10 flex items-center justify-between">
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

                        {/* LIVE THEME TOGGLER SIDEBAR */}
                        <div className="w-64 bg-slate-900 border-l border-white/10 p-4 flex flex-col h-full overflow-y-auto">
                            <div className="flex items-center gap-2 text-white font-semibold mb-6">
                                <span className="text-xl">🎨</span>
                                <h4>Live Theming</h4>
                            </div>

                            <p className="text-xs text-white/50 mb-4 tracking-wide uppercase font-semibold">Templates</p>

                            <div className="flex flex-col gap-3">
                                {DESIGN_TEMPLATES.map((template) => (
                                    <button
                                        key={template.name}
                                        onClick={() => setSelectedTemplateName(template.name)}
                                        className={`text-left p-3 rounded-xl border transition-all ${selectedTemplateName === template.name
                                                ? 'bg-white/10 border-white/30 shadow-lg'
                                                : 'bg-transparent border-transparent hover:bg-white/5'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="text-sm">{template.icon}</span>
                                            <span className={`text-sm font-medium ${selectedTemplateName === template.name ? 'text-white' : 'text-white/70'}`}>
                                                {template.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-2">
                                            <div className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: template.colors.primary }} />
                                            <div className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: template.colors.secondary }} />
                                            <div className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: template.colors.accent }} />
                                            <div className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: template.colors.background }} />
                                        </div>
                                    </button>
                                ))}
                            </div>
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
    color: 'purple' | 'blue' | 'green' | 'yellow' | 'gray';
}) {
    const colorClasses = {
        purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400',
        blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400',
        green: 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30 text-emerald-400',
        yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30 text-yellow-400',
        gray: 'from-slate-500/20 to-slate-600/20 border-slate-500/30 text-slate-400',
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
