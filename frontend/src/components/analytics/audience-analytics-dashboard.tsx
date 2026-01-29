'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  Users,
  Eye,
  Clock,
  TrendingUp,
  MonitorSmartphone,
  Globe,
  Activity,
  Download,
  RefreshCw,
  ChevronDown,
  BarChart3,
  Flame,
  Target,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface AudienceAnalyticsDashboardProps {
  projectId: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function AudienceAnalyticsDashboard({ projectId }: AudienceAnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [isLive, setIsLive] = useState(false);

  const { data: insights, isLoading, refetch } = useQuery({
    queryKey: ['audience-insights', projectId, dateRange],
    queryFn: async () => {
      const response = await fetch(
        `/api/analytics/${projectId}/insights?range=${dateRange}`
      );
      return response.json();
    },
    refetchInterval: isLive ? 5000 : false,
  });

  const { data: realtimeData } = useQuery({
    queryKey: ['realtime-viewers', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/${projectId}/realtime`);
      return response.json();
    },
    enabled: isLive,
    refetchInterval: 5000,
  });

  const handleExport = async (format: 'csv' | 'json' | 'pdf') => {
    const response = await fetch(`/api/analytics/${projectId}/export?format=${format}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${projectId}.${format}`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Views',
      value: insights?.totalViews || 0,
      icon: Eye,
      change: '+12%',
      changeType: 'positive',
    },
    {
      label: 'Unique Viewers',
      value: insights?.uniqueViewers || 0,
      icon: Users,
      change: '+8%',
      changeType: 'positive',
    },
    {
      label: 'Avg. Duration',
      value: `${Math.round((insights?.averageViewDuration || 0) / 60)}m`,
      icon: Clock,
      change: '+5%',
      changeType: 'positive',
    },
    {
      label: 'Completion Rate',
      value: `${Math.round((insights?.completionRate || 0) * 100)}%`,
      icon: Target,
      change: '-2%',
      changeType: 'negative',
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Audience Analytics</h2>
          <p className="text-muted-foreground">
            Track viewer engagement and presentation performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={isLive ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsLive(!isLive)}
          >
            <Activity className={cn('mr-2 h-4 w-4', isLive && 'animate-pulse')} />
            {isLive ? 'Live' : 'Go Live'}
            {isLive && realtimeData && (
              <Badge variant="secondary" className="ml-2">
                {realtimeData.count} viewing
              </Badge>
            )}
          </Button>
          <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
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
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                  <p
                    className={cn(
                      'text-sm',
                      stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {stat.change} from last period
                  </p>
                </div>
                <div className="rounded-full bg-primary/10 p-3">
                  <stat.icon className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <Tabs defaultValue="engagement">
        <TabsList>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="slides">Slide Performance</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
        </TabsList>

        <TabsContent value="engagement" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Views Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Views Over Time</CardTitle>
                <CardDescription>Daily presentation views</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={insights?.viewerTimeline || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="views"
                        stroke="#3B82F6"
                        fill="#3B82F6"
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Device Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Device Breakdown</CardTitle>
                <CardDescription>How viewers access your presentation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={insights?.deviceBreakdown || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        dataKey="count"
                        nameKey="device"
                        label={({ device, percentage }) =>
                          `${device}: ${percentage.toFixed(1)}%`
                        }
                      >
                        {(insights?.deviceBreakdown || []).map((_: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex justify-center gap-4">
                  {(insights?.deviceBreakdown || []).map((item: any, index: number) => (
                    <div key={item.device} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm">{item.device}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Peak Viewing Time */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                Peak Viewing Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold">{insights?.peakViewingTime || '14:00'}</div>
                <div className="text-muted-foreground">
                  Most viewers watch your presentation around this time
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slides" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Slide Engagement</CardTitle>
              <CardDescription>Time spent and drop-off rate per slide</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={insights?.slideEngagement || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="slideNumber" />
                    <YAxis yAxisId="left" orientation="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Bar
                      yAxisId="left"
                      dataKey="averageTimeSpent"
                      fill="#3B82F6"
                      name="Avg Time (s)"
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="interactions"
                      fill="#10B981"
                      name="Interactions"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Slide Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Slide Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="pb-2">#</th>
                      <th className="pb-2">Title</th>
                      <th className="pb-2">Views</th>
                      <th className="pb-2">Avg. Time</th>
                      <th className="pb-2">Drop-off</th>
                      <th className="pb-2">Interactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(insights?.slideEngagement || []).map((slide: any) => (
                      <tr key={slide.slideId} className="border-b">
                        <td className="py-3">{slide.slideNumber}</td>
                        <td className="py-3 font-medium">{slide.title}</td>
                        <td className="py-3">{slide.views}</td>
                        <td className="py-3">{Math.round(slide.averageTimeSpent)}s</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={slide.dropOffRate * 100}
                              className={cn(
                                'h-2 w-16',
                                slide.dropOffRate > 0.3 ? 'bg-red-100' : 'bg-green-100'
                              )}
                            />
                            <span
                              className={cn(
                                'text-sm',
                                slide.dropOffRate > 0.3 ? 'text-red-600' : 'text-green-600'
                              )}
                            >
                              {Math.round(slide.dropOffRate * 100)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3">{slide.interactions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Drop-off Alert */}
          {insights?.dropOffSlide && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="rounded-full bg-orange-100 p-2">
                  <TrendingUp className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-orange-800">High Drop-off Detected</p>
                  <p className="text-sm text-orange-700">
                    Consider reviewing the content on this slide to improve engagement
                  </p>
                </div>
                <Button variant="outline" size="sm" className="ml-auto">
                  View Slide
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="audience" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Location Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Geographic Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(insights?.locationBreakdown || []).slice(0, 5).map((location: any) => (
                    <div key={location.location} className="flex items-center gap-3">
                      <div className="w-24 truncate font-medium">{location.location}</div>
                      <Progress value={location.percentage} className="flex-1" />
                      <div className="w-16 text-right text-sm text-muted-foreground">
                        {location.count} ({location.percentage.toFixed(1)}%)
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Sessions */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Viewers</CardTitle>
                <CardDescription>Latest viewer sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded-full bg-muted p-2">
                            <Users className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Anonymous Viewer</p>
                            <p className="text-xs text-muted-foreground">
                              Viewed 12 slides • 4m 32s
                            </p>
                          </div>
                        </div>
                        <Badge variant={i === 1 ? 'default' : 'secondary'}>
                          {i === 1 ? 'Completed' : 'Partial'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="heatmap" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Interaction Heatmap</CardTitle>
              <CardDescription>
                Where viewers click and interact on your slides
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-video rounded-lg border bg-muted">
                {/* Heatmap visualization would go here */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <BarChart3 className="mx-auto h-12 w-12 opacity-50" />
                    <p className="mt-2">Select a slide to view its heatmap</p>
                  </div>
                </div>
                {/* Hotspots */}
                {(insights?.interactionHotspots || []).slice(0, 5).map((hotspot: any, i: number) => (
                  <div
                    key={i}
                    className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-red-500/50"
                    style={{
                      left: `${(hotspot.x / 1920) * 100}%`,
                      top: `${(hotspot.y / 1080) * 100}%`,
                      transform: `scale(${0.5 + hotspot.count / 10})`,
                    }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
