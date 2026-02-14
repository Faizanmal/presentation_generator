'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  BarChart3,
  LineChartIcon,
  PieChartIcon,
  TrendingUp,
  Table,
  Sparkles,
  Copy,
  Plus,
  Trash2,
  Edit2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
// import { Slider } from '@/components/ui/slider';
// import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'radar' | 'donut' | 'stacked-bar' | 'horizontal-bar';

interface DataPoint {
  label: string;
  value: number;
  [key: string]: string | number;
}

interface ChartConfig {
  type: ChartType;
  title: string;
  data: DataPoint[];
  colors: string[];
  showLegend: boolean;
  showGrid: boolean;
  showLabels: boolean;
  animate: boolean;
  aspectRatio: '16:9' | '4:3' | '1:1' | 'custom';
}

const CHART_TYPES: { value: ChartType; label: string; icon: React.ReactNode }[] = [
  { value: 'bar', label: 'Bar Chart', icon: <BarChart3 className="h-4 w-4" /> },
  { value: 'line', label: 'Line Chart', icon: <LineChartIcon className="h-4 w-4" /> },
  { value: 'pie', label: 'Pie Chart', icon: <PieChartIcon className="h-4 w-4" /> },
  { value: 'donut', label: 'Donut Chart', icon: <PieChartIcon className="h-4 w-4" /> },
  { value: 'area', label: 'Area Chart', icon: <TrendingUp className="h-4 w-4" /> },
  { value: 'radar', label: 'Radar Chart', icon: <TrendingUp className="h-4 w-4" /> },
  { value: 'stacked-bar', label: 'Stacked Bar', icon: <BarChart3 className="h-4 w-4" /> },
  { value: 'horizontal-bar', label: 'Horizontal Bar', icon: <BarChart3 className="h-4 w-4" /> },
];

const COLOR_PALETTES = {
  default: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'],
  pastel: ['#93C5FD', '#6EE7B7', '#FCD34D', '#FCA5A5', '#C4B5FD', '#F9A8D4'],
  dark: ['#1E40AF', '#047857', '#B45309', '#B91C1C', '#6D28D9', '#BE185D'],
  monochrome: ['#1F2937', '#374151', '#4B5563', '#6B7280', '#9CA3AF', '#D1D5DB'],
  rainbow: ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6'],
};

interface SmartChartBuilderProps {
  onInsertChart: (config: ChartConfig) => void;
}

export function SmartChartBuilder({ onInsertChart }: SmartChartBuilderProps) {
  const [config, setConfig] = useState<ChartConfig>({
    type: 'bar',
    title: '',
    data: [
      { label: 'Jan', value: 100 },
      { label: 'Feb', value: 150 },
      { label: 'Mar', value: 120 },
      { label: 'Apr', value: 180 },
    ],
    colors: COLOR_PALETTES.default,
    showLegend: true,
    showGrid: true,
    showLabels: true,
    animate: true,
    aspectRatio: '16:9',
  });

  const [dataInput, setDataInput] = useState('');
  const [editingData, setEditingData] = useState(false);

  const generateChartMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const response = await fetch('/api/ai/generate-chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.chartConfig) {
        setConfig(data.chartConfig);
      }
    },
  });

  const suggestVisualizationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/ai/suggest-visualization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: config.data }),
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.suggestedType) {
        setConfig({ ...config, type: data.suggestedType });
      }
    },
  });

  const parseDataInput = useCallback((input: string) => {
    try {
      // Try JSON first
      const json = JSON.parse(input);
      if (Array.isArray(json)) {
        setConfig({ ...config, data: json });
        return;
      }
    } catch {
      // Try CSV format
      const lines = input.trim().split('\n');
      if (lines.length > 0) {
        const data = lines.map((line) => {
          const parts = line.split(/[,\t]/);
          return {
            label: parts[0]?.trim() || '',
            value: parseFloat(parts[1]) || 0,
          };
        });
        setConfig({ ...config, data });
      }
    }
  }, [config]);

  const addDataPoint = () => {
    setConfig({
      ...config,
      data: [...config.data, { label: `Item ${config.data.length + 1}`, value: 0 }],
    });
  };

  const updateDataPoint = (index: number, field: keyof DataPoint, value: string | number) => {
    const newData = [...config.data];
    newData[index] = { ...newData[index], [field]: value };
    setConfig({ ...config, data: newData });
  };

  const removeDataPoint = (index: number) => {
    setConfig({
      ...config,
      data: config.data.filter((_, i) => i !== index),
    });
  };

  const renderChart = useMemo(() => {
    const { type, data, colors, showLegend, showGrid } = config;

    const commonProps = {
      data,
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
    };

    switch (type) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            {showLegend && <Legend />}
            <Bar dataKey="value" fill={colors[0]}>
              {data.map((item, _index) => (

                <Cell key={item.label} fill={colors[_index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        );

      case 'horizontal-bar':
        return (
          <BarChart {...commonProps} layout="vertical">
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis type="number" />
            <YAxis dataKey="label" type="category" width={80} />
            <Tooltip />
            {showLegend && <Legend />}
            <Bar dataKey="value" fill={colors[0]}>
              {data.map((item, _index) => (

                <Cell key={item.label} fill={colors[_index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        );

      case 'line':
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            {showLegend && <Legend />}
            <Line
              type="monotone"
              dataKey="value"
              stroke={colors[0]}
              strokeWidth={2}
              dot={{ fill: colors[0] }}
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            {showLegend && <Legend />}
            <Area
              type="monotone"
              dataKey="value"
              stroke={colors[0]}
              fill={colors[0]}
              fillOpacity={0.3}
            />
          </AreaChart>
        );

      case 'pie':
      case 'donut':
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={type === 'donut' ? 60 : 0}
              outerRadius={100}
              dataKey="value"
              nameKey="label"
              label={({ payload, percent }: { payload?: { label: string }; percent?: number }) => `${payload?.label || 'Unknown'}: ${((percent || 0) * 100).toFixed(0)}%`}
            >
              {data.map((item, _index) => (

                <Cell key={item.label} fill={colors[_index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            {showLegend && <Legend />}
          </PieChart>
        );

      case 'radar':
        return (
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="label" />
            <PolarRadiusAxis />
            <Radar
              dataKey="value"
              stroke={colors[0]}
              fill={colors[0]}
              fillOpacity={0.5}
            />
            <Tooltip />
          </RadarChart>
        );

      default:
        return <BarChart {...commonProps}><Bar dataKey="value" fill={colors[0]} /></BarChart>;
    }
  }, [config]);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="design">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="style">Style</TabsTrigger>
        </TabsList>

        <TabsContent value="design" className="space-y-4">
          {/* Chart Title */}
          <div>
            <Label>Chart Title</Label>
            <Input
              value={config.title}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              placeholder="Enter chart title..."
            />
          </div>

          {/* Chart Type Selection */}
          <div>
            <Label>Chart Type</Label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {CHART_TYPES.map((chartType) => (
                <Button
                  key={chartType.value}
                  variant={config.type === chartType.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setConfig({ ...config, type: chartType.value })}
                  className="flex flex-col items-center gap-1 h-auto py-3"
                >
                  {chartType.icon}
                  <span className="text-xs">{chartType.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* AI Suggest Button */}
          <Button
            variant="outline"
            onClick={() => suggestVisualizationMutation.mutate()}
            disabled={suggestVisualizationMutation.isPending}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Suggest Best Visualization
          </Button>

          {/* Chart Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video">
                <ResponsiveContainer width="100%" height="100%">
                  {renderChart}
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          {/* Data Input Options */}
          <div className="flex gap-2">
            <Button
              variant={!editingData ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEditingData(false)}
            >
              <Table className="mr-2 h-4 w-4" />
              Table Editor
            </Button>
            <Button
              variant={editingData ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEditingData(true)}
            >
              <Edit2 className="mr-2 h-4 w-4" />
              Paste Data
            </Button>
          </div>

          {editingData ? (
            <div className="space-y-2">
              <Label>Paste CSV or JSON data</Label>
              <Textarea
                value={dataInput}
                onChange={(e) => setDataInput(e.target.value)}
                placeholder="label,value&#10;Jan,100&#10;Feb,150&#10;Mar,120"
                className="font-mono"
                rows={8}
              />
              <Button onClick={() => parseDataInput(dataInput)}>
                Apply Data
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Data Points</Label>
                <Button variant="outline" size="sm" onClick={addDataPoint}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
              <ScrollArea className="h-64">
                <div className="space-y-2 pr-4">
                  {config.data.map((point, _index) => (

                    <div key={point.label} className="flex items-center gap-2">
                      <div
                        className="h-4 w-4 rounded"
                        style={{
                          backgroundColor: config.colors[_index % config.colors.length],
                        }}
                      />
                      <Input
                        value={point.label}
                        onChange={(e) => updateDataPoint(_index, 'label', e.target.value)}
                        placeholder="Label"
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={point.value}
                        onChange={(e) =>
                          updateDataPoint(_index, 'value', parseFloat(e.target.value) || 0)
                        }
                        placeholder="Value"
                        className="w-24"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDataPoint(_index)}
                        disabled={config.data.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* AI Generate from Description */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4" />
                Generate with AI
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                placeholder="Describe the chart you want, e.g., 'Create a bar chart showing quarterly sales with Q1: 100k, Q2: 150k, Q3: 180k, Q4: 200k'"
                onChange={(e) => setDataInput(e.target.value)}
              />
              <Button
                onClick={() => generateChartMutation.mutate(dataInput)}
                disabled={generateChartMutation.isPending}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Chart
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="style" className="space-y-4">
          {/* Color Palette */}
          <div>
            <Label>Color Palette</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(COLOR_PALETTES).map(([name, palette]) => (
                <button
                  key={name}
                  onClick={() => setConfig({ ...config, colors: palette })}
                  className={cn(
                    'flex gap-0.5 rounded-lg border p-2 transition-all',
                    JSON.stringify(config.colors) === JSON.stringify(palette) &&
                    'ring-2 ring-primary'
                  )}
                >
                  {palette.slice(0, 5).map((color, _i) => (
                    <div
                      key={color}
                      className="h-6 w-3 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </button>
              ))}
            </div>
          </div>

          {/* Display Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Show Legend</Label>
              <Switch
                checked={config.showLegend}
                onCheckedChange={(v) => setConfig({ ...config, showLegend: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show Grid</Label>
              <Switch
                checked={config.showGrid}
                onCheckedChange={(v) => setConfig({ ...config, showGrid: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show Labels</Label>
              <Switch
                checked={config.showLabels}
                onCheckedChange={(v) => setConfig({ ...config, showLabels: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Animate</Label>
              <Switch
                checked={config.animate}
                onCheckedChange={(v) => setConfig({ ...config, animate: v })}
              />
            </div>
          </div>

          {/* Aspect Ratio */}
          <div>
            <Label>Aspect Ratio</Label>
            <Select
              value={config.aspectRatio}
              onValueChange={(v: ChartConfig['aspectRatio']) => setConfig({ ...config, aspectRatio: v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
                <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                <SelectItem value="1:1">1:1 (Square)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() =>
            navigator.clipboard.writeText(JSON.stringify(config, null, 2))
          }
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy Config
        </Button>
        <Button onClick={() => onInsertChart(config)}>
          Insert Chart
        </Button>
      </div>
    </div>
  );
}

// Standalone chart component for rendering in slides
export function SlideChart({ config }: { config: ChartConfig }) {
  const { type, title, data, colors, showLegend, showGrid } = config;

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
    };

    switch (type) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            {showLegend && <Legend />}
            <Bar dataKey="value">
              {data.map((_item, index) => (

                <Cell key={_item.label} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        );
      case 'line':
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            {showLegend && <Legend />}
            <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={2} />
          </LineChart>
        );
      case 'pie':
      case 'donut':
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={type === 'donut' ? 60 : 0}
              outerRadius={100}
              dataKey="value"
              nameKey="label"
              label
            >
              {data.map((item, _index) => (

                <Cell key={item.label} fill={colors[_index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            {showLegend && <Legend />}
          </PieChart>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full w-full">
      {title && <h3 className="mb-4 text-center text-lg font-semibold">{title}</h3>}
      <ResponsiveContainer width="100%" height="100%">
        {renderChart() || <div />}
      </ResponsiveContainer>
    </div>
  );
}
