'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Eye,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  PieChart,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  Target,
  Zap,
  RefreshCw,
  Download,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AdvancedAnalyticsDashboardProps {
  projectId: string;
  className?: string;
}

interface AnalyticsSummary {
  totalViews: number;
  uniqueViews: number;
  averageDuration: number;
  completionRate: number;
  dropOffSlide: number | null;
  topSlides: Array<{
    slideIndex: number;
    averageDuration: number;
    viewCount: number;
  }>;
  viewsByDay: Array<{
    date: string;
    views: number;
    uniqueViews: number;
  }>;
  insights: string[];
}

interface AIRecommendation {
  category: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  impact: string;
  implementation: string;
}

export function AdvancedAnalyticsDashboard({
  projectId,
  className,
}: AdvancedAnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState('30d');
  const [showAIInsights, setShowAIInsights] = useState(true);

  // Fetch analytics summary
  const { data: analytics, isLoading: isLoadingAnalytics, refetch: refetchAnalytics } = useQuery({
    queryKey: ['analytics', projectId, dateRange],
    queryFn: async () => {
      const endDate = new Date().toISOString();
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      const response = await api.get(`/analytics/${projectId}/summary`, {
        params: { startDate, endDate },
      });
      return response.data as AnalyticsSummary;
    },
  });

  // Fetch AI recommendations
  const { data: recommendations, isLoading: isLoadingRecommendations } = useQuery({
    queryKey: ['ai-recommendations', projectId],
    queryFn: async () => {
      const response = await api.post(`/analytics/${projectId}/ai-recommendations`, {});
      return response.data as { recommendations: AIRecommendation[]; overallScore: number };
    },
    enabled: showAIInsights,
  });

  // Fetch slide performance
  const { data: slidePerformance } = useQuery({
    queryKey: ['slide-performance', projectId, dateRange],
    queryFn: async () => {
      const response = await api.get(`/analytics/${projectId}/slides/performance`);
      return response.data;
    },
  });

  // Format duration
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  // Calculate trend
  const getTrend = (current: number, previous: number) => {
    if (previous === 0) return { value: 0, isPositive: true };
    const change = ((current - previous) / previous) * 100;
    return { value: Math.abs(change), isPositive: change >= 0 };
  };

  if (isLoadingAnalytics) {
    return (
      <div className={cn('flex items-center justify-center h-64', className)}>
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Analytics</h2>
          <p className="text-slate-500">Insights and performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetchAnalytics()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Views"
          value={analytics?.totalViews || 0}
          icon={<Eye className="h-5 w-5" />}
          trend={{ value: 12, isPositive: true }}
          description="Total presentation views"
        />
        <MetricCard
          title="Unique Viewers"
          value={analytics?.uniqueViews || 0}
          icon={<Users className="h-5 w-5" />}
          trend={{ value: 8, isPositive: true }}
          description="Distinct viewers"
        />
        <MetricCard
          title="Avg. Duration"
          value={formatDuration(analytics?.averageDuration || 0)}
          icon={<Clock className="h-5 w-5" />}
          trend={{ value: 5, isPositive: true }}
          description="Average viewing time"
          isFormatted
        />
        <MetricCard
          title="Completion Rate"
          value={`${Math.round((analytics?.completionRate || 0) * 100)}%`}
          icon={<Target className="h-5 w-5" />}
          trend={{ value: 3, isPositive: true }}
          description="Viewers who finished"
          isFormatted
        />
      </div>

      {/* Views Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Views Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <SimpleLineChart data={analytics?.viewsByDay || []} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Slide Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Slide Performance
            </CardTitle>
            <CardDescription>Engagement by slide</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics?.topSlides?.slice(0, 5).map((slide, index) => (
                <div key={slide.slideIndex} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-sm font-medium">
                    {slide.slideIndex + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Slide {slide.slideIndex + 1}</span>
                      <span className="text-sm text-slate-500">
                        {formatDuration(slide.averageDuration)} avg
                      </span>
                    </div>
                    <Progress
                      value={(slide.averageDuration / (analytics?.averageDuration || 1)) * 100}
                      className="h-2"
                    />
                  </div>
                  <span className="text-sm text-slate-500">{slide.viewCount} views</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              AI Insights
            </CardTitle>
            <CardDescription>Smart recommendations to improve engagement</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingRecommendations ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="space-y-3">
                {recommendations?.recommendations?.slice(0, 4).map((rec, index) => (
                  <div
                    key={index}
                    className={cn(
                      'p-3 rounded-lg border-l-4',
                      rec.priority === 'high'
                        ? 'bg-red-50 border-red-500'
                        : rec.priority === 'medium'
                        ? 'bg-yellow-50 border-yellow-500'
                        : 'bg-green-50 border-green-500',
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium uppercase text-slate-500">
                        {rec.category}
                      </span>
                      <span
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded',
                          rec.priority === 'high'
                            ? 'bg-red-100 text-red-700'
                            : rec.priority === 'medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700',
                        )}
                      >
                        {rec.priority}
                      </span>
                    </div>
                    <p className="font-medium text-slate-900">{rec.title}</p>
                    <p className="text-sm text-slate-600 mt-1">{rec.description}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Insights */}
      {analytics?.insights && analytics.insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" />
              Quick Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {analytics.insights.map((insight, index) => (
                <div
                  key={index}
                  className="p-3 bg-blue-50 rounded-lg flex items-start gap-2"
                >
                  <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-900">{insight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drop-off Alert */}
      {analytics?.dropOffSlide !== null && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="font-medium text-orange-900">
                  High Drop-off at Slide {(analytics?.dropOffSlide || 0) + 1}
                </p>
                <p className="text-sm text-orange-700">
                  Consider reviewing the content on this slide to improve engagement
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Metric Card Component
function MetricCard({
  title,
  value,
  icon,
  trend,
  description,
  isFormatted = false,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  description: string;
  isFormatted?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-slate-500">{icon}</div>
          {trend && (
            <div
              className={cn(
                'flex items-center text-sm',
                trend.isPositive ? 'text-green-600' : 'text-red-600',
              )}
            >
              {trend.isPositive ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownRight className="h-4 w-4" />
              )}
              {trend.value.toFixed(1)}%
            </div>
          )}
        </div>
        <div className="text-3xl font-bold text-slate-900">
          {isFormatted ? value : value.toLocaleString()}
        </div>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

// Simple Line Chart (canvas-based)
function SimpleLineChart({
  data,
}: {
  data: Array<{ date: string; views: number; uniqueViews: number }>;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.views));
  const padding = 40;

  return (
    <svg width="100%" height="100%" viewBox="0 0 800 256" preserveAspectRatio="none">
      {/* Grid lines */}
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={i}
          x1={padding}
          y1={padding + (i * (256 - padding * 2)) / 4}
          x2={800 - padding}
          y2={padding + (i * (256 - padding * 2)) / 4}
          stroke="#e5e7eb"
          strokeWidth="1"
        />
      ))}

      {/* Area fill */}
      <path
        d={`
          M ${padding} ${256 - padding}
          ${data
            .map((point, index) => {
              const x = padding + (index / (data.length - 1)) * (800 - padding * 2);
              const y = 256 - padding - (point.views / maxValue) * (256 - padding * 2);
              return `L ${x} ${y}`;
            })
            .join(' ')}
          L ${800 - padding} ${256 - padding}
          Z
        `}
        fill="url(#gradient)"
        opacity="0.3"
      />

      {/* Line */}
      <path
        d={data
          .map((point, index) => {
            const x = padding + (index / (data.length - 1)) * (800 - padding * 2);
            const y = 256 - padding - (point.views / maxValue) * (256 - padding * 2);
            return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
          })
          .join(' ')}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
      />

      {/* Points */}
      {data.map((point, index) => {
        const x = padding + (index / (data.length - 1)) * (800 - padding * 2);
        const y = 256 - padding - (point.views / maxValue) * (256 - padding * 2);
        return (
          <circle key={index} cx={x} cy={y} r="4" fill="#3b82f6" />
        );
      })}

      {/* Gradient definition */}
      <defs>
        <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default AdvancedAnalyticsDashboard;
