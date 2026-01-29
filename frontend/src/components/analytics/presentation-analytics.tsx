"use client";

import { useState, useEffect, useMemo } from "react";
import {
    BarChart3,
    Eye,
    Clock,
    Users,
    TrendingUp,
    Download,
    Share2,
    Calendar,
    Activity,
    Sparkles,
    ArrowUp,
    ArrowDown,
    Minus,
    Globe,
    Monitor,
    Smartphone,
    MousePointer,
    Timer,
    BarChart2,
    PieChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PresentationStats {
    totalViews: number;
    uniqueViewers: number;
    avgViewDuration: number; // seconds
    completionRate: number; // percentage
    shareCount: number;
    downloadCount: number;
    lastViewed: string;
}

interface SlideStats {
    slideId: string;
    slideNumber: number;
    slideTitle: string;
    views: number;
    avgDuration: number;
    dropOffRate: number;
    clicks: number;
}

interface ViewerSession {
    id: string;
    viewerName?: string;
    viewerEmail?: string;
    startTime: string;
    duration: number;
    slidesViewed: number;
    device: "desktop" | "mobile" | "tablet";
    location?: string;
    completionRate: number;
}

interface AnalyticsDashboardProps {
    projectId: string;
    projectTitle: string;
    stats: PresentationStats;
    slideStats: SlideStats[];
    viewerSessions: ViewerSession[];
    timeRange: "7d" | "30d" | "90d" | "all";
    onTimeRangeChange: (range: "7d" | "30d" | "90d" | "all") => void;
}

export function AnalyticsDashboard({
    projectId,
    projectTitle,
    stats,
    slideStats,
    viewerSessions,
    timeRange,
    onTimeRangeChange,
}: AnalyticsDashboardProps) {
    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Analytics</h1>
                    <p className="text-slate-500">{projectTitle}</p>
                </div>

                <div className="flex items-center gap-3">
                    <Select value={timeRange} onValueChange={(v: any) => onTimeRangeChange(v)}>
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7d">Last 7 days</SelectItem>
                            <SelectItem value="30d">Last 30 days</SelectItem>
                            <SelectItem value="90d">Last 90 days</SelectItem>
                            <SelectItem value="all">All time</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button variant="outline" className="gap-2">
                        <Download className="h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Views"
                    value={stats.totalViews}
                    icon={Eye}
                    trend={12}
                    description="Total presentation views"
                />
                <StatCard
                    title="Unique Viewers"
                    value={stats.uniqueViewers}
                    icon={Users}
                    trend={8}
                    description="Individual viewers"
                />
                <StatCard
                    title="Avg. View Time"
                    value={formatDuration(stats.avgViewDuration)}
                    icon={Clock}
                    trend={-3}
                    description="Average session duration"
                />
                <StatCard
                    title="Completion Rate"
                    value={`${stats.completionRate}%`}
                    icon={TrendingUp}
                    trend={5}
                    description="Viewers who finished"
                />
            </div>

            {/* Main Content */}
            <Tabs defaultValue="slides" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="slides" className="gap-2">
                        <BarChart2 className="h-4 w-4" />
                        Slide Performance
                    </TabsTrigger>
                    <TabsTrigger value="viewers" className="gap-2">
                        <Users className="h-4 w-4" />
                        Viewer Activity
                    </TabsTrigger>
                    <TabsTrigger value="engagement" className="gap-2">
                        <Activity className="h-4 w-4" />
                        Engagement
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="slides" className="space-y-4">
                    <SlidePerformanceTable slides={slideStats} />
                </TabsContent>

                <TabsContent value="viewers" className="space-y-4">
                    <ViewerActivityTable sessions={viewerSessions} />
                </TabsContent>

                <TabsContent value="engagement" className="space-y-4">
                    <EngagementMetrics
                        slideStats={slideStats}
                        completionRate={stats.completionRate}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Stat Card Component
function StatCard({
    title,
    value,
    icon: Icon,
    trend,
    description,
}: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    trend?: number;
    description: string;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                    {title}
                </CardTitle>
                <Icon className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
                <div className="flex items-end justify-between">
                    <div className="text-2xl font-bold">{value}</div>
                    {trend !== undefined && (
                        <div
                            className={cn(
                                "flex items-center text-xs font-medium",
                                trend > 0
                                    ? "text-green-600"
                                    : trend < 0
                                        ? "text-red-600"
                                        : "text-slate-500"
                            )}
                        >
                            {trend > 0 ? (
                                <ArrowUp className="h-3 w-3 mr-0.5" />
                            ) : trend < 0 ? (
                                <ArrowDown className="h-3 w-3 mr-0.5" />
                            ) : (
                                <Minus className="h-3 w-3 mr-0.5" />
                            )}
                            {Math.abs(trend)}%
                        </div>
                    )}
                </div>
                <p className="text-xs text-slate-500 mt-1">{description}</p>
            </CardContent>
        </Card>
    );
}

// Slide Performance Table
function SlidePerformanceTable({ slides }: { slides: SlideStats[] }) {
    const maxViews = Math.max(...slides.map((s) => s.views));

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Slide Performance
                </CardTitle>
                <CardDescription>
                    How each slide performs with your audience
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {slides.map((slide) => (
                        <div
                            key={slide.slideId}
                            className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-medium">
                                {slide.slideNumber}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium truncate">{slide.slideTitle}</span>
                                    <span className="text-sm text-slate-500">
                                        {slide.views} views
                                    </span>
                                </div>
                                <Progress
                                    value={(slide.views / maxViews) * 100}
                                    className="h-2"
                                />
                            </div>

                            <div className="flex items-center gap-4 text-sm text-slate-500">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {formatDuration(slide.avgDuration)}
                                        </TooltipTrigger>
                                        <TooltipContent>Average view time</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>

                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger className="flex items-center gap-1">
                                            <MousePointer className="h-3 w-3" />
                                            {slide.clicks}
                                        </TooltipTrigger>
                                        <TooltipContent>Click interactions</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>

                                {slide.dropOffRate > 20 && (
                                    <Badge variant="destructive" className="text-xs">
                                        {slide.dropOffRate}% drop-off
                                    </Badge>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

// Viewer Activity Table
function ViewerActivityTable({ sessions }: { sessions: ViewerSession[] }) {
    const deviceIcons = {
        desktop: Monitor,
        mobile: Smartphone,
        tablet: Monitor,
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Recent Viewers
                </CardTitle>
                <CardDescription>
                    Track who's viewing your presentation
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                        {sessions.map((session) => {
                            const DeviceIcon = deviceIcons[session.device];

                            return (
                                <div
                                    key={session.id}
                                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                >
                                    <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <DeviceIcon className="h-5 w-5 text-slate-500" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium">
                                            {session.viewerName || session.viewerEmail || "Anonymous"}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <span>{formatTimeAgo(new Date(session.startTime))}</span>
                                            {session.location && (
                                                <>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <Globe className="h-3 w-3" />
                                                        {session.location}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-right text-sm">
                                        <div className="font-medium">
                                            {formatDuration(session.duration)}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {session.slidesViewed} slides • {session.completionRate}%
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

// Engagement Metrics
function EngagementMetrics({
    slideStats,
    completionRate,
}: {
    slideStats: SlideStats[];
    completionRate: number;
}) {
    // Find hotspots and problem areas
    const avgDuration = slideStats.reduce((acc, s) => acc + s.avgDuration, 0) / slideStats.length;
    const hotSlides = slideStats.filter((s) => s.avgDuration > avgDuration * 1.5);
    const coldSlides = slideStats.filter((s) => s.avgDuration < avgDuration * 0.5);
    const dropOffSlides = slideStats.filter((s) => s.dropOffRate > 20);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Completion Funnel */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <PieChart className="h-5 w-5" />
                        Completion Funnel
                    </CardTitle>
                    <CardDescription>
                        How far viewers get through your presentation
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[
                            { label: "Started", percent: 100 },
                            { label: "Viewed 25%", percent: 85 },
                            { label: "Viewed 50%", percent: 65 },
                            { label: "Viewed 75%", percent: 50 },
                            { label: "Completed", percent: completionRate },
                        ].map((step, i) => (
                            <div key={step.label} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span>{step.label}</span>
                                    <span className="font-medium">{step.percent}%</span>
                                </div>
                                <Progress value={step.percent} className="h-2" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Insights */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        AI Insights
                    </CardTitle>
                    <CardDescription>
                        Recommendations based on viewer behavior
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {hotSlides.length > 0 && (
                            <InsightItem
                                type="positive"
                                title="High Engagement Slides"
                                description={`Slides ${hotSlides.map((s) => s.slideNumber).join(", ")} are getting extra attention. Consider using similar content patterns.`}
                            />
                        )}

                        {dropOffSlides.length > 0 && (
                            <InsightItem
                                type="warning"
                                title="Drop-off Points"
                                description={`Viewers are leaving at slides ${dropOffSlides.map((s) => s.slideNumber).join(", ")}. Consider revising these slides.`}
                            />
                        )}

                        {coldSlides.length > 0 && (
                            <InsightItem
                                type="neutral"
                                title="Quick Scroll Slides"
                                description={`Slides ${coldSlides.map((s) => s.slideNumber).join(", ")} are viewed quickly. They may need more engaging content.`}
                            />
                        )}

                        {completionRate > 70 && (
                            <InsightItem
                                type="positive"
                                title="Great Completion Rate"
                                description={`${completionRate}% of viewers finish your presentation. That's above average!`}
                            />
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// Insight Item
function InsightItem({
    type,
    title,
    description,
}: {
    type: "positive" | "warning" | "neutral";
    title: string;
    description: string;
}) {
    const colors = {
        positive: "border-l-green-500 bg-green-50 dark:bg-green-950/20",
        warning: "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
        neutral: "border-l-blue-500 bg-blue-50 dark:bg-blue-950/20",
    };

    return (
        <div className={cn("p-3 rounded-lg border-l-4", colors[type])}>
            <h4 className="font-medium text-sm">{title}</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {description}
            </p>
        </div>
    );
}

// Utility functions
function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
}

function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

// Mini analytics widget for editor
export function AnalyticsWidget({
    views,
    avgDuration,
    completionRate,
    onClick,
}: {
    views: number;
    avgDuration: number;
    completionRate: number;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-4 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
            <div className="flex items-center gap-1.5 text-sm">
                <Eye className="h-4 w-4 text-slate-400" />
                <span>{views}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
                <Clock className="h-4 w-4 text-slate-400" />
                <span>{formatDuration(avgDuration)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
                <TrendingUp className="h-4 w-4 text-slate-400" />
                <span>{completionRate}%</span>
            </div>
        </button>
    );
}
