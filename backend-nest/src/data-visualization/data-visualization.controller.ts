import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DataVisualizationService } from './data-visualization.service';
import { DataConnectorService } from './data-connector.service';
import type {
  DataSourceConfig,
  DataSourceType,
} from './data-connector.service';
import { ChartGeneratorService } from './chart-generator.service';
import type { ChartConfig } from './chart-generator.service';

@ApiTags('Data Visualization')
@ApiBearerAuth()
@Controller('api/data')
@UseGuards(JwtAuthGuard)
export class DataVisualizationController {
  constructor(
    private readonly dataService: DataVisualizationService,
    private readonly connectorService: DataConnectorService,
    private readonly chartService: ChartGeneratorService,
  ) {}

  // ============================================
  // DATA SOURCES
  // ============================================

  @Get('sources/types')
  @ApiOperation({ summary: 'Get available data source types' })
  getAvailableDataSources() {
    return this.dataService.getAvailableDataSources();
  }

  @Post('connections')
  @ApiOperation({ summary: 'Create a new data source connection' })
  async createConnection(@Body() config: DataSourceConfig, @Request() req) {
    return this.connectorService.createConnection(req.user.id, config);
  }

  @Get('connections')
  @ApiOperation({ summary: 'Get all data source connections' })
  async getConnections(@Request() req) {
    return this.connectorService.getConnections(req.user.id);
  }

  @Put('connections/:id')
  @ApiOperation({ summary: 'Update data source connection' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  async updateConnection(
    @Param('id') connectionId: string,
    @Body() updates: Partial<DataSourceConfig>,
    @Request() req,
  ) {
    return this.connectorService.updateConnection(
      connectionId,
      req.user.id,
      updates,
    );
  }

  @Delete('connections/:id')
  @ApiOperation({ summary: 'Delete data source connection' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConnection(@Param('id') connectionId: string, @Request() req) {
    await this.connectorService.deleteConnection(connectionId, req.user.id);
  }

  @Post('connections/test')
  @ApiOperation({ summary: 'Test a data source connection' })
  async testConnection(@Body() config: DataSourceConfig) {
    return this.connectorService.testConnection(config);
  }

  @Get('connections/:id/oauth-url')
  @ApiOperation({ summary: 'Get OAuth URL for data source' })
  @ApiQuery({ name: 'redirectUri', required: true })
  getOAuthUrl(
    @Param('id') type: DataSourceType,
    @Query('redirectUri') redirectUri: string,
  ) {
    return { url: this.connectorService.getOAuthUrl(type, redirectUri) };
  }

  // ============================================
  // DATA FETCHING
  // ============================================

  @Get('connections/:id/preview')
  @ApiOperation({ summary: 'Preview data from connection' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async previewData(
    @Param('id') connectionId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.connectorService.fetchData(connectionId, {
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  @Post('connections/:id/sync')
  @ApiOperation({ summary: 'Trigger data sync' })
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerSync(@Param('id') connectionId: string) {
    await this.connectorService.triggerSync(connectionId);
    return { status: 'syncing' };
  }

  // ============================================
  // CHARTS
  // ============================================

  @Get('charts/types')
  @ApiOperation({ summary: 'Get available chart types' })
  getAvailableChartTypes() {
    return this.dataService.getAvailableChartTypes();
  }

  @Post('connections/:id/charts')
  @ApiOperation({ summary: 'Generate chart from data source' })
  async generateChart(
    @Param('id') connectionId: string,
    @Body() config: ChartConfig,
  ) {
    return this.chartService.generateChart(connectionId, config);
  }

  @Get('connections/:id/chart-recommendations')
  @ApiOperation({ summary: 'Get chart recommendations for data' })
  async getChartRecommendations(@Param('id') connectionId: string) {
    const data = await this.connectorService.fetchData(connectionId, {
      limit: 100,
    });
    return this.chartService.getChartRecommendations(data);
  }

  @Get('charts')
  @ApiOperation({ summary: 'Get saved charts' })
  async getSavedCharts(@Request() req) {
    return this.chartService.getSavedCharts(req.user.id);
  }

  @Get('charts/:id')
  @ApiOperation({ summary: 'Get chart by ID' })
  async getChart(@Param('id') chartId: string) {
    return this.chartService.refreshChart(chartId);
  }

  @Post('charts/:id/refresh')
  @ApiOperation({ summary: 'Refresh chart data' })
  async refreshChart(@Param('id') chartId: string) {
    return this.chartService.refreshChart(chartId);
  }

  @Delete('charts/:id')
  @ApiOperation({ summary: 'Delete chart' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteChart(@Param('id') chartId: string) {
    await this.chartService.deleteChart(chartId);
  }

  @Post('charts/:id/clone')
  @ApiOperation({ summary: 'Clone chart with new configuration' })
  async cloneChart(
    @Param('id') chartId: string,
    @Body() newConfig?: Partial<ChartConfig>,
  ) {
    return this.chartService.cloneChart(chartId, newConfig);
  }

  @Get('charts/:id/export')
  @ApiOperation({ summary: 'Export chart as image' })
  @ApiQuery({ name: 'format', required: false, enum: ['png', 'svg', 'pdf'] })
  @ApiQuery({ name: 'width', required: false, type: Number })
  @ApiQuery({ name: 'height', required: false, type: Number })
  async exportChart(
    @Param('id') chartId: string,
    @Query('format') format?: 'png' | 'svg' | 'pdf',
    @Query('width') width?: string,
    @Query('height') height?: string,
  ) {
    return this.chartService.exportChartAsImage(chartId, format || 'png', {
      width: width ? parseInt(width) : undefined,
      height: height ? parseInt(height) : undefined,
    });
  }

  // ============================================
  // WIDGETS
  // ============================================

  @Post('widgets')
  @ApiOperation({ summary: 'Create data widget' })
  async createWidget(
    @Body()
    widget: {
      presentationId?: string;
      slideId?: string;
      type: 'chart' | 'table' | 'metric' | 'comparison';
      connectionId?: string;
      config: object;
      refreshEnabled?: boolean;
      refreshInterval?: number;
    },
    @Request() req,
  ) {
    return this.dataService.createWidget(req.user.id, widget);
  }

  @Get('presentations/:presentationId/widgets')
  @ApiOperation({ summary: 'Get widgets for a presentation' })
  async getWidgetsForPresentation(
    @Param('presentationId') presentationId: string,
  ) {
    return this.dataService.getWidgetsForPresentation(presentationId);
  }

  @Put('widgets/:id')
  @ApiOperation({ summary: 'Update widget' })
  async updateWidget(
    @Param('id') widgetId: string,
    @Body()
    updates: {
      config?: object;
      refreshEnabled?: boolean;
      refreshInterval?: number;
    },
  ) {
    return this.dataService.updateWidget(widgetId, updates);
  }

  @Delete('widgets/:id')
  @ApiOperation({ summary: 'Delete widget' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWidget(@Param('id') widgetId: string) {
    await this.dataService.deleteWidget(widgetId);
  }

  @Post('widgets/:id/refresh')
  @ApiOperation({ summary: 'Refresh widget data' })
  async refreshWidget(@Param('id') widgetId: string) {
    return this.dataService.refreshWidget(widgetId);
  }

  // ============================================
  // AUTO-GENERATION
  // ============================================

  @Get('connections/:id/auto-visualize')
  @ApiOperation({ summary: 'Auto-generate visualization suggestions' })
  async autoGenerateVisualizations(@Param('id') connectionId: string) {
    return this.dataService.autoGenerateVisualizations(connectionId);
  }

  // ============================================
  // INLINE DATA
  // ============================================

  @Post('inline/chart')
  @ApiOperation({ summary: 'Generate chart from inline data' })
  generateInlineChart(
    @Body()
    body: {
      data: {
        columns: Array<{
          name: string;
          type: 'string' | 'number' | 'date' | 'boolean';
        }>;
        rows: Array<Record<string, unknown>>;
        totalRows: number;
      };
      config: ChartConfig;
    },
  ) {
    return this.chartService.generateChartFromData(body.data, body.config);
  }

  @Post('inline/metric')
  @ApiOperation({ summary: 'Create metric widget from inline data' })
  createInlineMetric(
    @Body()
    body: {
      data: {
        columns: Array<{
          name: string;
          type: 'string' | 'number' | 'date' | 'boolean';
        }>;
        rows: Array<Record<string, unknown>>;
        totalRows: number;
      };
      config: {
        valueColumn: string;
        label?: string;
        format?: 'number' | 'currency' | 'percentage';
        aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'last';
        compareColumn?: string;
        prefix?: string;
        suffix?: string;
      };
    },
  ) {
    return this.dataService.createMetricWidget(body.data, body.config);
  }

  @Post('inline/table')
  @ApiOperation({ summary: 'Create table widget from inline data' })
  createInlineTable(
    @Body()
    body: {
      data: {
        columns: Array<{
          name: string;
          type: 'string' | 'number' | 'date' | 'boolean';
        }>;
        rows: Array<Record<string, unknown>>;
        totalRows: number;
      };
      config?: {
        columns?: string[];
        sortColumn?: string;
        sortDirection?: 'asc' | 'desc';
        pageSize?: number;
        page?: number;
      };
    },
  ) {
    return this.dataService.createTableWidget(body.data, body.config);
  }
}
