import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DataConnectorService,
  DataSourceType,
  DataPreview,
} from './data-connector.service';
import {
  ChartGeneratorService,
  ChartType,
  ChartRecommendation,
} from './chart-generator.service';

export interface DataWidget {
  id: string;
  presentationId?: string;
  slideId?: string;
  blockId?: string;
  connectionId?: string;
  chartId?: string;
  type: 'chart' | 'table' | 'metric' | 'comparison';
  config: object;
  refreshEnabled: boolean;
  refreshInterval?: number;
  lastRefreshed?: Date;
}

export interface MetricWidget {
  label: string;
  value: number;
  previousValue?: number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  format?: 'number' | 'currency' | 'percentage';
  prefix?: string;
  suffix?: string;
}

export interface TableWidget {
  columns: Array<{
    key: string;
    label: string;
    width?: number;
    sortable?: boolean;
  }>;
  rows: Array<Record<string, unknown>>;
  pagination?: { page: number; pageSize: number; total: number };
  sortable?: boolean;
  searchable?: boolean;
}

@Injectable()
export class DataVisualizationService {
  private readonly logger = new Logger(DataVisualizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectorService: DataConnectorService,
    private readonly chartService: ChartGeneratorService,
  ) {}

  /**
   * Create a data widget for a presentation
   */
  async createWidget(
    userId: string,
    widget: {
      presentationId?: string;
      slideId?: string;
      type: DataWidget['type'];
      connectionId?: string;
      config: object;
      refreshEnabled?: boolean;
      refreshInterval?: number;
    },
  ): Promise<DataWidget> {
    const created = await this.prisma.dataWidget.create({
      data: {
        userId,
        presentationId: widget.presentationId,
        slideId: widget.slideId,
        type: widget.type,
        connectionId: widget.connectionId,
        config: widget.config,
        refreshEnabled: widget.refreshEnabled ?? false,
        refreshInterval: widget.refreshInterval,
      },
    });

    return {
      id: created.id,
      presentationId: created.presentationId || undefined,
      slideId: created.slideId || undefined,
      connectionId: created.connectionId || undefined,
      type: created.type as DataWidget['type'],
      config: created.config as object,
      refreshEnabled: created.refreshEnabled,
      refreshInterval: created.refreshInterval || undefined,
      lastRefreshed: created.lastRefreshed || undefined,
    };
  }

  /**
   * Get widgets for a presentation
   */
  async getWidgetsForPresentation(
    presentationId: string,
  ): Promise<DataWidget[]> {
    const widgets = await this.prisma.dataWidget.findMany({
      where: { presentationId },
    });

    return widgets.map((w) => ({
      id: w.id,
      presentationId: w.presentationId || undefined,
      slideId: w.slideId || undefined,
      connectionId: w.connectionId || undefined,
      chartId: w.chartId || undefined,
      type: w.type as DataWidget['type'],
      config: w.config as object,
      refreshEnabled: w.refreshEnabled,
      refreshInterval: w.refreshInterval || undefined,
      lastRefreshed: w.lastRefreshed || undefined,
    }));
  }

  /**
   * Update widget
   */
  async updateWidget(
    widgetId: string,
    updates: Partial<{
      config: object;
      refreshEnabled: boolean;
      refreshInterval: number;
    }>,
  ): Promise<DataWidget> {
    const updated = await this.prisma.dataWidget.update({
      where: { id: widgetId },
      data: updates,
    });

    return {
      id: updated.id,
      presentationId: updated.presentationId || undefined,
      slideId: updated.slideId || undefined,
      connectionId: updated.connectionId || undefined,
      chartId: updated.chartId || undefined,
      type: updated.type as DataWidget['type'],
      config: updated.config as object,
      refreshEnabled: updated.refreshEnabled,
      refreshInterval: updated.refreshInterval || undefined,
      lastRefreshed: updated.lastRefreshed || undefined,
    };
  }

  /**
   * Delete widget
   */
  async deleteWidget(widgetId: string): Promise<void> {
    await this.prisma.dataWidget.delete({
      where: { id: widgetId },
    });
  }

  /**
   * Refresh widget data
   */
  async refreshWidget(
    widgetId: string,
  ): Promise<DataWidget & { data: object }> {
    const widget = await this.prisma.dataWidget.findUnique({
      where: { id: widgetId },
    });

    if (!widget || !widget.connectionId) {
      throw new Error('Widget not found or no data source connected');
    }

    // Fetch fresh data
    const data = await this.connectorService.fetchData(widget.connectionId);

    // Update last refreshed
    await this.prisma.dataWidget.update({
      where: { id: widgetId },
      data: { lastRefreshed: new Date() },
    });

    return {
      id: widget.id,
      presentationId: widget.presentationId || undefined,
      slideId: widget.slideId || undefined,
      connectionId: widget.connectionId || undefined,
      chartId: widget.chartId || undefined,
      type: widget.type as DataWidget['type'],
      config: widget.config as object,
      refreshEnabled: widget.refreshEnabled,
      refreshInterval: widget.refreshInterval || undefined,
      lastRefreshed: new Date(),
      data,
    };
  }

  /**
   * Create metric widget from data
   */
  createMetricWidget(
    data: DataPreview,
    config: {
      valueColumn: string;
      label?: string;
      format?: 'number' | 'currency' | 'percentage';
      aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'last';
      compareColumn?: string;
      prefix?: string;
      suffix?: string;
    },
  ): MetricWidget {
    const values = data.rows.map((r) => Number(r[config.valueColumn]) || 0);

    let value: number;
    switch (config.aggregation || 'sum') {
      case 'sum':
        value = values.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        value = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case 'min':
        value = Math.min(...values);
        break;
      case 'max':
        value = Math.max(...values);
        break;
      case 'count':
        value = values.length;
        break;
      case 'last':
        value = values[values.length - 1] || 0;
        break;
    }

    // Calculate change if compare column provided
    let previousValue: number | undefined;
    let change: number | undefined;
    let changeType: MetricWidget['changeType'] | undefined;

    if (config.compareColumn && data.rows.length >= 2) {
      const compareValues = data.rows.map(
        (r) => Number(r[config.compareColumn!]) || 0,
      );
      previousValue = compareValues[compareValues.length - 2];
      change =
        previousValue !== 0
          ? ((value - previousValue) / previousValue) * 100
          : 0;
      changeType =
        change > 0 ? 'increase' : change < 0 ? 'decrease' : 'neutral';
    }

    return {
      label: config.label || config.valueColumn,
      value,
      previousValue,
      change: change !== undefined ? Math.round(change * 10) / 10 : undefined,
      changeType,
      format: config.format || 'number',
      prefix: config.prefix,
      suffix: config.suffix,
    };
  }

  /**
   * Create table widget from data
   */
  createTableWidget(
    data: DataPreview,
    config?: {
      columns?: string[];
      sortColumn?: string;
      sortDirection?: 'asc' | 'desc';
      pageSize?: number;
      page?: number;
    },
  ): TableWidget {
    const columns = (config?.columns || data.columns.map((c) => c.name)).map(
      (key) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        sortable: true,
      }),
    );

    const rows = [...data.rows];

    // Sort if specified
    if (config?.sortColumn) {
      rows.sort((a, b) => {
        const aVal = a[config.sortColumn!];
        const bVal = b[config.sortColumn!];
        const direction = config.sortDirection === 'desc' ? -1 : 1;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * direction;
        }
        return String(aVal).localeCompare(String(bVal)) * direction;
      });
    }

    // Paginate if specified
    const pageSize = config?.pageSize || 10;
    const page = config?.page || 1;
    const startIndex = (page - 1) * pageSize;
    const paginatedRows = rows.slice(startIndex, startIndex + pageSize);

    return {
      columns,
      rows: paginatedRows,
      pagination: {
        page,
        pageSize,
        total: data.totalRows,
      },
      sortable: true,
      searchable: true,
    };
  }

  /**
   * Create comparison widget
   */
  createComparisonWidget(
    data: DataPreview,
    config: {
      metrics: Array<{
        label: string;
        valueColumn: string;
        format?: 'number' | 'currency' | 'percentage';
      }>;
      groupByColumn?: string;
    },
  ): Array<{ label: string; items: MetricWidget[] }> {
    if (config.groupByColumn) {
      // Group data by column
      const groups: Record<string, DataPreview['rows']> = {};

      data.rows.forEach((row) => {
        const groupKey = String(row[config.groupByColumn!]);
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(row);
      });

      return Object.entries(groups).map(([label, rows]) => ({
        label,
        items: config.metrics.map((metric) =>
          this.createMetricWidget(
            { columns: data.columns, rows, totalRows: rows.length },
            {
              valueColumn: metric.valueColumn,
              label: metric.label,
              format: metric.format,
              aggregation: 'sum',
            },
          ),
        ),
      }));
    }

    // Single comparison
    return [
      {
        label: 'Comparison',
        items: config.metrics.map((metric) =>
          this.createMetricWidget(data, {
            valueColumn: metric.valueColumn,
            label: metric.label,
            format: metric.format,
            aggregation: 'sum',
          }),
        ),
      },
    ];
  }

  /**
   * Auto-generate visualizations for data
   */
  async autoGenerateVisualizations(connectionId: string): Promise<{
    charts: ChartRecommendation[];
    metrics: Array<{ column: string; suggestion: Partial<MetricWidget> }>;
    tables: { suggested: boolean; reason: string };
  }> {
    const data = await this.connectorService.fetchData(connectionId, {
      limit: 100,
    });

    // Get chart recommendations
    const charts = this.chartService.getChartRecommendations(data);

    // Suggest metrics for numeric columns
    const numericColumns = data.columns.filter((c) => c.type === 'number');
    const metrics = numericColumns.map((col) => {
      const values = data.rows.map((r) => Number(r[col.name]) || 0);
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;

      return {
        column: col.name,
        suggestion: {
          label: col.name,
          value: sum,
          format: (sum > 1000000
            ? 'number'
            : sum < 1
              ? 'percentage'
              : 'number') as 'number' | 'percentage' | 'currency',
        },
      };
    });

    // Table suggestion
    const tables = {
      suggested: data.columns.length >= 3 && data.totalRows <= 50,
      reason:
        data.totalRows > 50
          ? 'Data has many rows - consider filtering or aggregating'
          : data.columns.length < 3
            ? 'Few columns - chart might be more effective'
            : 'Data is suitable for table display',
    };

    return { charts, metrics, tables };
  }

  /**
   * Get available data source types
   */
  getAvailableDataSources(): Array<{
    type: DataSourceType;
    name: string;
    description: string;
    oauthRequired: boolean;
    icon: string;
  }> {
    return [
      {
        type: 'google_sheets',
        name: 'Google Sheets',
        description: 'Connect to Google Sheets spreadsheets',
        oauthRequired: true,
        icon: 'google-sheets',
      },
      {
        type: 'excel_online',
        name: 'Excel Online',
        description: 'Connect to Microsoft Excel workbooks',
        oauthRequired: true,
        icon: 'excel',
      },
      {
        type: 'airtable',
        name: 'Airtable',
        description: 'Connect to Airtable bases',
        oauthRequired: false,
        icon: 'airtable',
      },
      {
        type: 'notion',
        name: 'Notion',
        description: 'Connect to Notion databases',
        oauthRequired: true,
        icon: 'notion',
      },
      {
        type: 'csv',
        name: 'CSV Upload',
        description: 'Upload CSV files',
        oauthRequired: false,
        icon: 'file-csv',
      },
      {
        type: 'json_api',
        name: 'JSON API',
        description: 'Connect to any JSON REST API',
        oauthRequired: false,
        icon: 'api',
      },
      {
        type: 'postgresql',
        name: 'PostgreSQL',
        description: 'Connect to PostgreSQL databases',
        oauthRequired: false,
        icon: 'database',
      },
      {
        type: 'mysql',
        name: 'MySQL',
        description: 'Connect to MySQL databases',
        oauthRequired: false,
        icon: 'database',
      },
      {
        type: 'mongodb',
        name: 'MongoDB',
        description: 'Connect to MongoDB collections',
        oauthRequired: false,
        icon: 'mongodb',
      },
    ];
  }

  /**
   * Get available chart types
   */
  getAvailableChartTypes(): Array<{
    type: ChartType;
    name: string;
    description: string;
    icon: string;
    bestFor: string[];
  }> {
    return [
      {
        type: 'bar',
        name: 'Bar Chart',
        description: 'Compare values across categories',
        icon: 'chart-bar',
        bestFor: ['comparisons', 'rankings', 'categorical data'],
      },
      {
        type: 'line',
        name: 'Line Chart',
        description: 'Show trends over time',
        icon: 'chart-line',
        bestFor: ['trends', 'time series', 'continuous data'],
      },
      {
        type: 'pie',
        name: 'Pie Chart',
        description: 'Show proportions of a whole',
        icon: 'chart-pie',
        bestFor: ['proportions', 'percentages', 'composition'],
      },
      {
        type: 'doughnut',
        name: 'Doughnut Chart',
        description: 'Modern pie chart variant',
        icon: 'chart-donut',
        bestFor: ['proportions', 'percentages', 'dashboard metrics'],
      },
      {
        type: 'area',
        name: 'Area Chart',
        description: 'Show cumulative totals over time',
        icon: 'chart-area',
        bestFor: ['cumulative trends', 'volume', 'range'],
      },
      {
        type: 'scatter',
        name: 'Scatter Plot',
        description: 'Show relationships between variables',
        icon: 'chart-scatter',
        bestFor: ['correlations', 'distributions', 'outliers'],
      },
      {
        type: 'radar',
        name: 'Radar Chart',
        description: 'Compare multiple metrics',
        icon: 'chart-radar',
        bestFor: ['multi-variable comparison', 'profiles', 'scores'],
      },
      {
        type: 'funnel',
        name: 'Funnel Chart',
        description: 'Show stages in a process',
        icon: 'chart-funnel',
        bestFor: ['conversion funnels', 'sales pipelines', 'processes'],
      },
      {
        type: 'gauge',
        name: 'Gauge',
        description: 'Show progress toward a goal',
        icon: 'chart-gauge',
        bestFor: ['KPIs', 'targets', 'performance'],
      },
    ];
  }
}
