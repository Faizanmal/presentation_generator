import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

export type ChartType = 'bar' | 'line' | 'pie' | 'doughnut' | 'area' | 'scatter' | 'radar' | 'treemap' | 'funnel' | 'gauge';

export interface DataSource {
  id: string;
  name: string;
  type: 'csv' | 'google_sheets' | 'excel' | 'api' | 'manual';
  config: {
    url?: string;
    sheetId?: string;
    range?: string;
    apiEndpoint?: string;
    refreshInterval?: number; // minutes
    headers?: Record<string, string>;
  };
  lastFetched?: Date;
  data?: any[];
}

export interface ChartConfig {
  type: ChartType;
  title?: string;
  xAxis?: {
    field: string;
    label?: string;
    format?: string;
  };
  yAxis?: {
    field: string;
    label?: string;
    format?: string;
  };
  series?: Array<{
    field: string;
    label: string;
    color?: string;
  }>;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'none';
  groupBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  colors?: string[];
  showLegend?: boolean;
  showDataLabels?: boolean;
  animations?: boolean;
}

export interface DataChart {
  id: string;
  projectId: string;
  slideId: string;
  blockId: string;
  dataSourceId: string;
  config: ChartConfig;
  cachedData?: any;
  lastUpdated: Date;
}

@Injectable()
export class DataChartsService {
  private readonly logger = new Logger(DataChartsService.name);
  private openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Create a data source from CSV
   */
  async createDataSourceFromCSV(
    userId: string,
    name: string,
    csvContent: string,
    delimiter: string = ',',
  ): Promise<DataSource> {
    const rows = this.parseCSV(csvContent, delimiter);
    
    if (rows.length === 0) {
      throw new BadRequestException('CSV file is empty or invalid');
    }

    const dataSource = await this.prisma.dataSource.create({
      data: {
        userId,
        name,
        type: 'csv',
        config: { delimiter },
        data: rows,
      },
    });

    return {
      id: dataSource.id,
      name: dataSource.name,
      type: dataSource.type as DataSource['type'],
      config: dataSource.config as DataSource['config'],
      lastFetched: dataSource.lastFetched || undefined,
      data: dataSource.data as any[],
    };
  }

  /**
   * Connect to Google Sheets
   */
  async connectGoogleSheets(
    userId: string,
    name: string,
    sheetId: string,
    range: string,
    accessToken: string,
  ): Promise<DataSource> {
    // Fetch initial data from Google Sheets
    const data = await this.fetchGoogleSheetsData(sheetId, range, accessToken);

    const dataSource = await this.prisma.dataSource.create({
      data: {
        userId,
        name,
        type: 'google_sheets',
        config: { sheetId, range },
        data,
        lastFetched: new Date(),
      },
    });

    return {
      id: dataSource.id,
      name: dataSource.name,
      type: 'google_sheets',
      config: { sheetId, range },
      lastFetched: new Date(),
      data,
    };
  }

  /**
   * Connect to external API
   */
  async connectAPIDataSource(
    userId: string,
    name: string,
    apiEndpoint: string,
    headers?: Record<string, string>,
    refreshInterval?: number,
    dataPath?: string,
  ): Promise<DataSource> {
    // Fetch initial data
    const data = await this.fetchAPIData(apiEndpoint, headers, dataPath);

    const dataSource = await this.prisma.dataSource.create({
      data: {
        userId,
        name,
        type: 'api',
        config: { apiEndpoint, headers, refreshInterval, dataPath },
        data,
        lastFetched: new Date(),
      },
    });

    return {
      id: dataSource.id,
      name: dataSource.name,
      type: 'api',
      config: { apiEndpoint, headers, refreshInterval },
      lastFetched: new Date(),
      data,
    };
  }

  /**
   * Create a chart from data source
   */
  async createChart(
    projectId: string,
    slideId: string,
    blockId: string,
    dataSourceId: string,
    config: ChartConfig,
  ): Promise<DataChart> {
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id: dataSourceId },
    });

    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }

    // Process data according to config
    const processedData = this.processDataForChart(
      dataSource.data as any[],
      config,
    );

    const chart = await this.prisma.dataChart.create({
      data: {
        projectId,
        slideId,
        blockId,
        dataSourceId,
        config,
        cachedData: processedData,
      },
    });

    return {
      id: chart.id,
      projectId: chart.projectId,
      slideId: chart.slideId,
      blockId: chart.blockId,
      dataSourceId: chart.dataSourceId,
      config: chart.config as ChartConfig,
      cachedData: chart.cachedData,
      lastUpdated: chart.updatedAt,
    };
  }

  /**
   * AI-powered chart suggestion
   */
  async suggestChartType(
    dataSourceId: string,
    goal?: string,
  ): Promise<{
    recommendedType: ChartType;
    alternativeTypes: ChartType[];
    suggestedConfig: Partial<ChartConfig>;
    reasoning: string;
  }> {
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id: dataSourceId },
    });

    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }

    const data = dataSource.data as any[];
    const sample = data.slice(0, 5);
    const columns = data.length > 0 ? Object.keys(data[0]) : [];

    const prompt = `
Analyze this data and suggest the best chart type:

Columns: ${columns.join(', ')}
Sample data: ${JSON.stringify(sample, null, 2)}
Total rows: ${data.length}
${goal ? `User's goal: ${goal}` : ''}

Return a JSON object with:
{
  "recommendedType": "bar|line|pie|doughnut|area|scatter|radar|treemap|funnel|gauge",
  "alternativeTypes": ["type1", "type2"],
  "suggestedConfig": {
    "xAxis": { "field": "...", "label": "..." },
    "yAxis": { "field": "...", "label": "..." },
    "aggregation": "sum|avg|count|none",
    "groupBy": "field or null"
  },
  "reasoning": "Why this chart type is best"
}
    `.trim();

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a data visualization expert. Suggest the best chart type and configuration for the given data.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      return JSON.parse(response.choices[0]?.message?.content || '{}');
    } catch (error) {
      this.logger.error('Failed to get AI chart suggestion:', error);
      return {
        recommendedType: 'bar',
        alternativeTypes: ['line', 'pie'],
        suggestedConfig: {},
        reasoning: 'Default suggestion',
      };
    }
  }

  /**
   * Refresh data source
   */
  async refreshDataSource(dataSourceId: string): Promise<DataSource> {
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id: dataSourceId },
    });

    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }

    let newData: any[];
    const config = dataSource.config as DataSource['config'];

    switch (dataSource.type) {
      case 'google_sheets':
        // Would need to get fresh access token
        throw new BadRequestException('Google Sheets refresh requires re-authentication');
      
      case 'api':
        newData = await this.fetchAPIData(
          config.apiEndpoint!,
          config.headers,
          (config as any).dataPath,
        );
        break;
      
      default:
        throw new BadRequestException(`Cannot refresh ${dataSource.type} data source`);
    }

    const updated = await this.prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        data: newData,
        lastFetched: new Date(),
      },
    });

    // Update all charts using this data source
    await this.updateChartsForDataSource(dataSourceId, newData);

    return {
      id: updated.id,
      name: updated.name,
      type: updated.type as DataSource['type'],
      config: updated.config as DataSource['config'],
      lastFetched: updated.lastFetched || undefined,
      data: newData,
    };
  }

  /**
   * Get chart data with live refresh
   */
  async getChartData(chartId: string): Promise<{
    chart: DataChart;
    data: any;
    isStale: boolean;
  }> {
    const chart = await this.prisma.dataChart.findUnique({
      where: { id: chartId },
      include: { dataSource: true },
    });

    if (!chart) {
      throw new NotFoundException('Chart not found');
    }

    const config = chart.dataSource.config as DataSource['config'];
    const refreshInterval = config.refreshInterval || 60; // Default 60 minutes
    const lastFetched = chart.dataSource.lastFetched;
    const isStale = lastFetched
      ? Date.now() - lastFetched.getTime() > refreshInterval * 60 * 1000
      : true;

    return {
      chart: {
        id: chart.id,
        projectId: chart.projectId,
        slideId: chart.slideId,
        blockId: chart.blockId,
        dataSourceId: chart.dataSourceId,
        config: chart.config as ChartConfig,
        cachedData: chart.cachedData,
        lastUpdated: chart.updatedAt,
      },
      data: chart.cachedData,
      isStale,
    };
  }

  /**
   * Update chart configuration
   */
  async updateChartConfig(
    chartId: string,
    config: Partial<ChartConfig>,
  ): Promise<DataChart> {
    const chart = await this.prisma.dataChart.findUnique({
      where: { id: chartId },
      include: { dataSource: true },
    });

    if (!chart) {
      throw new NotFoundException('Chart not found');
    }

    const mergedConfig = { ...chart.config as ChartConfig, ...config };
    const processedData = this.processDataForChart(
      chart.dataSource.data as any[],
      mergedConfig,
    );

    const updated = await this.prisma.dataChart.update({
      where: { id: chartId },
      data: {
        config: mergedConfig,
        cachedData: processedData,
      },
    });

    return {
      id: updated.id,
      projectId: updated.projectId,
      slideId: updated.slideId,
      blockId: updated.blockId,
      dataSourceId: updated.dataSourceId,
      config: updated.config as ChartConfig,
      cachedData: updated.cachedData,
      lastUpdated: updated.updatedAt,
    };
  }

  /**
   * Scheduled task to refresh data sources
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async refreshStaleDataSources() {
    this.logger.log('Checking for stale data sources...');

    const dataSources = await this.prisma.dataSource.findMany({
      where: {
        type: { in: ['api', 'google_sheets'] },
      },
    });

    for (const ds of dataSources) {
      const config = ds.config as DataSource['config'];
      const refreshInterval = config.refreshInterval || 60;
      const lastFetched = ds.lastFetched;

      if (!lastFetched || Date.now() - lastFetched.getTime() > refreshInterval * 60 * 1000) {
        try {
          await this.refreshDataSource(ds.id);
          this.logger.log(`Refreshed data source: ${ds.id}`);
        } catch (error) {
          this.logger.error(`Failed to refresh data source ${ds.id}:`, error);
        }
      }
    }
  }

  // Helper methods
  private parseCSV(content: string, delimiter: string): any[] {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      
      headers.forEach((header, idx) => {
        const value = values[idx] || '';
        // Try to parse as number
        const num = parseFloat(value);
        row[header] = isNaN(num) ? value : num;
      });
      
      rows.push(row);
    }

    return rows;
  }

  private async fetchGoogleSheetsData(
    sheetId: string,
    range: string,
    accessToken: string,
  ): Promise<any[]> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`;
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to fetch Google Sheets data');
    }

    const result = await response.json();
    const rows = result.values || [];
    
    if (rows.length < 2) return [];

    const headers = rows[0] as string[];
    return rows.slice(1).map((row: any[]) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        const value = row[i] || '';
        const num = parseFloat(value);
        obj[h] = isNaN(num) ? value : num;
      });
      return obj;
    });
  }

  private async fetchAPIData(
    endpoint: string,
    headers?: Record<string, string>,
    dataPath?: string,
  ): Promise<any[]> {
    const response = await fetch(endpoint, {
      headers: headers || {},
    });

    if (!response.ok) {
      throw new BadRequestException(`API returned ${response.status}`);
    }

    let data = await response.json();

    // Navigate to nested path if specified
    if (dataPath) {
      const paths = dataPath.split('.');
      for (const p of paths) {
        data = data?.[p];
      }
    }

    if (!Array.isArray(data)) {
      throw new BadRequestException('API did not return an array');
    }

    return data;
  }

  private processDataForChart(data: any[], config: ChartConfig): any {
    let processed = [...data];

    // Apply grouping and aggregation
    if (config.groupBy && config.aggregation !== 'none') {
      processed = this.aggregateData(processed, config);
    }

    // Apply sorting
    if (config.sortBy) {
      processed.sort((a, b) => {
        const aVal = a[config.sortBy!];
        const bVal = b[config.sortBy!];
        const order = config.sortOrder === 'desc' ? -1 : 1;
        return (aVal > bVal ? 1 : -1) * order;
      });
    }

    // Apply limit
    if (config.limit) {
      processed = processed.slice(0, config.limit);
    }

    // Format for chart.js
    return {
      labels: processed.map(d => d[config.xAxis?.field || Object.keys(d)[0]]),
      datasets: this.buildDatasets(processed, config),
    };
  }

  private aggregateData(data: any[], config: ChartConfig): any[] {
    const groups: Record<string, any[]> = {};
    
    for (const row of data) {
      const key = row[config.groupBy!];
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }

    return Object.entries(groups).map(([key, rows]) => {
      const result: any = { [config.groupBy!]: key };
      
      const valueField = config.yAxis?.field || config.series?.[0]?.field;
      if (valueField) {
        const values = rows.map(r => r[valueField]).filter(v => typeof v === 'number');
        
        switch (config.aggregation) {
          case 'sum':
            result[valueField] = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            result[valueField] = values.reduce((a, b) => a + b, 0) / values.length;
            break;
          case 'count':
            result[valueField] = rows.length;
            break;
          case 'min':
            result[valueField] = Math.min(...values);
            break;
          case 'max':
            result[valueField] = Math.max(...values);
            break;
        }
      }

      return result;
    });
  }

  private buildDatasets(data: any[], config: ChartConfig): any[] {
    if (config.series && config.series.length > 0) {
      return config.series.map((s, idx) => ({
        label: s.label,
        data: data.map(d => d[s.field]),
        backgroundColor: s.color || config.colors?.[idx] || this.getDefaultColor(idx),
        borderColor: s.color || config.colors?.[idx] || this.getDefaultColor(idx),
      }));
    }

    const valueField = config.yAxis?.field || Object.keys(data[0] || {})[1];
    return [{
      label: config.yAxis?.label || valueField,
      data: data.map(d => d[valueField]),
      backgroundColor: config.colors || data.map((_, i) => this.getDefaultColor(i)),
    }];
  }

  private getDefaultColor(index: number): string {
    const colors = [
      '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
      '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
    ];
    return colors[index % colors.length];
  }

  private async updateChartsForDataSource(dataSourceId: string, newData: any[]) {
    const charts = await this.prisma.dataChart.findMany({
      where: { dataSourceId },
    });

    for (const chart of charts) {
      const processedData = this.processDataForChart(
        newData,
        chart.config as ChartConfig,
      );

      await this.prisma.dataChart.update({
        where: { id: chart.id },
        data: { cachedData: processedData },
      });
    }
  }
}
