'use client';

import { useState } from 'react';
import {
  Eye,
  Users,
  Clock,
  TrendingUp,
  Download,
  RefreshCw,
  Lightbulb,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAnalytics } from '@/hooks/use-analytics';
import type { SlideAnalytics, ViewerSession } from '@/types';

interface AnalyticsDashboardProps {
  projectId: string;
}

export function AnalyticsDashboard({ projectId }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'all'>('week');

  const {
    overview,
    insights,
    slideAnalytics,
    viewerSessions,
    isLoading,
    derivedMetrics,
    refreshAnalytics,
    exportAnalytics,
    isExporting,
  } = useAnalytics({ projectId, timeRange });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics</h2>
          <p className="text-muted-foreground">Track how your presentation performs</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Last 24h</SelectItem>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={refreshAnalytics}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportAnalytics('pdf')}
            disabled={isExporting}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Views"
          value={overview?.totalViews || 0}
          icon={Eye}
          description="Total presentation views"
        />
        <MetricCard
          title="Unique Viewers"
          value={overview?.uniqueViewers || 0}
          icon={Users}
          description="Individual viewers"
        />
        <MetricCard
          title="Avg. Duration"
          value={formatDuration(overview?.avgViewDuration || 0)}
          icon={Clock}
          description="Average time spent"
        />
        <MetricCard
          title="Completion Rate"
          value={`${Math.round((overview?.completionRate || 0) * 100)}%`}
          icon={TrendingUp}
          description="Viewed all slides"
        />
      </div>

      {/* Tabs for detailed analytics */}
      <Tabs defaultValue="slides" className="space-y-4">
        <TabsList>
          <TabsTrigger value="slides">Slide Performance</TabsTrigger>
          <TabsTrigger value="viewers">Viewer Sessions</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="slides" className="space-y-4">
          <SlidePerformance
            slides={slideAnalytics || []}
            topSlides={derivedMetrics.topSlides}
            lowPerforming={derivedMetrics.lowPerformingSlides}
          />
        </TabsContent>

        <TabsContent value="viewers" className="space-y-4">
          <ViewerSessionsTable sessions={viewerSessions || []} />
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <AIInsightsPanel insights={insights || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description: string;
  trend?: { value: number; positive: boolean };
}

function MetricCard({ title, value, icon: Icon, description, trend }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && (
          <div
            className={`text-xs mt-1 ${trend.positive ? 'text-green-600' : 'text-red-600'}`}
          >
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}% from last period
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SlidePerformanceProps {
  slides: SlideAnalytics[];
  topSlides?: SlideAnalytics[];
  lowPerforming?: SlideAnalytics[];
}

function SlidePerformance({ slides, topSlides, lowPerforming }: SlidePerformanceProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* All slides */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Slide-by-Slide Performance</CardTitle>
          <CardDescription>Engagement metrics for each slide</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {slides.map((slide) => (
                <div key={slide.slideId} className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-muted rounded flex items-center justify-center font-bold">
                    {slide.slideNumber}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>Views: {slide.views}</span>
                      <span>Avg: {formatDuration(slide.avgDuration)}</span>
                    </div>
                    {/* Visual bar for average duration, capped at 60s for visual scale */}
                    <Progress value={Math.min((slide.avgDuration / 60) * 100, 100)} className="h-2" />

                    <div className="flex justify-between text-xs text-muted-foreground pt-1">
                      <span>{slide.engagementScore} interactions</span>
                      {slide.dropoffRate > 20 && (
                        <span className="text-amber-600 font-medium">{slide.dropoffRate}% drop-off</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Highlights */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Top Performing
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSlides?.map((slide) => (
              <div key={slide.slideId} className="flex items-center justify-between py-2">
                <span>Slide {slide.slideNumber}</span>
                <Badge variant="secondary">{formatDuration(slide.avgDuration)} avg</Badge>
              </div>
            ))}
            {!topSlides?.length && <p className="text-sm text-muted-foreground">No data yet</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              High Drop-off
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowPerforming?.map((slide) => (
              <div key={slide.slideId} className="flex items-center justify-between py-2">
                <span>Slide {slide.slideNumber}</span>
                <Badge variant="destructive">
                  {slide.dropoffRate}% drop-off
                </Badge>
              </div>
            ))}
            {!lowPerforming?.length && (
              <p className="text-sm text-muted-foreground">All slides performing well!</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface ViewerSessionsTableProps {
  sessions: ViewerSession[];
}

function ViewerSessionsTable({ sessions }: ViewerSessionsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Viewer Sessions</CardTitle>
        <CardDescription>Individual viewing activity</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left text-sm font-medium">Viewer</th>
                <th className="p-3 text-left text-sm font-medium">Duration</th>
                <th className="p-3 text-left text-sm font-medium">Slides Viewed</th>
                <th className="p-3 text-left text-sm font-medium">Completion</th>
                <th className="p-3 text-left text-sm font-medium">Device</th>
              </tr>
            </thead>
            <tbody>
              {sessions.slice(0, 10).map((session) => (
                <tr key={session.id} className="border-b">
                  <td className="p-3 text-sm">
                    {session.viewerEmail || 'Anonymous'}
                  </td>
                  <td className="p-3 text-sm">{formatDuration(session.duration)}</td>
                  <td className="p-3 text-sm">{session.slidesViewed}</td>
                  <td className="p-3 text-sm">
                    <Progress
                      value={session.completionPercentage}
                      className="w-20 h-2"
                    />
                  </td>
                  <td className="p-3 text-sm capitalize">{session.device}</td>
                </tr>
              ))}
              {!sessions.length && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">No viewing sessions recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

interface AIInsightsPanelProps {
  insights: string[];
}

function AIInsightsPanel({ insights }: AIInsightsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5" />
          AI-Powered Insights
        </CardTitle>
        <CardDescription>
          Recommendations to improve your presentation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {insights.map((insight, _index) => (
            <div

              key={insight}
              className="flex gap-4 p-4 rounded-lg border bg-card"
            >
              <Lightbulb className="w-5 h-5 text-blue-500 mt-1 shrink-0" />
              <div>
                <p className="text-sm">
                  {insight}
                </p>
              </div>
            </div>
          ))}

          {insights.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No insights available yet. Keep sharing your presentation to get AI-powered recommendations.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) { return `${Math.round(seconds)}s`; }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}
