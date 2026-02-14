'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    BarChart3,
    Eye,
    Clock,
    Users,
    Activity,
    MousePointer,
    Layers,
    Download,
    RefreshCw,
    MapPin,
    Smartphone,
    Monitor,
    ArrowUpRight,
    ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface ViewerAnalyticsData {
    overview: {
        totalViews: number;
        uniqueViewers: number;
        averageTimeSpent: number;
        completionRate: number;
        lastViewedAt: string;
        trend: {
            views: number;
            isPositive: boolean;
        };
    };
    slideEngagement: Array<{
        slideNumber: number;
        slideTitle: string;
        views: number;
        averageTimeSpent: number;
        dropOffRate: number;
        interactions: number;
    }>;
    viewers: Array<{
        id: string;
        email?: string;
        anonymous: boolean;
        viewedAt: string;
        timeSpent: number;
        slidesViewed: number;
        device: 'desktop' | 'mobile' | 'tablet';
        location?: string;
        completed: boolean;
    }>;
    timeline: Array<{
        date: string;
        views: number;
        uniqueViewers: number;
    }>;
    heatmap: Array<{
        slideNumber: number;
        engagement: number; // 0-100
    }>;
}

interface ViewerAnalyticsWidgetProps {
    projectId: string;
    variant?: 'full' | 'compact' | 'mini';
}

const TIME_RANGES = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'all', label: 'All time' },
];

function formatDuration(seconds: number): string {
    if (seconds < 60) { return `${Math.round(seconds)}s`; }
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
}

function formatNumber(num: number): string {
    if (num >= 1000000) { return `${(num / 1000000).toFixed(1)}M`; }
    if (num >= 1000) { return `${(num / 1000).toFixed(1)}K`; }
    return num.toString();
}

export function ViewerAnalyticsWidget({ projectId, variant = 'full' }: ViewerAnalyticsWidgetProps) {
    const [timeRange, setTimeRange] = useState('7d');
    const [activeTab, setActiveTab] = useState<'overview' | 'slides' | 'viewers'>('overview');

    // Fetch analytics data
    const { data: analytics, isLoading, refetch } = useQuery<ViewerAnalyticsData>({
        queryKey: ['viewer-analytics', projectId, timeRange],
        queryFn: async () => {
            const response = await api.get<ViewerAnalyticsData>(`/analytics/presentations/${projectId}`, {
                params: { timeRange },
            });
            return response.data;
        },
    });

    // Mock data for development
    const [mockData] = useState<ViewerAnalyticsData>(() => ({
        overview: {
            totalViews: 1247,
            uniqueViewers: 892,
            averageTimeSpent: 145,
            completionRate: 68,
            lastViewedAt: new Date().toISOString(),
            trend: { views: 23, isPositive: true },
        },
        slideEngagement: [
            { slideNumber: 1, slideTitle: 'Introduction', views: 1247, averageTimeSpent: 12, dropOffRate: 0, interactions: 156 },
            { slideNumber: 2, slideTitle: 'Problem Statement', views: 1180, averageTimeSpent: 28, dropOffRate: 5, interactions: 89 },
            { slideNumber: 3, slideTitle: 'Solution Overview', views: 1050, averageTimeSpent: 45, dropOffRate: 11, interactions: 234 },
            { slideNumber: 4, slideTitle: 'Key Features', views: 920, averageTimeSpent: 38, dropOffRate: 12, interactions: 178 },
            { slideNumber: 5, slideTitle: 'Pricing', views: 845, averageTimeSpent: 52, dropOffRate: 8, interactions: 312 },
            { slideNumber: 6, slideTitle: 'Call to Action', views: 780, averageTimeSpent: 18, dropOffRate: 8, interactions: 423 },
        ],
        viewers: [
            { id: '1', email: 'john@company.com', anonymous: false, viewedAt: new Date().toISOString(), timeSpent: 180, slidesViewed: 6, device: 'desktop', location: 'New York, US', completed: true },
            { id: '2', anonymous: true, viewedAt: new Date(Date.now() - 3600000).toISOString(), timeSpent: 95, slidesViewed: 4, device: 'mobile', location: 'London, UK', completed: false },
            { id: '3', email: 'sarah@startup.io', anonymous: false, viewedAt: new Date(Date.now() - 7200000).toISOString(), timeSpent: 210, slidesViewed: 6, device: 'desktop', completed: true },
        ],
        timeline: Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0],
            views: Math.floor(Math.random() * 200) + 50,
            uniqueViewers: Math.floor(Math.random() * 150) + 30,
        })),
        heatmap: [
            { slideNumber: 1, engagement: 95 },
            { slideNumber: 2, engagement: 78 },
            { slideNumber: 3, engagement: 92 },
            { slideNumber: 4, engagement: 65 },
            { slideNumber: 5, engagement: 88 },
            { slideNumber: 6, engagement: 72 },
        ],
    }));

    const data = (analytics || mockData) as ViewerAnalyticsData;

    if (variant === 'mini') {
        return (
            <Card className="w-full">
                <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100">
                            <Eye className="h-5 w-5 text-violet-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{formatNumber(data.overview.totalViews)}</p>
                            <p className="text-xs text-muted-foreground">Total views</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge
                            variant={data.overview.trend.isPositive ? 'default' : 'secondary'}
                            className={cn(
                                'gap-1',
                                data.overview.trend.isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            )}
                        >
                            {data.overview.trend.isPositive ? (
                                <ArrowUpRight className="h-3 w-3" />
                            ) : (
                                <ArrowDownRight className="h-3 w-3" />
                            )}
                            {data.overview.trend.views}%
                        </Badge>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (variant === 'compact') {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <BarChart3 className="h-4 w-4" />
                            Analytics
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => refetch()}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-2xl font-bold">{formatNumber(data.overview.totalViews)}</p>
                            <p className="text-xs text-muted-foreground">Views</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-2xl font-bold">{formatNumber(data.overview.uniqueViewers)}</p>
                            <p className="text-xs text-muted-foreground">Unique viewers</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-2xl font-bold">{formatDuration(data.overview.averageTimeSpent)}</p>
                            <p className="text-xs text-muted-foreground">Avg. time</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-2xl font-bold">{data.overview.completionRate}%</p>
                            <p className="text-xs text-muted-foreground">Completion</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Full variant
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <BarChart3 className="h-6 w-6 text-violet-500" />
                        Viewer Analytics
                    </h2>
                    <p className="text-muted-foreground">
                        Track how viewers engage with your presentation
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TIME_RANGES.map((range) => (
                                <SelectItem key={range.value} value={range.value}>
                                    {range.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={() => refetch()}>
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    </Button>
                    <Button variant="outline" className="gap-2">
                        <Download className="h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Overview Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <Eye className="h-8 w-8 text-violet-500" />
                            <Badge
                                variant="secondary"
                                className={cn(
                                    data.overview.trend.isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                )}
                            >
                                {data.overview.trend.isPositive ? '+' : ''}{data.overview.trend.views}%
                            </Badge>
                        </div>
                        <p className="mt-4 text-3xl font-bold">{formatNumber(data.overview.totalViews)}</p>
                        <p className="text-sm text-muted-foreground">Total Views</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <Users className="h-8 w-8 text-blue-500" />
                        <p className="mt-4 text-3xl font-bold">{formatNumber(data.overview.uniqueViewers)}</p>
                        <p className="text-sm text-muted-foreground">Unique Viewers</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <Clock className="h-8 w-8 text-amber-500" />
                        <p className="mt-4 text-3xl font-bold">{formatDuration(data.overview.averageTimeSpent)}</p>
                        <p className="text-sm text-muted-foreground">Avg. Time Spent</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <Activity className="h-8 w-8 text-green-500" />
                        <p className="mt-4 text-3xl font-bold">{data.overview.completionRate}%</p>
                        <p className="text-sm text-muted-foreground">Completion Rate</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="slides">Slide Engagement</TabsTrigger>
                    <TabsTrigger value="viewers">Viewers</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                    {/* Engagement Heatmap */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Slide Engagement Heatmap</CardTitle>
                            <CardDescription>
                                Visual representation of how viewers engage with each slide
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-1">
                                {data.heatmap.map((slide) => (
                                    <TooltipProvider key={slide.slideNumber}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className="h-16 flex-1 rounded transition-all hover:scale-105"
                                                    style={{
                                                        backgroundColor: `hsl(${slide.engagement * 1.2}, 70%, ${100 - slide.engagement / 2}%)`,
                                                    }}
                                                />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Slide {slide.slideNumber}: {slide.engagement}% engagement</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                ))}
                            </div>
                            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                                <span>Slide 1</span>
                                <span>Slide {data.heatmap.length}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Views Timeline */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Views Over Time</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-40 flex items-end gap-1">
                                {data.timeline.map((day, _index) => {
                                    const maxViews = Math.max(...data.timeline.map(d => d.views));
                                    const height = (day.views / maxViews) * 100;
                                    return (
                                        <TooltipProvider key={day.date}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div
                                                        className="flex-1 rounded-t bg-violet-500 transition-all hover:bg-violet-600"
                                                        style={{ height: `${height}%` }}
                                                    />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{new Date(day.date).toLocaleDateString()}</p>
                                                    <p>{day.views} views</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Slides Tab */}
                <TabsContent value="slides">
                    <Card>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[400px]">
                                <div className="divide-y">
                                    {data.slideEngagement.map((slide) => (
                                        <div
                                            key={slide.slideNumber}
                                            className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50"
                                        >
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted font-semibold">
                                                {slide.slideNumber}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{slide.slideTitle}</p>
                                                <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Eye className="h-3 w-3" />
                                                        {slide.views}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {formatDuration(slide.averageTimeSpent)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <MousePointer className="h-3 w-3" />
                                                        {slide.interactions}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="w-24">
                                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                                    <span>Drop-off</span>
                                                    <span>{slide.dropOffRate}%</span>
                                                </div>
                                                <Progress
                                                    value={slide.dropOffRate}
                                                    className="h-2"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Viewers Tab */}
                <TabsContent value="viewers">
                    <Card>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[400px]">
                                <div className="divide-y">
                                    {data.viewers.map((viewer) => (
                                        <div
                                            key={viewer.id}
                                            className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50"
                                        >
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                                                {viewer.anonymous ? (
                                                    <Users className="h-5 w-5" />
                                                ) : (
                                                    <span className="font-medium text-sm">
                                                        {viewer.email?.[0].toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">
                                                    {viewer.anonymous ? 'Anonymous Viewer' : viewer.email}
                                                </p>
                                                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        {viewer.device === 'desktop' ? (
                                                            <Monitor className="h-3 w-3" />
                                                        ) : viewer.device === 'mobile' ? (
                                                            <Smartphone className="h-3 w-3" />
                                                        ) : (
                                                            <Layers className="h-3 w-3" />
                                                        )}
                                                        {viewer.device}
                                                    </span>
                                                    {viewer.location && (
                                                        <span className="flex items-center gap-1">
                                                            <MapPin className="h-3 w-3" />
                                                            {viewer.location}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right text-sm">
                                                <p className="font-medium">{formatDuration(viewer.timeSpent)}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {viewer.slidesViewed} slides
                                                </p>
                                            </div>
                                            <Badge variant={viewer.completed ? 'default' : 'secondary'}>
                                                {viewer.completed ? 'Completed' : 'Partial'}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
