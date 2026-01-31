import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  Patch,
  Delete,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DataChartsService, ChartConfig, ChartType } from './data-charts.service';

// DTOs
class CreateCSVDataSourceDto {
  name: string;
  csvContent: string;
  delimiter?: string;
}

class ConnectGoogleSheetsDto {
  name: string;
  sheetId: string;
  range: string;
  accessToken: string;
}

class ConnectAPIDataSourceDto {
  name: string;
  apiEndpoint: string;
  headers?: Record<string, string>;
  refreshInterval?: number;
  dataPath?: string;
}

class CreateChartDto {
  slideId: string;
  blockId: string;
  dataSourceId: string;
  config: ChartConfig;
}

class SuggestChartDto {
  goal?: string;
}

class UpdateChartConfigDto {
  config: Partial<ChartConfig>;
}

@Controller('data-charts')
@UseGuards(JwtAuthGuard)
export class DataChartsController {
  constructor(private readonly chartsService: DataChartsService) {}

  // Data Sources
  @Post('datasource/csv')
  async createCSVDataSource(
    @Body() dto: CreateCSVDataSourceDto,
    @Request() req: any,
  ) {
    return this.chartsService.createDataSourceFromCSV(
      req.user.id,
      dto.name,
      dto.csvContent,
      dto.delimiter,
    );
  }

  @Post('datasource/csv/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCSVFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name: string,
    @Body('delimiter') delimiter: string,
    @Request() req: any,
  ) {
    const csvContent = file.buffer.toString('utf-8');
    return this.chartsService.createDataSourceFromCSV(
      req.user.id,
      name || file.originalname,
      csvContent,
      delimiter || ',',
    );
  }

  @Post('datasource/google-sheets')
  async connectGoogleSheets(
    @Body() dto: ConnectGoogleSheetsDto,
    @Request() req: any,
  ) {
    return this.chartsService.connectGoogleSheets(
      req.user.id,
      dto.name,
      dto.sheetId,
      dto.range,
      dto.accessToken,
    );
  }

  @Post('datasource/api')
  async connectAPIDataSource(
    @Body() dto: ConnectAPIDataSourceDto,
    @Request() req: any,
  ) {
    return this.chartsService.connectAPIDataSource(
      req.user.id,
      dto.name,
      dto.apiEndpoint,
      dto.headers,
      dto.refreshInterval,
      dto.dataPath,
    );
  }

  @Post('datasource/:dataSourceId/refresh')
  async refreshDataSource(@Param('dataSourceId') dataSourceId: string) {
    return this.chartsService.refreshDataSource(dataSourceId);
  }

  // Charts
  @Post(':projectId/chart')
  async createChart(
    @Param('projectId') projectId: string,
    @Body() dto: CreateChartDto,
  ) {
    return this.chartsService.createChart(
      projectId,
      dto.slideId,
      dto.blockId,
      dto.dataSourceId,
      dto.config,
    );
  }

  @Get('chart/:chartId')
  async getChartData(@Param('chartId') chartId: string) {
    return this.chartsService.getChartData(chartId);
  }

  @Patch('chart/:chartId')
  async updateChartConfig(
    @Param('chartId') chartId: string,
    @Body() dto: UpdateChartConfigDto,
  ) {
    return this.chartsService.updateChartConfig(chartId, dto.config);
  }

  // AI Suggestions
  @Post('datasource/:dataSourceId/suggest')
  async suggestChartType(
    @Param('dataSourceId') dataSourceId: string,
    @Body() dto: SuggestChartDto,
  ) {
    return this.chartsService.suggestChartType(dataSourceId, dto.goal);
  }
}
