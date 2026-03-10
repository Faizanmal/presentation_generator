'use client';
/* eslint-disable react-hooks/set-state-in-effect */

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

  // Sync internal state if external data prop changes (e.g. real AI data loaded)
  useEffect(() => {
    if (!data) { return; }
    setChartType(data.type || 'bar');
    setChartData(data.data || DEFAULT_DATA);
    setTitle(data.title || '');
    setShowLegend(data.showLegend ?? true);
    setShowGrid(data.showGrid ?? true);
  }, [data]);

  const drawBarChart = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    padding: number,
  ) => {
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2 - (showLegend ? 30 : 0);
    const barWidth = Math.min((chartWidth / chartData.length) * 0.5, 40); // Max width, proportional
    const maxValue = Math.max(...chartData.map((d) => d.value), 1) * 1.15; // 15% headroom

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#f1f5f9'; // Very subtle slate-100
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]); // Dashed grid
      for (let i = 0; i <= 4; i++) {
        const y = padding + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
      }
      ctx.setLineDash([]); // Reset
    }

    // Draw bars
    chartData.forEach((point, index) => {
      const barHeight = (point.value / maxValue) * chartHeight;
      const xOffset = padding + index * (chartWidth / chartData.length) + (chartWidth / chartData.length - barWidth) / 2;
      const x = xOffset;
      const y = padding + chartHeight - barHeight;

      const baseColor = point.color || COLORS[index % COLORS.length];

      // Gradient fill
      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      gradient.addColorStop(0, baseColor);
      gradient.addColorStop(1, `${baseColor}99`); // Adding alpha to the bottom

      ctx.fillStyle = gradient;

      // Rounded top corners
      const radius = Math.min(6, barWidth / 2);
      ctx.beginPath();
      ctx.moveTo(x, y + barHeight);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, y + barHeight);
      ctx.closePath();

      // Add shadow for depth
      ctx.shadowColor = `${baseColor}40`;
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      ctx.fill();

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Value label on top
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(point.value.toString(), x + barWidth / 2, y - 8);

      // Axis label
      ctx.fillStyle = '#64748b';
      ctx.font = '500 12px Inter, system-ui, sans-serif';
      ctx.fillText(point.label, x + barWidth / 2, padding + chartHeight + 20);
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
    const maxValue = Math.max(...chartData.map((d) => d.value), 1) * 1.15;

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (let i = 0; i <= 4; i++) {
        const y = padding + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    const lineColor = chartData[0]?.color || COLORS[0];
    const points = chartData.map((point, index) => {
      const x = padding + (index / Math.max(chartData.length - 1, 1)) * chartWidth;
      const y = padding + chartHeight - (point.value / maxValue) * chartHeight;
      return { x, y };
    });

    if (points.length > 0) {
      // Draw smooth line
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Shadow for glow effect
      ctx.shadowColor = `${lineColor}66`;
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 6;

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      // Bezier curve tension
      for (let i = 0; i < points.length - 1; i++) {
        const cpX = (points[i].x + points[i + 1].x) / 2;
        ctx.bezierCurveTo(cpX, points[i].y, cpX, points[i + 1].y, points[i + 1].x, points[i + 1].y);
      }
      ctx.stroke();

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Draw points
      points.forEach((p, index) => {
        const pointColor = chartData[index].color || lineColor;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = pointColor;
        ctx.lineWidth = 3;

        // Subtle drop shadow for points
        ctx.shadowColor = `${pointColor}40`;
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Value label
        ctx.fillStyle = '#475569';
        ctx.font = 'bold 12px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(chartData[index].value.toString(), p.x, p.y - 12);

        // Axis label
        ctx.fillStyle = '#64748b';
        ctx.font = '500 12px Inter, system-ui, sans-serif';
        ctx.fillText(chartData[index].label, p.x, padding + chartHeight + 20);
      });
    }
  }, [chartData, showGrid, showLegend]);

  const drawPieChart = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => {
    const centerX = width / 2;
    const centerY = (height - (showLegend ? 30 : 0)) / 2 + 10;
    const radius = Math.min(centerX, centerY) - 30;
    const total = chartData.reduce((sum, d) => sum + d.value, 0);

    let startAngle = -Math.PI / 2;
    // Add gap to separate slices nicely
    const gap = chartData.length > 1 ? 0.04 : 0;

    chartData.forEach((point, index) => {
      const sliceAngle = (point.value / total) * Math.PI * 2;
      const midAngle = startAngle + sliceAngle / 2;

      // Shift slightly outwards for animation/depth feel
      const shift = 2;
      const shiftX = Math.cos(midAngle) * shift;
      const shiftY = Math.sin(midAngle) * shift;

      ctx.beginPath();
      ctx.moveTo(centerX + shiftX, centerY + shiftY);
      ctx.arc(centerX + shiftX, centerY + shiftY, radius, startAngle + gap / 2, startAngle + sliceAngle - gap / 2);
      ctx.closePath();

      const color = point.color || COLORS[index % COLORS.length];

      // Beautiful radial gradient
      const grad = ctx.createRadialGradient(centerX, centerY, radius * 0.4, centerX, centerY, radius);
      grad.addColorStop(0, `${color}dd`);
      grad.addColorStop(1, color);

      ctx.fillStyle = grad;

      // Drop shadow
      ctx.shadowColor = 'rgba(0,0,0,0.1)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.fill();

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Draw label pointer line
      const lineRadius = radius * 0.8;
      const endRadius = radius + 20;
      const startX = centerX + Math.cos(midAngle) * lineRadius;
      const startY = centerY + Math.sin(midAngle) * lineRadius;
      const endX = centerX + Math.cos(midAngle) * endRadius;
      const endY = centerY + Math.sin(midAngle) * endRadius;

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Draw text label
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.textAlign = Math.cos(midAngle) > 0 ? 'left' : 'right';
      const labelX = endX + (Math.cos(midAngle) > 0 ? 5 : -5);

      const percentage = total > 0 ? Math.round((point.value / total) * 100) : 0;
      ctx.fillText(`${point.label} (${percentage}%)`, labelX, endY + 4);

      startAngle += sliceAngle;
    });

    // Create a Doughnut hole in the center
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Subtle inner shadow ring
    ctx.strokeStyle = 'rgba(0,0,0,0.03)';
    ctx.lineWidth = 4;
    ctx.stroke();
  }, [chartData, showLegend]);

  const drawAreaChart = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    padding: number,
  ) => {
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2 - (showLegend ? 30 : 0);
    const maxValue = Math.max(...chartData.map((d) => d.value), 1) * 1.15;

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (let i = 0; i <= 4; i++) {
        const y = padding + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    const points = chartData.map((point, index) => {
      const x = padding + (index / Math.max(chartData.length - 1, 1)) * chartWidth;
      const y = padding + chartHeight - (point.value / maxValue) * chartHeight;
      return { x, y };
    });

    if (points.length === 0) { return; }

    const baseColor = chartData[0]?.color || COLORS[0];

    // Gorgeous fade gradient for area fill
    const fillGradient = ctx.createLinearGradient(0, padding, 0, padding + chartHeight);
    fillGradient.addColorStop(0, `${baseColor}60`); // Semi-transparent top
    fillGradient.addColorStop(1, `${baseColor}05`); // Almost invisible bottom

    ctx.fillStyle = fillGradient;
    ctx.beginPath();
    ctx.moveTo(points[0].x, padding + chartHeight); // Bottom left
    ctx.lineTo(points[0].x, points[0].y); // Top left

    // Smooth bezier interior
    for (let i = 0; i < points.length - 1; i++) {
      const cpX = (points[i].x + points[i + 1].x) / 2;
      ctx.bezierCurveTo(cpX, points[i].y, cpX, points[i + 1].y, points[i + 1].x, points[i + 1].y);
    }

    ctx.lineTo(points[points.length - 1].x, padding + chartHeight); // Line down to bottom right
    ctx.closePath();
    ctx.fill();

    // Draw vibrant top border line
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.shadowColor = `${baseColor}66`;
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const cpX = (points[i].x + points[i + 1].x) / 2;
      ctx.bezierCurveTo(cpX, points[i].y, cpX, points[i + 1].y, points[i + 1].x, points[i + 1].y);
    }
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Draw little points and labels
    points.forEach((p, index) => {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '500 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(chartData[index].label, p.x, padding + chartHeight + 20);
    });
  }, [chartData, showGrid, showLegend]);

  const drawLegend = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => {
    const legendY = height - 12;

    // Center legend logic
    ctx.font = '500 12px Inter, system-ui, sans-serif';
    let totalWidth = 0;
    chartData.forEach(p => {
      totalWidth += 22 + ctx.measureText(p.label).width + 16;
    });

    let legendX = (width - totalWidth) / 2;

    chartData.forEach((point, index) => {
      const color = point.color || COLORS[index % COLORS.length];

      // Cute rounded rectangle trick via line joins
      ctx.lineJoin = 'round';
      ctx.lineWidth = 8;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.strokeRect(legendX + 4, legendY - 6, 2, 2);
      ctx.fillRect(legendX + 4, legendY - 6, 2, 2);

      // Label
      ctx.fillStyle = '#475569';
      ctx.font = '500 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(point.label, legendX + 16, legendY + 2);

      legendX += 22 + ctx.measureText(point.label).width + 16;
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
    <div className={cn('relative rounded-xl border border-slate-200/60 bg-white/70 backdrop-blur-md p-5 shadow-sm transition-all duration-300 hover:shadow-md dark:bg-slate-900/60 dark:border-slate-700/60 w-full h-full min-h-75', className)}>
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
