import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataConnectorService, DataPreview } from './data-connector.service';

export type ChartType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'doughnut'
  | 'area'
  | 'scatter'
  | 'radar'
  | 'treemap'
  | 'funnel'
  | 'gauge'
  | 'heatmap'
  | 'sankey'
  | 'waterfall'
  | 'combo';

export interface ChartConfig {
  type: ChartType;
  title?: string;
  subtitle?: string;
  dataMapping: {
    xAxis?: string;
    yAxis?: string | string[];
    series?: string;
    value?: string;
    label?: string;
    size?: string;
    color?: string;
  };
  options?: {
    showLegend?: boolean;
    showLabels?: boolean;
    showGrid?: boolean;
    stacked?: boolean;
    percentage?: boolean;
    animated?: boolean;
    sortOrder?: 'asc' | 'desc' | 'none';
    limit?: number;
    colors?: string[];
    aspectRatio?: number;
  };
  styling?: {
    backgroundColor?: string;
    fontFamily?: string;
    fontSize?: number;
    titleColor?: string;
    gridColor?: string;
  };
}

export interface GeneratedChart {
  id: string;
  config: ChartConfig;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string;
    }>;
  };
  svgCode?: string;
  imageUrl?: string;
}

export interface ChartRecommendation {
  type: ChartType;
  score: number;
  reason: string;
  suggestedConfig: Partial<ChartConfig>;
}

@Injectable()
export class ChartGeneratorService {
  private readonly logger = new Logger(ChartGeneratorService.name);

  private readonly defaultColors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#F97316', // orange
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectorService: DataConnectorService,
  ) {}

  /**
   * Generate chart from data source
   */
  async generateChart(
    connectionId: string,
    config: ChartConfig,
  ): Promise<GeneratedChart> {
    // Fetch data
    const data = await this.connectorService.fetchData(connectionId, {
      limit: config.options?.limit || 100,
    });

    // Transform data to chart format
    const chartData = this.transformToChartData(data, config);

    // Generate unique ID
    const chartId = `chart-${Date.now()}`;

    // Store chart configuration
    await this.prisma.savedChart.create({
      data: {
        id: chartId,
        connectionId,
        config: config as object,
        data: chartData as object,
      },
    });

    return {
      id: chartId,
      config,
      data: chartData,
    };
  }

  /**
   * Generate chart from inline data
   */
  generateChartFromData(
    rawData: DataPreview,
    config: ChartConfig,
  ): GeneratedChart {
    const chartData = this.transformToChartData(rawData, config);

    return {
      id: `inline-${Date.now()}`,
      config,
      data: chartData,
    };
  }

  /**
   * Transform raw data to chart format
   */
  private transformToChartData(
    data: DataPreview,
    config: ChartConfig,
  ): GeneratedChart['data'] {
    const { dataMapping, options } = config;
    const colors = options?.colors || this.defaultColors;

    switch (config.type) {
      case 'pie':
      case 'doughnut':
        return this.transformToPieData(data, dataMapping, colors);
      case 'bar':
      case 'line':
      case 'area':
        return this.transformToAxisData(data, dataMapping, colors, config.type);
      case 'scatter':
        return this.transformToScatterData(data, dataMapping, colors);
      case 'radar':
        return this.transformToRadarData(data, dataMapping, colors);
      default:
        return this.transformToAxisData(data, dataMapping, colors, 'bar');
    }
  }

  private transformToPieData(
    data: DataPreview,
    mapping: ChartConfig['dataMapping'],
    colors: string[],
  ): GeneratedChart['data'] {
    const labelField = mapping.label || data.columns[0]?.name;
    const valueField = mapping.value || data.columns[1]?.name;

    const labels = data.rows.map((row) => String(row[labelField]));
    const values = data.rows.map((row) => Number(row[valueField]) || 0);

    return {
      labels,
      datasets: [
        {
          label: valueField,
          data: values,
          backgroundColor: colors.slice(0, labels.length),
        },
      ],
    };
  }

  private transformToAxisData(
    data: DataPreview,
    mapping: ChartConfig['dataMapping'],
    colors: string[],
    chartType: 'bar' | 'line' | 'area',
  ): GeneratedChart['data'] {
    const xAxisField = mapping.xAxis || data.columns[0]?.name;
    const yAxisFields = Array.isArray(mapping.yAxis)
      ? mapping.yAxis
      : mapping.yAxis
        ? [mapping.yAxis]
        : data.columns.slice(1).map((c) => c.name);

    const labels = data.rows.map((row) => String(row[xAxisField]));

    const datasets = yAxisFields.map((field, index) => ({
      label: field,
      data: data.rows.map((row) => Number(row[field]) || 0),
      backgroundColor:
        chartType === 'line' ? 'transparent' : colors[index % colors.length],
      borderColor: colors[index % colors.length],
    }));

    return { labels, datasets };
  }

  private transformToScatterData(
    data: DataPreview,
    mapping: ChartConfig['dataMapping'],
    colors: string[],
  ): GeneratedChart['data'] {
    const xField = mapping.xAxis || data.columns[0]?.name;
    const yField = mapping.yAxis
      ? Array.isArray(mapping.yAxis)
        ? mapping.yAxis[0]
        : mapping.yAxis
      : data.columns[1]?.name;

    const points = data.rows.map((row) => ({
      x: Number(row[xField]) || 0,
      y: Number(row[yField]) || 0,
    }));

    return {
      labels: [],
      datasets: [
        {
          label: `${xField} vs ${yField}`,
          data: points as any,
          backgroundColor: colors[0],
        },
      ],
    };
  }

  private transformToRadarData(
    data: DataPreview,
    mapping: ChartConfig['dataMapping'],
    colors: string[],
  ): GeneratedChart['data'] {
    const labelField = mapping.label || data.columns[0]?.name;
    const valueFields = data.columns
      .slice(1)
      .filter((c) => c.type === 'number')
      .map((c) => c.name);

    const labels = data.rows.map((row) => String(row[labelField]));

    const datasets = valueFields.map((field, index) => ({
      label: field,
      data: data.rows.map((row) => Number(row[field]) || 0),
      backgroundColor: `${colors[index % colors.length]}33`,
      borderColor: colors[index % colors.length],
    }));

    return { labels, datasets };
  }

  /**
   * Get chart type recommendations based on data
   */
  getChartRecommendations(data: DataPreview): ChartRecommendation[] {
    const recommendations: ChartRecommendation[] = [];

    const numericColumns = data.columns.filter((c) => c.type === 'number');
    const stringColumns = data.columns.filter((c) => c.type === 'string');
    const dateColumns = data.columns.filter((c) => c.type === 'date');
    const rowCount = data.totalRows;

    // Time series data
    if (dateColumns.length > 0 && numericColumns.length > 0) {
      recommendations.push({
        type: 'line',
        score: 0.95,
        reason: 'Time series data is best visualized with line charts',
        suggestedConfig: {
          dataMapping: {
            xAxis: dateColumns[0].name,
            yAxis: numericColumns.map((c) => c.name),
          },
        },
      });

      recommendations.push({
        type: 'area',
        score: 0.85,
        reason: 'Area charts work well for cumulative time series',
        suggestedConfig: {
          dataMapping: {
            xAxis: dateColumns[0].name,
            yAxis: numericColumns.map((c) => c.name),
          },
        },
      });
    }

    // Categorical comparison
    if (stringColumns.length > 0 && numericColumns.length > 0) {
      if (rowCount <= 10) {
        recommendations.push({
          type: 'pie',
          score: 0.9,
          reason:
            'Pie charts are great for showing proportions with few categories',
          suggestedConfig: {
            dataMapping: {
              label: stringColumns[0].name,
              value: numericColumns[0].name,
            },
          },
        });

        recommendations.push({
          type: 'doughnut',
          score: 0.85,
          reason: 'Doughnut charts show proportions with a modern look',
          suggestedConfig: {
            dataMapping: {
              label: stringColumns[0].name,
              value: numericColumns[0].name,
            },
          },
        });
      }

      recommendations.push({
        type: 'bar',
        score: rowCount > 10 ? 0.95 : 0.8,
        reason: 'Bar charts are effective for comparing categories',
        suggestedConfig: {
          dataMapping: {
            xAxis: stringColumns[0].name,
            yAxis: numericColumns.map((c) => c.name),
          },
        },
      });
    }

    // Two numeric columns - scatter
    if (numericColumns.length >= 2) {
      recommendations.push({
        type: 'scatter',
        score: 0.75,
        reason:
          'Scatter plots show relationships between two numeric variables',
        suggestedConfig: {
          dataMapping: {
            xAxis: numericColumns[0].name,
            yAxis: numericColumns[1].name,
          },
        },
      });
    }

    // Multiple metrics with categories - radar
    if (
      stringColumns.length > 0 &&
      numericColumns.length >= 3 &&
      rowCount <= 8
    ) {
      recommendations.push({
        type: 'radar',
        score: 0.7,
        reason: 'Radar charts compare multiple metrics across categories',
        suggestedConfig: {
          dataMapping: {
            label: stringColumns[0].name,
            yAxis: numericColumns.slice(0, 5).map((c) => c.name),
          },
        },
      });
    }

    // Sort by score
    return recommendations.sort((a, b) => b.score - a.score);
  }

  /**
   * Update chart with new data
   */
  async refreshChart(chartId: string): Promise<GeneratedChart | null> {
    const chart = await this.prisma.savedChart.findUnique({
      where: { id: chartId },
    });

    if (!chart) return null;

    const config = chart.config as unknown as ChartConfig;

    // Fetch fresh data
    const data = await this.connectorService.fetchData(chart.connectionId, {
      limit: config.options?.limit || 100,
    });

    // Transform to chart data
    const chartData = this.transformToChartData(data, config);

    // Update stored chart
    await this.prisma.savedChart.update({
      where: { id: chartId },
      data: { data: chartData as object, updatedAt: new Date() },
    });

    return {
      id: chartId,
      config,
      data: chartData,
    };
  }

  /**
   * Get saved charts
   */
  async getSavedCharts(
    userId: string,
  ): Promise<Array<{ id: string; config: ChartConfig; updatedAt: Date }>> {
    const connections = await this.prisma.dataSourceConnection.findMany({
      where: { userId },
      select: { id: true },
    });

    const connectionIds = connections.map((c) => c.id);

    const charts = await this.prisma.savedChart.findMany({
      where: { connectionId: { in: connectionIds } },
      select: { id: true, config: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });

    return charts.map((c) => ({
      id: c.id,
      config: c.config as unknown as ChartConfig,
      updatedAt: c.updatedAt,
    }));
  }

  /**
   * Delete saved chart
   */
  async deleteChart(chartId: string): Promise<void> {
    await this.prisma.savedChart.delete({
      where: { id: chartId },
    });
  }

  /**
   * Export chart as image
   */
  async exportChartAsImage(
    chartId: string,
    format: 'png' | 'svg' | 'pdf',
    options?: { width?: number; height?: number },
  ): Promise<{ imageUrl: string }> {
    // In production, would use a charting library to render and export
    // For now, return placeholder
    return {
      imageUrl: `/api/charts/${chartId}/export.${format}`,
    };
  }

  /**
   * Clone chart with new configuration
   */
  async cloneChart(
    chartId: string,
    newConfig?: Partial<ChartConfig>,
  ): Promise<GeneratedChart | null> {
    const original = await this.prisma.savedChart.findUnique({
      where: { id: chartId },
    });

    if (!original) return null;

    const config = {
      ...(original.config as unknown as ChartConfig),
      ...newConfig,
    };
    const data = original.data as GeneratedChart['data'];

    const cloned = await this.prisma.savedChart.create({
      data: {
        id: `chart-${Date.now()}`,
        connectionId: original.connectionId,
        config: config as object,
        data: data as object,
      },
    });

    return {
      id: cloned.id,
      config,
      data,
    };
  }
}
