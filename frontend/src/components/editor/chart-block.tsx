'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  BarChart3,
  LineChart,
  PieChart,
  AreaChart,
  Settings,
  Plus,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// Chart types
type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'doughnut' | 'radar' | 'polarArea';

interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

interface ChartBlockProps {
  data?: {
    type: ChartType;
    title?: string;
    data: ChartDataPoint[];
    showLegend?: boolean;
    showGrid?: boolean;
  };
  onChange?: (data: ChartBlockProps['data']) => void;
  isEditable?: boolean;
  className?: string;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

const DEFAULT_DATA: ChartDataPoint[] = [
  { label: 'Q1', value: 120, color: COLORS[0] },
  { label: 'Q2', value: 180, color: COLORS[1] },
  { label: 'Q3', value: 150, color: COLORS[2] },
  { label: 'Q4', value: 220, color: COLORS[3] },
];

export function ChartBlock({
  data = { type: 'bar', data: DEFAULT_DATA, showLegend: true, showGrid: true },
  onChange,
  isEditable = true,
  className,
}: ChartBlockProps) {
  const [chartType, setChartType] = useState<ChartType>(data.type || 'bar');
  const [chartData, setChartData] = useState<ChartDataPoint[]>(data.data || DEFAULT_DATA);
  const [title, setTitle] = useState(data.title || '');
  const [showLegend, setShowLegend] = useState(data.showLegend ?? true);
  const [showGrid, setShowGrid] = useState(data.showGrid ?? true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawBarChart = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    padding: number,
  ) => {
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2 - (showLegend ? 30 : 0);
    const barWidth = chartWidth / chartData.length - 20;
    const maxValue = Math.max(...chartData.map((d) => d.value));

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = padding + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
      }
    }

    // Draw bars
    chartData.forEach((point, index) => {
      const barHeight = (point.value / maxValue) * chartHeight;
      const x = padding + index * (chartWidth / chartData.length) + 10;
      const y = padding + chartHeight - barHeight;

      ctx.fillStyle = point.color || COLORS[index % COLORS.length];
      ctx.fillRect(x, y, barWidth, barHeight);

      // Draw label
      ctx.fillStyle = '#64748b';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(point.label, x + barWidth / 2, height - padding + 15);
    });
  }, [chartData, showGrid, showLegend]);

  const drawLineChart = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    padding: number,
  ) => {
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2 - (showLegend ? 30 : 0);
    const maxValue = Math.max(...chartData.map((d) => d.value));

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = padding + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
      }
    }

    // Draw line
    ctx.strokeStyle = COLORS[0];
    ctx.lineWidth = 3;
    ctx.beginPath();

    chartData.forEach((point, index) => {
      const x = padding + (index / (chartData.length - 1)) * chartWidth;
      const y = padding + chartHeight - (point.value / maxValue) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    chartData.forEach((point, index) => {
      const x = padding + (index / (chartData.length - 1)) * chartWidth;
      const y = padding + chartHeight - (point.value / maxValue) * chartHeight;

      ctx.fillStyle = point.color || COLORS[0];
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Draw label
      ctx.fillStyle = '#64748b';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(point.label, x, height - padding + 15);
    });
  }, [chartData, showGrid, showLegend]);

  const drawPieChart = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => {
    const centerX = width / 2;
    const centerY = (height - (showLegend ? 30 : 0)) / 2;
    const radius = Math.min(centerX, centerY) - 40;
    const total = chartData.reduce((sum, d) => sum + d.value, 0);

    let startAngle = -Math.PI / 2;

    chartData.forEach((point, index) => {
      const sliceAngle = (point.value / total) * Math.PI * 2;

      ctx.fillStyle = point.color || COLORS[index % COLORS.length];
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();

      // Add slice border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      startAngle += sliceAngle;
    });
  }, [chartData, showLegend]);

  const drawAreaChart = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    padding: number,
  ) => {
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2 - (showLegend ? 30 : 0);
    const maxValue = Math.max(...chartData.map((d) => d.value));

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = padding + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
      }
    }

    // Draw filled area
    ctx.fillStyle = `${COLORS[0]}40`; // Add transparency
    ctx.beginPath();
    ctx.moveTo(padding, padding + chartHeight);

    chartData.forEach((point, index) => {
      const x = padding + (index / (chartData.length - 1)) * chartWidth;
      const y = padding + chartHeight - (point.value / maxValue) * chartHeight;
      ctx.lineTo(x, y);
    });

    ctx.lineTo(padding + chartWidth, padding + chartHeight);
    ctx.closePath();
    ctx.fill();

    // Draw line on top
    ctx.strokeStyle = COLORS[0];
    ctx.lineWidth = 2;
    ctx.beginPath();

    chartData.forEach((point, index) => {
      const x = padding + (index / (chartData.length - 1)) * chartWidth;
      const y = padding + chartHeight - (point.value / maxValue) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw labels
    chartData.forEach((point, index) => {
      const x = padding + (index / (chartData.length - 1)) * chartWidth;
      ctx.fillStyle = '#64748b';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(point.label, x, height - padding + 15);
    });
  }, [chartData, showGrid, showLegend]);

  const drawLegend = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => {
    const legendY = height - 20;
    let legendX = 20;

    chartData.forEach((point, index) => {
      // Color box
      ctx.fillStyle = point.color || COLORS[index % COLORS.length];
      ctx.fillRect(legendX, legendY - 8, 12, 12);

      // Label
      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(point.label, legendX + 16, legendY + 2);

      legendX += ctx.measureText(point.label).width + 36;
    });
  }, [chartData]);

  // Draw chart on canvas
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) { return; }

    const ctx = canvas.getContext('2d');
    if (!ctx) { return; }

    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw based on chart type
    switch (chartType) {
      case 'bar':
        drawBarChart(ctx, width, height, padding);
        break;
      case 'line':
        drawLineChart(ctx, width, height, padding);
        break;
      case 'pie':
        drawPieChart(ctx, width, height);
        break;
      case 'area':
        drawAreaChart(ctx, width, height, padding);
        break;
    }

    // Draw legend
    if (showLegend) {
      drawLegend(ctx, width, height);
    }
  }, [chartType, showLegend, drawBarChart, drawLineChart, drawPieChart, drawAreaChart, drawLegend]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  const handleDataChange = (index: number, field: 'label' | 'value', value: string) => {
    const newData = [...chartData];
    if (field === 'value') {
      newData[index] = { ...newData[index], [field]: parseFloat(value) || 0 };
    } else {
      newData[index] = { ...newData[index], [field]: value };
    }
    setChartData(newData);
    onChange?.({ type: chartType, data: newData, title, showLegend, showGrid });
  };

  const addDataPoint = () => {
    const newData = [
      ...chartData,
      { label: `Item ${chartData.length + 1}`, value: 100, color: COLORS[chartData.length % COLORS.length] },
    ];
    setChartData(newData);
    onChange?.({ type: chartType, data: newData, title, showLegend, showGrid });
  };

  const removeDataPoint = (index: number) => {
    const newData = chartData.filter((_, i) => i !== index);
    setChartData(newData);
    onChange?.({ type: chartType, data: newData, title, showLegend, showGrid });
  };

  const handleTypeChange = (newType: ChartType) => {
    setChartType(newType);
    onChange?.({ type: newType, data: chartData, title, showLegend, showGrid });
  };

  return (
    <div className={cn('relative rounded-lg border bg-white p-4', className)}>
      {/* Title */}
      {title && (
        <h3 className="text-center text-lg font-semibold text-slate-800 mb-2">
          {title}
        </h3>
      )}

      {/* Chart Canvas */}
      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        className="w-full h-auto"
      />

      {/* Settings Popover (only in edit mode) */}
      {isEditable && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div>
                <Label>Chart Title</Label>
                <Input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    onChange?.({ type: chartType, data: chartData, title: e.target.value, showLegend, showGrid });
                  }}
                  placeholder="Enter chart title"
                />
              </div>

              <div>
                <Label>Chart Type</Label>
                <div className="flex gap-2 mt-1">
                  {[
                    { type: 'bar' as const, icon: BarChart3, label: 'Bar' },
                    { type: 'line' as const, icon: LineChart, label: 'Line' },
                    { type: 'pie' as const, icon: PieChart, label: 'Pie' },
                    { type: 'area' as const, icon: AreaChart, label: 'Area' },
                  ].map(({ type, icon: Icon, label }) => (
                    <Button
                      key={type}
                      variant={chartType === type ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleTypeChange(type)}
                      title={label}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Data Points</Label>
                  <Button variant="ghost" size="sm" onClick={addDataPoint}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {chartData.map((point, index) => (

                    <div key={`${point.label}-${point.value}`} className="flex items-center gap-2">
                      <Input
                        value={point.label}
                        onChange={(e) => handleDataChange(index, 'label', e.target.value)}
                        className="flex-1"
                        placeholder="Label"
                      />
                      <Input
                        type="number"
                        value={point.value}
                        onChange={(e) => handleDataChange(index, 'value', e.target.value)}
                        className="w-20"
                        placeholder="Value"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDataPoint(index)}
                        disabled={chartData.length <= 2}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Show Legend</Label>
                <input
                  type="checkbox"
                  checked={showLegend}
                  onChange={(e) => {
                    setShowLegend(e.target.checked);
                    onChange?.({ type: chartType, data: chartData, title, showLegend: e.target.checked, showGrid });
                  }}
                  className="h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Show Grid</Label>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => {
                    setShowGrid(e.target.checked);
                    onChange?.({ type: chartType, data: chartData, title, showLegend, showGrid: e.target.checked });
                  }}
                  className="h-4 w-4"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={drawChart}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Chart
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export default ChartBlock;
