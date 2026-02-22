'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  BarChart3,
  LineChart,
  PieChart,
  TrendingUp,
  RefreshCw,
  Sparkles,
  Download,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    fill?: boolean;
  }>;
  chartType?: 'bar' | 'line' | 'pie' | 'doughnut';
}

interface AdvancedChartGeneratorProps {
  projectId?: string;
  onChartGenerated?: (chartData: ChartData) => void;
}

export function AdvancedChartGenerator({ projectId, onChartGenerated }: AdvancedChartGeneratorProps) {
  const [chartTitle, setChartTitle] = useState('');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'doughnut'>('bar');
  const [topic, setTopic] = useState('');
  const [useRealTimeData, setUseRealTimeData] = useState(true);

  const generateChartMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/ai/generate-chart-data', {
        title: chartTitle,
        topic,
        chartType,
        useRealTimeData,
        projectId,
      });
      return response.data;
    },
    onSuccess: (data) => {
      onChartGenerated?.(data as ChartData);
    },
  });

  const handleGenerate = () => {
    if (!chartTitle || !topic) { return; }
    generateChartMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          AI Chart Generator
        </CardTitle>
        <CardDescription>
          Generate data visualizations with real-time data or AI-powered insights
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="chart-title">Chart Title</Label>
            <Input
              id="chart-title"
              placeholder="e.g., Market Growth 2025"
              value={chartTitle}
              onChange={(e) => setChartTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="chart-type">Chart Type</Label>
            <Select value={chartType} onValueChange={(v) => setChartType(v as 'bar' | 'line' | 'pie' | 'doughnut')}>
              <SelectTrigger id="chart-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Bar Chart</SelectItem>
                <SelectItem value="line">Line Chart</SelectItem>
                <SelectItem value="pie">Pie Chart</SelectItem>
                <SelectItem value="doughnut">Doughnut Chart</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="topic">Topic / Data Query</Label>
          <Input
            id="topic"
            placeholder="e.g., SaaS market trends, Tech company revenue"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="realtime"
            checked={useRealTimeData}
            onChange={(e) => setUseRealTimeData(e.target.checked)}
            className="rounded"
          />
          <Label htmlFor="realtime" className="cursor-pointer">
            Use real-time data (when available)
          </Label>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={!chartTitle || !topic || generateChartMutation.isPending}
          className="w-full"
        >
          {generateChartMutation.isPending ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Chart
            </>
          )}
        </Button>

        {generateChartMutation.data ? (
          <div className="mt-4">
            <RenderChart data={generateChartMutation.data as ChartData} type={chartType} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface RealTimeChartProps {
  projectId: string;
  chartType: 'views' | 'engagement' | 'devices';
  refreshInterval?: number;
  className?: string;
}

export function RealTimeChart({
  projectId,
  chartType,
  refreshInterval = 30000,
  className,
}: RealTimeChartProps) {
  const { data, refetch } = useQuery({
    queryKey: ['realtime-chart', projectId, chartType],
    queryFn: async () => {
      if (chartType === 'views') {
        const summary = await api.getAnalyticsSummary(projectId);
        return {
          labels: summary.viewsByDay.map((d) => new Date(d.date).toLocaleDateString()),
          datasets: [
            {
              label: 'Views',
              data: summary.viewsByDay.map((d) => d.views),
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              fill: true,
            },
            {
              label: 'Unique Views',
              data: summary.viewsByDay.map((d) => d.views),
              borderColor: 'rgb(16, 185, 129)',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              fill: true,
            },
          ],
          chartType: 'line' as const,
        };
      } else if (chartType === 'devices') {
        const segments = await api.getAudienceSegments(projectId);
        return {
          labels: Object.keys(segments.devices).map((d) => d.charAt(0).toUpperCase() + d.slice(1)),
          datasets: [
            {
              label: 'Device Distribution',
              data: Object.values(segments.devices),
              backgroundColor: [
                'rgba(59, 130, 246, 0.8)',
                'rgba(16, 185, 129, 0.8)',
                'rgba(245, 158, 11, 0.8)',
              ],
            },
          ],
          chartType: 'doughnut' as const,
        };
      }
      return null;
    },
    refetchInterval: refreshInterval,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, refetch]);

  if (!data) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const getChartIcon = () => {
    const chartData = data as ChartData;
    if (!chartData?.chartType) { return <PieChart className="w-4 h-4" />; }
    if (chartData.chartType === 'line') { return <LineChart className="w-4 h-4" />; }
    if (chartData.chartType === 'bar') { return <BarChart3 className="w-4 h-4" />; }
    if (chartData.chartType === 'doughnut' || chartData.chartType === 'pie') { return <PieChart className="w-4 h-4" />; }
    return <PieChart className="w-4 h-4" />;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getChartIcon()}
            {chartType === 'views'
              ? 'Views Over Time'
              : chartType === 'engagement'
                ? 'Engagement Metrics'
                : 'Device Distribution'}
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-3 h-3" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RenderChart data={data as ChartData} type={(data as ChartData).chartType || 'bar'} />
      </CardContent>
    </Card>
  );
}

interface RenderChartProps {
  data: ChartData;
  type: 'bar' | 'line' | 'pie' | 'doughnut';
}

function RenderChart({ data, type }: RenderChartProps) {
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
  };

  const chartProps = {
    data,
    options: commonOptions,
  };

  return (
    <div className="h-75">
      {type === 'bar' && <Bar {...chartProps} />}
      {type === 'line' && <Line {...chartProps} />}
      {type === 'pie' && <Pie {...chartProps} />}
      {type === 'doughnut' && <Doughnut {...chartProps} />}
    </div>
  );
}

interface AnalyticsChartsGridProps {
  projectId: string;
}

export function AnalyticsChartsGrid({ projectId }: AnalyticsChartsGridProps) {
  const { data: predictive } = useQuery({
    queryKey: ['predictive-chart', projectId],
    queryFn: async () => {
      const data = await api.getPredictiveAnalytics(projectId, 30);
      return {
        labels: data.forecast.map((f) => new Date(f.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        datasets: [
          {
            label: 'Predicted Views',
            data: data.forecast.map((f) => f.predictedViews),
            borderColor: 'rgb(139, 92, 246)',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            borderDash: [5, 5],
            fill: true,
          },
        ],
        chartType: 'line' as const,
      };
    },
  });

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Real-time views chart */}
      <RealTimeChart projectId={projectId} chartType="views" className="lg:col-span-2" />

      {/* Device distribution */}
      <RealTimeChart projectId={projectId} chartType="devices" />

      {/* Predictive forecast */}
      {predictive && (
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              30-Day Forecast
            </CardTitle>
            <CardDescription>AI-powered predictions based on historical data</CardDescription>
          </CardHeader>
          <CardContent>
            <RenderChart data={predictive} type="line" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function DownloadChartButton({ chartData: _chartData, filename }: { chartData: unknown; filename: string }) {
  const handleDownload = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) { return; }

    canvas.toBlob((blob) => {
      if (!blob) { return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDownload}>
      <Download className="w-4 h-4 mr-2" />
      Download Chart
    </Button>
  );
}
