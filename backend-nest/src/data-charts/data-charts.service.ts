import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

// Configurable limits
const MAX_CSV_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_JSON_ROWS = 50_000;
const API_FETCH_TIMEOUT_MS = 15_000; // 15 seconds

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
  | 'gauge';

export type DataRow = Record<string, string | number | boolean | null>;

export interface ChartDataset {
  label: string;
  data: (number | null)[];
  backgroundColor: string | string[];
  borderColor?: string | string[];
}

export interface ProcessedChartData {
  labels: (string | number)[];
  datasets: ChartDataset[];
}

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
    delimiter?: string;
    dataPath?: string;
  };
  lastFetched?: Date;
  data?: DataRow[];
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
  cachedData?: ProcessedChartData;
  lastUpdated: Date;
}

@Injectable()
export class DataChartsService {
  private readonly logger = new Logger(DataChartsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Create a data source from CSV
   */
  async createDataSourceFromCSV(
    _userId: string,
    projectId: string,
    name: string,
    csvContent: string,
    delimiter: string = ',',
  ): Promise<DataSource> {
    if (!projectId) {
      throw new BadRequestException('projectId is required');
    }
    if (!name?.trim()) {
      throw new BadRequestException('Data source name is required');
    }
    if (Buffer.byteLength(csvContent, 'utf-8') > MAX_CSV_BYTES) {
      throw new BadRequestException(
        `CSV file exceeds the maximum allowed size of ${MAX_CSV_BYTES / 1024 / 1024} MB`,
      );
    }

    const rows = this.parseCSV(csvContent, delimiter);

    if (rows.length === 0) {
      throw new BadRequestException('CSV file is empty or invalid');
    }

    const dataSource = await this.prisma.dataSource.create({
      data: {
        projectId,
        name,
        type: 'CSV',
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
      data: dataSource.data as unknown as DataRow[],
    };
  }

  /**
   * Create a data source from Raw JSON
   */
  async createDataSourceFromJSON(
    _userId: string,
    projectId: string,
    name: string,
    jsonContent: string | unknown[],
  ): Promise<DataSource> {
    if (!projectId) {
      throw new BadRequestException('projectId is required');
    }
    if (!name?.trim()) {
      throw new BadRequestException('Data source name is required');
    }

    let rows: DataRow[];

    try {
      if (typeof jsonContent === 'string') {
        if (Buffer.byteLength(jsonContent, 'utf-8') > MAX_CSV_BYTES) {
          throw new BadRequestException(
            `JSON payload exceeds the maximum allowed size of ${MAX_CSV_BYTES / 1024 / 1024} MB`,
          );
        }
        const parsed = JSON.parse(jsonContent);
        if (Array.isArray(parsed)) {
          rows = parsed;
        } else {
          throw new Error('JSON format is not an array.');
        }
      } else if (Array.isArray(jsonContent)) {
        rows = jsonContent as DataRow[];
      } else {
        throw new BadRequestException('Invalid JSON format');
      }

      if (rows.length > 0 && typeof rows[0] !== 'object') {
        throw new BadRequestException(
          'JSON array must contain objects (key-value pairs)',
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        'Invalid JSON data: ' + (error as Error).message,
      );
    }

    if (rows.length === 0) {
      throw new BadRequestException('JSON data is empty');
    }

    if (rows.length > MAX_JSON_ROWS) {
      throw new BadRequestException(
        `JSON data exceeds the maximum allowed row count of ${MAX_JSON_ROWS.toLocaleString()}`,
      );
    }

    const dataSource = await this.prisma.dataSource.create({
      data: {
        projectId,
        name,
        type: 'MANUAL',
        config: {},
        data: rows as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      id: dataSource.id,
      name: dataSource.name,
      type: 'manual',
      config: {},
      lastFetched: dataSource.lastFetched || undefined,
      data: dataSource.data as unknown as DataRow[],
    };
  }

  /**
   * Connect to Google Sheets
   */
  async connectGoogleSheets(
    _userId: string,
    projectId: string,
    name: string,
    sheetId: string,
    range: string,
    accessToken: string,
  ): Promise<DataSource> {
    // Fetch initial data from Google Sheets
    const data = await this.fetchGoogleSheetsData(sheetId, range, accessToken);

    const dataSource = await this.prisma.dataSource.create({
      data: {
        projectId,
        name,
        type: 'GOOGLE_SHEETS',
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
    _userId: string,
    projectId: string,
    name: string,
    apiEndpoint: string,
    headers?: Record<string, string>,
    refreshInterval?: number,
    dataPath?: string,
  ): Promise<DataSource> {
    if (!projectId) {
      throw new BadRequestException('projectId is required');
    }
    if (!name?.trim()) {
      throw new BadRequestException('Data source name is required');
    }
    try {
      new URL(apiEndpoint);
    } catch {
      throw new BadRequestException('apiEndpoint must be a valid URL');
    }
    if (
      refreshInterval !== undefined &&
      (refreshInterval < 1 || refreshInterval > 10080)
    ) {
      throw new BadRequestException(
        'refreshInterval must be between 1 and 10080 minutes (1 week)',
      );
    }

    // Fetch initial data
    const data = await this.fetchAPIData(apiEndpoint, headers, dataPath);

    const dataSource = await this.prisma.dataSource.create({
      data: {
        projectId,
        name,
        type: 'API',
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
      dataSource.data as unknown as DataRow[],
      config,
    );

    const chart = await this.prisma.dataChart.create({
      data: {
        projectId,
        slideId,
        blockId,
        dataSourceId,
        chartType: config.type || 'bar',
        config:
          config as unknown as import('@prisma/client').Prisma.InputJsonValue,
        cachedData:
          processedData as unknown as import('@prisma/client').Prisma.InputJsonValue,
      },
    });

    return {
      id: chart.id,
      projectId: chart.projectId,
      slideId: chart.slideId,
      blockId: chart.blockId,
      dataSourceId: chart.dataSourceId,
      config: chart.config as unknown as ChartConfig,
      cachedData: chart.cachedData as unknown as ProcessedChartData,
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

    const data = dataSource.data as unknown as DataRow[];
    const sample = data.slice(0, 5);
    const columns = data.length > 0 ? Object.keys(data[0]) : [];

    const prompt = `
analyze this data and suggest the best chart type:

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
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a data visualization expert. Suggest the best chart type and configuration for the given data.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      return JSON.parse(response.choices[0]?.message?.content || '{}') as {
        recommendedType: ChartType;
        alternativeTypes: ChartType[];
        suggestedConfig: Partial<ChartConfig>;
        reasoning: string;
      };
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

    let newData: DataRow[];
    const config = dataSource.config as DataSource['config'];

    switch (dataSource.type) {
      case 'GOOGLE_SHEETS':
        // Google Sheets requires a fresh OAuth access token.
        // Clients should call POST /data-charts/datasource/google-sheets/refresh
        // with a valid accessToken in the request body.
        throw new BadRequestException(
          'Google Sheets data sources cannot be refreshed automatically. ' +
            'Please reconnect the data source to supply a fresh access token.',
        );

      case 'API':
        newData = await this.fetchAPIData(
          config.apiEndpoint!,
          config.headers,
          config.dataPath,
        );
        break;

      default:
        throw new BadRequestException(
          `Cannot refresh ${dataSource.type} data source`,
        );
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
    data: ProcessedChartData;
    isStale: boolean;
  }> {
    const chart = await this.prisma.dataChart.findUnique({
      where: { id: chartId },
      include: { dataSource: true },
    });

    if (!chart) {
      throw new NotFoundException('Chart not found');
    }

    if (!chart.dataSource) {
      throw new NotFoundException('Data source not found for chart');
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
        config: chart.config as unknown as ChartConfig,
        cachedData: chart.cachedData as unknown as ProcessedChartData,
        lastUpdated: chart.updatedAt,
      },
      data: chart.cachedData as unknown as ProcessedChartData,
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

    if (!chart.dataSource) {
      throw new NotFoundException('Data source not found for chart');
    }

    const mergedConfig = {
      ...(chart.config as unknown as ChartConfig),
      ...config,
    };
    const processedData = this.processDataForChart(
      chart.dataSource.data as unknown as DataRow[],
      mergedConfig,
    );

    const updated = await this.prisma.dataChart.update({
      where: { id: chartId },
      data: {
        config:
          mergedConfig as unknown as import('@prisma/client').Prisma.InputJsonValue,
        cachedData:
          processedData as unknown as import('@prisma/client').Prisma.InputJsonValue,
      },
    });

    return {
      id: updated.id,
      projectId: updated.projectId,
      slideId: updated.slideId,
      blockId: updated.blockId,
      dataSourceId: updated.dataSourceId,
      config: updated.config as unknown as ChartConfig,
      cachedData: updated.cachedData as unknown as ProcessedChartData,
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
        type: { in: ['API', 'GOOGLE_SHEETS'] },
      },
    });

    for (const ds of dataSources) {
      const config = ds.config as DataSource['config'];
      const refreshInterval = config.refreshInterval || 60;
      const lastFetched = ds.lastFetched;

      if (
        !lastFetched ||
        Date.now() - lastFetched.getTime() > refreshInterval * 60 * 1000
      ) {
        try {
          await this.prisma.executeWithRetry(
            () => this.refreshDataSource(ds.id),
            3,
            200,
          );
          this.logger.log(`Refreshed data source: ${ds.id}`);
        } catch (error) {
          this.logger.error(`Failed to refresh data source ${ds.id}:`, error);
        }
      }
    }
  }

  // Helper methods
  /**
   * Parses RFC 4180-compliant CSV content, correctly handling:
   * - Quoted fields (values that contain the delimiter or newlines)
   * - Escaped double-quotes inside quoted fields
   * - Mixed Windows (\r\n) and Unix (\n) line endings
   */
  private parseCSV(content: string, delimiter: string): DataRow[] {
    // Normalise line endings
    const normalised = content
      .trim()
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    const lines = normalised.split('\n');
    if (lines.length < 2) return [];

    const parseFields = (line: string): string[] => {
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') {
            // Escaped double-quote inside a quoted field
            current += '"';
            i++;
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            current += ch;
          }
        } else if (ch === '"') {
          inQuotes = true;
        } else if (ch === delimiter) {
          fields.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      fields.push(current.trim());
      return fields;
    };

    const headers = parseFields(lines[0]);
    const rows: DataRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const rawLine = lines[i].trim();
      if (!rawLine) continue; // Skip blank trailing lines

      const values = parseFields(rawLine);
      const row: DataRow = {};

      headers.forEach((header, idx) => {
        const value = values[idx] ?? '';
        // Attempt numeric coercion only when the value is not an empty string
        if (value === '') {
          row[header] = null;
        } else {
          const num = Number(value);
          row[header] = isNaN(num) ? value : num;
        }
      });

      rows.push(row);
    }

    return rows;
  }

  private async fetchGoogleSheetsData(
    sheetId: string,
    range: string,
    accessToken: string,
  ): Promise<DataRow[]> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to fetch Google Sheets data');
    }

    const result = (await response.json()) as {
      values?: (string | number | boolean)[][];
    };
    const rows = result.values || [];

    if (rows.length < 2) return [];

    const headers = rows[0] as string[];
    return rows.slice(1).map((row) => {
      const obj: DataRow = {};

      headers.forEach((h: string, i: number) => {
        const cellValue = row[i];
        const value = cellValue !== undefined ? String(cellValue) : '';
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
  ): Promise<DataRow[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      API_FETCH_TIMEOUT_MS,
    );

    let response: Response;
    try {
      response = await fetch(endpoint, {
        headers: headers || {},
        signal: controller.signal,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.name === 'AbortError'
          ? `API request timed out after ${API_FETCH_TIMEOUT_MS / 1000}s`
          : `Failed to reach API endpoint: ${(err as Error).message}`;
      throw new BadRequestException(msg);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new BadRequestException(
        `API responded with HTTP ${response.status} ${response.statusText}`,
      );
    }

    let data = (await response.json()) as Record<string, unknown> | unknown[];

    // Navigate to nested path if specified
    if (dataPath) {
      const paths = dataPath.split('.');
      let current: unknown = data;
      for (const p of paths) {
        if (current && typeof current === 'object' && !Array.isArray(current)) {
          current = (current as Record<string, unknown>)[p];
        } else {
          current = undefined;
          break;
        }
      }
      data = current as Record<string, unknown> | unknown[];
    }

    if (!Array.isArray(data)) {
      throw new BadRequestException('API did not return an array');
    }

    return data as DataRow[];
  }

  private processDataForChart(
    data: DataRow[],
    config: ChartConfig,
  ): ProcessedChartData {
    let processed = [...data];

    // Apply grouping and aggregation
    if (config.groupBy && config.aggregation !== 'none') {
      processed = this.aggregateData(processed, config);
    }

    // Apply sorting
    if (config.sortBy) {
      processed.sort((a, b) => {
        const aVal = a[config.sortBy!] as string | number;
        const bVal = b[config.sortBy!] as string | number;
        const order = config.sortOrder === 'desc' ? -1 : 1;
        if (aVal === bVal) return 0;
        return (aVal > bVal ? 1 : -1) * order;
      });
    }

    // Apply limit
    if (config.limit) {
      processed = processed.slice(0, config.limit);
    }

    // Format for chart.js
    return {
      labels: processed.map(
        (d) => d[config.xAxis?.field || Object.keys(d)[0]] as string | number,
      ),

      datasets: this.buildDatasets(processed, config),
    };
  }

  private aggregateData(data: DataRow[], config: ChartConfig): DataRow[] {
    const groups: Record<string, DataRow[]> = {};

    for (const row of data) {
      const key = String(row[config.groupBy!]);
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }

    return Object.entries(groups).map(([key, rows]) => {
      const result: DataRow = { [config.groupBy!]: key };

      const valueField = config.yAxis?.field || config.series?.[0]?.field;
      if (valueField) {
        const values = rows
          .map((r) => r[valueField])
          .filter((v): v is number => typeof v === 'number');

        switch (config.aggregation) {
          case 'sum':
            result[valueField] = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            result[valueField] =
              values.reduce((a, b) => a + b, 0) / values.length;
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

  private buildDatasets(data: DataRow[], config: ChartConfig): ChartDataset[] {
    if (config.series && config.series.length > 0) {
      return config.series.map((s, idx) => ({
        label: s.label,
        data: data.map((d) => d[s.field] as number | null),
        backgroundColor:
          s.color || config.colors?.[idx] || this.getDefaultColor(idx),
        borderColor:
          s.color || config.colors?.[idx] || this.getDefaultColor(idx),
      }));
    }

    const valueField = config.yAxis?.field || Object.keys(data[0] || {})[1];
    return [
      {
        label: config.yAxis?.label || valueField,
        data: data.map((d) => d[valueField] as number | null),
        backgroundColor:
          config.colors || data.map((_, i) => this.getDefaultColor(i)),
      },
    ];
  }

  private getDefaultColor(index: number): string {
    const colors = [
      '#6366f1',
      '#8b5cf6',
      '#ec4899',
      '#f43f5e',
      '#f97316',
      '#eab308',
      '#22c55e',
      '#14b8a6',
      '#06b6d4',
      '#3b82f6',
    ];
    return colors[index % colors.length];
  }

  private async updateChartsForDataSource(
    dataSourceId: string,
    newData: DataRow[],
  ): Promise<void> {
    const charts = await this.prisma.dataChart.findMany({
      where: { dataSourceId },
    });

    if (charts.length === 0) return;

    // Process and persist all chart updates concurrently
    await Promise.all(
      charts.map((chart) => {
        const processedData = this.processDataForChart(
          newData,
          chart.config as unknown as ChartConfig,
        );
        return this.prisma.dataChart
          .update({
            where: { id: chart.id },
            data: {
              cachedData:
                processedData as unknown as import('@prisma/client').Prisma.InputJsonValue,
            },
          })
          .catch((err: Error) => {
            this.logger.error(
              `Failed to update cached data for chart ${chart.id}: ${err.message}`,
            );
          });
      }),
    );
  }
}
