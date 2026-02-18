import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import * as Papa from 'papaparse';
import {
  ParsedDataResult,
  DataAnalysisResult,
  ChartTypeEnum,
  ImportDataDto,
} from './dto/data-import.dto';
import { AIService, ChartData, GeneratedPresentation } from './ai.service';

@Injectable()
export class DataImportService {
  private readonly logger = new Logger(DataImportService.name);

  constructor(private readonly aiService: AIService) {}

  /**
   * Parse CSV file
   */
  async parseCSV(
    buffer: Buffer,
    fileName: string,
    autoDetectHeaders = true,
  ): Promise<ParsedDataResult> {
    try {
      const csvString = buffer.toString('utf-8');

      return new Promise((resolve, reject) => {
        Papa.parse(csvString, {
          header: autoDetectHeaders,
          skipEmptyLines: true,
          dynamicTyping: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              this.logger.warn('CSV parsing had errors', results.errors);
            }

            const data = results.data as Record<string, unknown>[];
            const headers = autoDetectHeaders
              ? Object.keys(data[0] || {})
              : data[0]
                ? Object.keys(data[0])
                : [];

            resolve({
              headers,
              rows: autoDetectHeaders ? data : data.slice(1),
              metadata: {
                totalRows: data.length,
                totalColumns: headers.length,
                fileName,
              },
            });
          },
          error: (error) => {
            reject(
              new BadRequestException(`CSV parsing failed: ${error.message}`),
            );
          },
        });
      });
    } catch (error) {
      this.logger.error('Failed to parse CSV', error);
      throw new BadRequestException('Invalid CSV file format');
    }
  }

  /**
   * Parse Excel file (supports .xlsx, .xls)
   */
  async parseExcel(
    buffer: Buffer,
    fileName: string,
    sheetName?: string,
  ): Promise<ParsedDataResult> {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      const worksheet = sheetName
        ? workbook.getWorksheet(sheetName)
        : workbook.worksheets[0];

      if (!worksheet) {
        const available = workbook.worksheets.map((w) => w.name).join(', ');
        throw new BadRequestException(
          `Sheet "${sheetName || ''}" not found. Available sheets: ${available}`,
        );
      }

      // Read headers from first row
      const headerRow = worksheet.getRow(1);
      const headers: string[] = [];
      const headerValues = headerRow.values as Array<unknown>;
      for (let i = 1; i < headerValues.length; i++) {
        const v = headerValues[i];
        headers.push(v == null ? `Column${i}` : String(v));
      }

      const rows: Record<string, unknown>[] = [];
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // skip header row
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < headers.length; i++) {
          const cell = row.getCell(i + 1);
          let value: unknown = cell.value;
          if (value && typeof value === 'object' && 'text' in (value as any)) {
            value = (value as any).text;
          }
          if (value instanceof Date) value = value.toISOString();
          obj[headers[i]] = value === undefined ? null : value;
        }
        rows.push(obj);
      });

      if (rows.length === 0) {
        throw new BadRequestException('Excel sheet is empty');
      }

      this.logger.log(
        `Parsed Excel file: ${fileName}, Sheet: ${worksheet.name}, Rows: ${rows.length}`,
      );

      return {
        headers,
        rows,
        metadata: {
          totalRows: rows.length,
          totalColumns: headers.length,
          sheetName: worksheet.name,
          fileName,
        },
      };
    } catch (error) {
      this.logger.error('Failed to parse Excel', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid Excel file format');
    }
  }

  /**
   * Analyze parsed data to provide insights and recommendations
   */
  analyzeData(parsedData: ParsedDataResult): DataAnalysisResult {
    const { headers, rows } = parsedData;

    // Classify columns
    const numericColumns: string[] = [];
    const categoricalColumns: string[] = [];
    const dateColumns: string[] = [];

    for (const header of headers) {
      const sampleValues = rows.slice(0, 10).map((row) => row[header]);

      // Check if numeric
      const numericCount = sampleValues.filter(
        (v) => typeof v === 'number' || !isNaN(Number(v)),
      ).length;

      // Check if date
      const dateCount = sampleValues.filter((v) => {
        if (!v) return false;
        const date = new Date(v as string);
        return !isNaN(date.getTime());
      }).length;

      if (numericCount > sampleValues.length * 0.7) {
        numericColumns.push(header);
      } else if (dateCount > sampleValues.length * 0.7) {
        dateColumns.push(header);
      } else {
        categoricalColumns.push(header);
      }
    }

    // Generate insights
    const insights: DataAnalysisResult['insights'] = [];

    if (rows.length > 1000) {
      insights.push({
        type: 'data_size',
        description: `Large dataset detected (${rows.length} rows). Consider summarizing or sampling.`,
        significance: 'high' as const,
      });
    }

    if (numericColumns.length > 0 && categoricalColumns.length > 0) {
      insights.push({
        type: 'mixed_data',
        description: `Data contains both numerical (${numericColumns.length}) and categorical (${categoricalColumns.length}) columns, suitable for comparative analysis.`,
        significance: 'medium' as const,
      });
    }

    if (dateColumns.length > 0) {
      insights.push({
        type: 'temporal_data',
        description: `Time-series data detected (${dateColumns.join(', ')}). Consider trend analysis.`,
        significance: 'high' as const,
      });
    }

    // Recommend charts
    const recommendedCharts = this.recommendCharts(
      numericColumns,
      categoricalColumns,
      dateColumns,
    );

    return {
      summary: {
        rowCount: rows.length,
        columnCount: headers.length,
        numericColumns,
        categoricalColumns,
        dateColumns,
      },
      insights,
      recommendedCharts,
    };
  }

  /**
   * Recommend appropriate chart types based on data structure
   */
  private recommendCharts(
    numericColumns: string[],
    categoricalColumns: string[],
    dateColumns: string[],
  ): DataAnalysisResult['recommendedCharts'] {
    const recommendations: DataAnalysisResult['recommendedCharts'] = [];

    // Time series: line chart
    if (dateColumns.length > 0 && numericColumns.length > 0) {
      recommendations.push({
        type: ChartTypeEnum.LINE,
        columns: [dateColumns[0], ...numericColumns.slice(0, 2)],
        reason:
          'Time-series data is best visualized with line charts to show trends over time',
      });
    }

    // Categorical vs Numeric: bar chart
    if (categoricalColumns.length > 0 && numericColumns.length > 0) {
      recommendations.push({
        type: ChartTypeEnum.BAR,
        columns: [categoricalColumns[0], numericColumns[0]],
        reason:
          'Bar charts effectively compare numerical values across categories',
      });
    }

    // Multiple numeric columns: multi-series bar or line
    if (numericColumns.length >= 2) {
      recommendations.push({
        type: ChartTypeEnum.SCATTER,
        columns: [numericColumns[0], numericColumns[1]],
        reason:
          'Scatter plots reveal correlations between two numerical variables',
      });
    }

    // Composition/proportions: pie chart
    if (categoricalColumns.length >= 1 && numericColumns.length >= 1) {
      recommendations.push({
        type: ChartTypeEnum.PIE,
        columns: [categoricalColumns[0], numericColumns[0]],
        reason: 'Pie charts show proportional distribution across categories',
      });
    }

    return recommendations;
  }

  /**
   * Generate presentation from imported data
   */
  async generatePresentationFromData(
    parsedData: ParsedDataResult,
    importDto: ImportDataDto,
  ): Promise<GeneratedPresentation> {
    try {
      // Analyze the data first
      const analysis = this.analyzeData(parsedData);

      // Generate charts if requested
      const charts: ChartData[] = [];
      if (importDto.generateCharts && analysis.recommendedCharts.length > 0) {
        for (const recommendation of analysis.recommendedCharts.slice(0, 3)) {
          const chartData = this.generateChartFromData(
            parsedData,
            recommendation.columns,
            recommendation.type,
          );
          charts.push(chartData);
        }
      }

      // Use AI to generate presentation structure
      const topic =
        importDto.topic ||
        `Data Analysis: ${parsedData.metadata.fileName.replace(/\.[^/.]+$/, '')}`;

      const presentation = await this.aiService.generateAdvancedPresentation({
        topic,
        tone: importDto.tone || 'professional',
        audience: importDto.audience || 'data analysts',
        length: Math.min(8, Math.max(5, Math.ceil(charts.length + 3))),
        type: 'presentation',
        generateImages: false,
        smartLayout: true,
      });

      // Inject charts into appropriate slides
      if (charts.length > 0) {
        let chartIndex = 0;
        for (
          let i = 1;
          i < presentation.sections.length && chartIndex < charts.length;
          i++
        ) {
          const section = presentation.sections[i];

          // Add chart block to sections that discuss data
          if (
            section.heading.toLowerCase().includes('data') ||
            section.heading.toLowerCase().includes('analysis') ||
            section.heading.toLowerCase().includes('result') ||
            section.heading.toLowerCase().includes('trend') ||
            i === 2 // Always add chart to third slide
          ) {
            section.blocks.push({
              type: 'chart',
              content: `Data visualization: ${analysis.recommendedCharts[chartIndex]?.reason || 'Chart'}`,
              chartData: charts[chartIndex],
            });
            section.layout = 'chart-focus';
            chartIndex++;
          }
        }
      }

      this.logger.log(
        `Generated presentation from data: ${parsedData.metadata.fileName}`,
      );

      return presentation;
    } catch (error) {
      this.logger.error('Failed to generate presentation from data', error);
      throw new InternalServerErrorException(
        'Failed to generate presentation from data',
      );
    }
  }

  /**
   * Generate chart from parsed data
   */
  private generateChartFromData(
    parsedData: ParsedDataResult,
    columns: string[],
    chartType: ChartTypeEnum,
  ): ChartData {
    const { rows } = parsedData;

    // Limit to reasonable number of data points
    const maxDataPoints = chartType === ChartTypeEnum.PIE ? 10 : 20;
    const limitedRows = rows.slice(0, maxDataPoints);

    const labels: string[] = [];
    const datasets: ChartData['datasets'] = [];

    if (columns.length >= 2) {
      const labelColumn = columns[0];
      const dataColumns = columns.slice(1);

      // Extract labels
      limitedRows.forEach((row) => {
        labels.push(this.toDisplayText(row[labelColumn], 'Unknown'));
      });

      // Extract data for each column
      dataColumns.forEach((colName, idx) => {
        const data: number[] = [];

        limitedRows.forEach((row) => {
          const value = row[colName];
          const numValue =
            typeof value === 'number'
              ? value
              : parseFloat(this.toDisplayText(value, '0'));
          data.push(isNaN(numValue) ? 0 : numValue);
        });

        const colors = this.generateColors(data.length);

        datasets.push({
          label: colName,
          data,
          backgroundColor:
            chartType === ChartTypeEnum.PIE ||
            chartType === ChartTypeEnum.DOUGHNUT
              ? colors
              : colors[idx % colors.length],
          borderColor:
            chartType === ChartTypeEnum.LINE ||
            chartType === ChartTypeEnum.SCATTER
              ? colors[idx % colors.length]
              : undefined,
        });
      });
    } else if (columns.length === 1) {
      // Single column - show frequency distribution
      const column = columns[0];
      const valueCounts = new Map<string, number>();

      limitedRows.forEach((row) => {
        const value = this.toDisplayText(row[column], 'Unknown');
        valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
      });

      valueCounts.forEach((count, value) => {
        labels.push(value);
      });

      const data = Array.from(valueCounts.values());
      const colors = this.generateColors(data.length);

      datasets.push({
        label: 'Count',
        data,
        backgroundColor: colors,
      });
    }

    return {
      type: chartType,
      labels,
      datasets,
    };
  }

  /**
   * Generate color palette for charts
   */
  private generateColors(count: number): string[] {
    const baseColors = [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#14b8a6', // teal
      '#f97316', // orange
      '#6366f1', // indigo
      '#84cc16', // lime
    ];

    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
      colors.push(baseColors[i % baseColors.length]);
    }

    return colors;
  }

  /**
   * Build data context for AI prompt
   */
  private buildDataContext(
    parsedData: ParsedDataResult,
    analysis: DataAnalysisResult,
  ): string {
    const { metadata } = parsedData;
    const { summary } = analysis;

    return `
File: ${metadata.fileName}
${metadata.sheetName ? `Sheet: ${metadata.sheetName}` : ''}
Total Rows: ${summary.rowCount}
Total Columns: ${summary.columnCount}

Column Types:
- Numeric: ${summary.numericColumns.join(', ') || 'None'}
- Categorical: ${summary.categoricalColumns.join(', ') || 'None'}
- Date/Time: ${summary.dateColumns.join(', ') || 'None'}

Sample Data (first 5 rows):
${JSON.stringify(parsedData.rows.slice(0, 5), null, 2)}
    `.trim();
  }

  /**
   * Get list of available sheets in Excel file
   */
  async getExcelSheets(buffer: Buffer): Promise<string[]> {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      return workbook.worksheets.map((w) => w.name);
    } catch (error) {
      this.logger.error('Failed to read Excel sheets', error);
      throw new BadRequestException('Invalid Excel file');
    }
  }

  private toDisplayText(value: unknown, fallback: string): string {
    if (value == null) return fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (value instanceof Date) return value.toISOString();
    return fallback;
  }
}
