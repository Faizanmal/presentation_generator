'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Eye,
  Users,
  Clock,
  TrendingUp,
  TrendingDown,
  Zap,
  Target,
  Brain,
  Activity,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  RefreshCw,
  Download,
  BarChart3,
  Smartphone,
  Monitor,
  Tablet,
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

import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface EnhancedDashboardProps {
  projectId: string;
}

export function EnhancedAnalyticsDashboard({ projectId }: EnhancedDashboardProps) {
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'all'>('week');

  // Fetch all analytics data
  const { data: overview, isLoading: isLoadingOverview, refetch: refetchOverview } = useQuery({
    queryKey: ['analytics', 'overview', projectId, timeRange],
    queryFn: () => {
      const days = timeRange === 'day' ? 1 : timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : undefined;
      const startDate = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : undefined;
      const endDate = new Date().toISOString();
      return api.getAnalyticsSummary(projectId, startDate, endDate);
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: structuredInsights } = useQuery({
    queryKey: ['analytics', 'structured-insights', projectId],
    queryFn: () => api.getStructuredInsights(projectId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: predictive } = useQuery({
    queryKey: ['analytics', 'predictive', projectId],
    queryFn: () => api.getPredictiveAnalytics(projectId, 30),
    staleTime: 10 * 60 * 1000,
  });

  const { data: realTime, refetch: refetchRealTime } = useQuery({
    queryKey: ['analytics', 'realtime', projectId],
    queryFn: () => api.getRealTimeMetrics(projectId),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: audienceSegments } = useQuery({
    queryKey: ['analytics', 'audience', projectId],
    queryFn: () => api.getAudienceSegments(projectId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: optimization } = useQuery({
    queryKey: ['analytics', 'optimization', projectId],
    queryFn: () => api.getContentOptimization(projectId),
    staleTime: 10 * 60 * 1000,
  });

  const refreshAll = () => {
    refetchOverview();
    refetchRealTime();
  };

  if (isLoadingOverview) {
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
          <h2 className="text-2xl font-bold">Enhanced Analytics</h2>
          <p className="text-muted-foreground">AI-powered insights and predictive analytics</p>
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
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Real-Time Metrics Banner */}
      {realTime && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              Real-Time Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold text-blue-600">{realTime.activeViewers}</div>
                <div className="text-xs text-muted-foreground">Active now</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{realTime.viewsLastHour}</div>
                <div className="text-xs text-muted-foreground">Last hour</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{realTime.viewsLast24Hours}</div>
                <div className="text-xs text-muted-foreground">Last 24 hours</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{realTime.engagementRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Engagement rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="predictive">Predictive</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="optimization">Optimize</TabsTrigger>
        </TabsList>

        {/* AI Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <StructuredInsightsPanel insights={structuredInsights?.insights || []} />
        </TabsContent>

        {/* Predictive Analytics Tab */}
        <TabsContent value="predictive" className="space-y-4">
          <PredictiveAnalyticsPanel data={predictive} />
        </TabsContent>

        {/* Audience Segments Tab */}
        <TabsContent value="audience" className="space-y-4">
          <AudienceSegmentsPanel data={audienceSegments} />
        </TabsContent>

        {/* Content Optimization Tab */}
        <TabsContent value="optimization" className="space-y-4">
          <ContentOptimizationPanel suggestions={optimization?.suggestions || []} />
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
}

function MetricCard({ title, value, icon: Icon, description }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

interface StructuredInsightsPanelProps {
  insights: Array<{
    type: 'improvement' | 'warning' | 'tip' | 'success';
    title: string;
    description: string;
    actionable: boolean;
    priority: 'high' | 'medium' | 'low';
    implementation?: string;
    expectedImpact?: string;
  }>;
}

function StructuredInsightsPanel({ insights }: StructuredInsightsPanelProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'tip':
        return <Lightbulb className="w-5 h-5 text-blue-500" />;
      default:
        return <Sparkles className="w-5 h-5 text-purple-500" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      high: 'bg-red-100 text-red-700 border-red-300',
      medium: 'bg-amber-100 text-amber-700 border-amber-300',
      low: 'bg-green-100 text-green-700 border-green-300',
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  if (insights.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Gathering insights... Check back after more data is collected.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {insights.map((insight, index) => (
        <Card key={insight.title || `insight-${index}`} className="relative overflow-hidden">
          <div
            className={cn(
              'absolute top-0 left-0 right-0 h-1',
              insight.priority === 'high'
                ? 'bg-red-500'
                : insight.priority === 'medium'
                  ? 'bg-amber-500'
                  : 'bg-green-500',
            )}
          />
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {getIcon(insight.type)}
                <CardTitle className="text-base">{insight.title}</CardTitle>
              </div>
              <Badge variant="outline" className={getPriorityBadge(insight.priority)}>
                {insight.priority}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{insight.description}</p>

            {insight.expectedImpact && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-xs font-medium text-blue-900 mb-1">Expected Impact</div>
                <div className="text-sm text-blue-700">{insight.expectedImpact}</div>
              </div>
            )}

            {insight.implementation && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs font-medium mb-1">How to Implement</div>
                <div className="text-sm text-muted-foreground">{insight.implementation}</div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface PredictiveAnalyticsPanelProps {
  data?: {
    forecast: Array<{ date: string; predictedViews: number }>;
    trend: string;
    confidence: number;
    projectedGrowth: number;
    insights: string[];
  };
}

function PredictiveAnalyticsPanel({ data }: PredictiveAnalyticsPanelProps) {
  if (!data || data.trend === 'insufficient_data') {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Not enough data for predictions. Continue sharing your presentation!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = data.trend === 'growing' ? TrendingUp : data.trend === 'declining' ? TrendingDown : Activity;
  const trendColor =
    data.trend === 'growing' ? 'text-green-600' : data.trend === 'declining' ? 'text-red-600' : 'text-blue-600';

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendIcon className={cn('w-4 h-4', trendColor)} />
              Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold capitalize', trendColor)}>{data.trend}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {data.projectedGrowth > 0 ? '+' : ''}
              {data.projectedGrowth.toFixed(1)}% projected
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4" />
              Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.confidence}%</div>
            <Progress value={data.confidence} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4" />
              30-Day Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(data.forecast.reduce((sum, f) => sum + f.predictedViews, 0))}
            </div>
            <div className="text-xs text-muted-foreground">Predicted views</div>
          </CardContent>
        </Card>
      </div>

      {data.insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Forecast Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.insights.map((insight) => (
                <div key={`insight-${insight.substring(0, 20).replace(/\s+/g, '')}`} className="flex items-start gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                  <span>{insight}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface AudienceSegmentsPanelProps {
  data?: {
    devices: Record<string, number>;
    browsers: Record<string, number>;
    engagement: { high: number; medium: number; low: number };
    totalAudience: number;
    insights: string[];
  };
}

function AudienceSegmentsPanel({ data }: AudienceSegmentsPanelProps) {
  if (!data) {
    return null;
  }

  const deviceIcons = {
    mobile: Smartphone,
    tablet: Tablet,
    desktop: Monitor,
  };

  const totalDevices = Object.values(data.devices).reduce((sum, count) => sum + count, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Device Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Device Distribution</CardTitle>
          <CardDescription>How viewers access your presentation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(data.devices).map(([device, count]) => {
            const Icon = deviceIcons[device as keyof typeof deviceIcons] || Monitor;
            const percentage = ((count / totalDevices) * 100).toFixed(1);
            return (
              <div key={device} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="capitalize">{device}</span>
                  </div>
                  <span className="font-medium">
                    {count} ({percentage}%)
                  </span>
                </div>
                <Progress value={parseFloat(percentage)} className="h-2" />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Engagement Levels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Engagement Levels</CardTitle>
          <CardDescription>Viewer engagement distribution</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(data.engagement).map(([level, count]) => {
            const percentage = ((count / data.totalAudience) * 100).toFixed(1);
            const color =
              level === 'high' ? 'bg-green-500' : level === 'medium' ? 'bg-amber-500' : 'bg-red-500';

            return (
              <div key={level} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="capitalize">{level} Engagement</span>
                  <span className="font-medium">
                    {count} ({percentage}%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={cn('h-full', color)} style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Insights */}
      {data.insights.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Audience Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.insights.map((insight) => (
                <div key={`audience-insight-${insight.substring(0, 20).replace(/\s+/g, '')}`} className="flex items-start gap-2 text-sm p-3 bg-muted rounded-lg">
                  <span>{insight}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ContentOptimizationPanelProps {
  suggestions: Array<{
    slideNumber: number;
    type: string;
    issue: string;
    suggestion: string;
    priority: string;
    expectedImpact: string;
  }>;
}

function ContentOptimizationPanel({ suggestions }: ContentOptimizationPanelProps) {
  if (suggestions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Your presentation is performing well! No critical optimizations needed.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const groupedByPriority = suggestions.reduce(
    (acc, suggestion) => {
      acc[suggestion.priority as 'high' | 'medium' | 'low'].push(suggestion);
      return acc;
    },
    { high: [] as typeof suggestions, medium: [] as typeof suggestions, low: [] as typeof suggestions },
  );

  return (
    <div className="space-y-6">
      {(['high', 'medium', 'low'] as const).map((priority) => {
        if (groupedByPriority[priority].length === 0) { return null; }

        const priorityColors = {
          high: 'border-red-200 bg-red-50',
          medium: 'border-amber-200 bg-amber-50',
          low: 'border-green-200 bg-green-50',
        };

        return (
          <div key={priority} className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  'capitalize',
                  priority === 'high'
                    ? 'bg-red-100 text-red-700 border-red-300'
                    : priority === 'medium'
                      ? 'bg-amber-100 text-amber-700 border-amber-300'
                      : 'bg-green-100 text-green-700 border-green-300',
                )}
              >
                {priority} Priority
              </Badge>
              <span className="text-sm text-muted-foreground">
                {groupedByPriority[priority].length} suggestion(s)
              </span>
            </div>

            <div className="grid gap-3">
              {groupedByPriority[priority].map((suggestion) => (
                <Card key={`suggestion-${suggestion.slideNumber}-${suggestion.type}-${suggestion.issue.substring(0, 10).replace(/\s+/g, '')}`} className={priorityColors[priority]}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <span className="font-mono text-xs bg-background px-2 py-0.5 rounded">
                            Slide {suggestion.slideNumber}
                          </span>
                          {suggestion.type}
                        </CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Issue</div>
                      <div className="text-sm">{suggestion.issue}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Suggestion</div>
                      <div className="text-sm font-medium">{suggestion.suggestion}</div>
                    </div>
                    <div className="p-2 bg-background rounded border">
                      <div className="text-xs font-medium text-muted-foreground mb-1">Expected Impact</div>
                      <div className="text-sm">{suggestion.expectedImpact}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) { return `${Math.round(seconds)}s`; }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}
