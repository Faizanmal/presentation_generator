import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  Patch,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsIn,
  Min,
  Max,
  IsUrl,
  MaxLength,
  IsObject,
  validateOrReject,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DataChartsService, ChartConfig } from './data-charts.service';

// ─── DTOs ──────────────────────────────────────────────────────────────────

class CreateCSVDataSourceDto {
  @IsString() @IsNotEmpty() projectId: string;
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  @IsString() @IsNotEmpty() csvContent: string;
  @IsOptional() @IsIn([',', ';', '\t', '|']) delimiter?: string;
}

class ConnectGoogleSheetsDto {
  @IsString() @IsNotEmpty() projectId: string;
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  @IsString() @IsNotEmpty() sheetId: string;
  @IsString() @IsNotEmpty() range: string;
  @IsString() @IsNotEmpty() accessToken: string;
}

class ConnectAPIDataSourceDto {
  @IsString() @IsNotEmpty() projectId: string;
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  apiEndpoint: string;
  @IsOptional() @IsObject() headers?: Record<string, string>;
  @IsOptional() @IsNumber() @Min(1) @Max(10080) refreshInterval?: number;
  @IsOptional() @IsString() @MaxLength(200) dataPath?: string;
}

class CreateJSONDataSourceDto {
  @IsString() @IsNotEmpty() projectId: string;
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  jsonContent: string | unknown[];
}

class CreateChartDto {
  @IsString() @IsNotEmpty() slideId: string;
  @IsString() @IsNotEmpty() blockId: string;
  @IsString() @IsNotEmpty() dataSourceId: string;
  config: ChartConfig;
}

class SuggestChartDto {
  @IsOptional() @IsString() @MaxLength(500) goal?: string;
}

class UpdateChartConfigDto {
  config: Partial<ChartConfig>;
}

// ─── Helper ────────────────────────────────────────────────────────────────

async function validateDto<T extends object>(
  cls: new () => T,
  plain: object,
): Promise<T> {
  const instance = plainToInstance(cls, plain);
  try {
    await validateOrReject(instance, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });
  } catch (errors) {
    const messages = (errors as { constraints?: Record<string, string> }[])
      .flatMap((e) => Object.values(e.constraints ?? {}))
      .join('; ');
    throw new BadRequestException(messages || 'Validation failed');
  }
  return instance;
}

@Controller('data-charts')
@UseGuards(JwtAuthGuard)
export class DataChartsController {
  constructor(private readonly chartsService: DataChartsService) {}

  // ─── Data Sources ──────────────────────────────────────────────────────────

  @Post('datasource/csv')
  async createCSVDataSource(
    @Body() body: CreateCSVDataSourceDto,
    @Request() req: { user: { id: string } },
  ) {
    const dto = await validateDto(CreateCSVDataSourceDto, body);
    return this.chartsService.createDataSourceFromCSV(
      req.user.id,
      dto.projectId,
      dto.name,
      dto.csvContent,
      dto.delimiter ?? ',',
    );
  }

  @Post('datasource/csv/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCSVFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('projectId') projectId: string,
    @Body('name') name: string,
    @Body('delimiter') delimiter: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!file) {
      throw new BadRequestException('A CSV file must be provided');
    }
    if (!projectId) {
      throw new BadRequestException('projectId is required');
    }
    const csvContent = file.buffer.toString('utf-8');
    return this.chartsService.createDataSourceFromCSV(
      req.user.id,
      projectId,
      name || file.originalname,
      csvContent,
      delimiter ?? ',',
    );
  }

  @Post('datasource/google-sheets')
  async connectGoogleSheets(
    @Body() body: ConnectGoogleSheetsDto,
    @Request() req: { user: { id: string } },
  ) {
    const dto = await validateDto(ConnectGoogleSheetsDto, body);
    return this.chartsService.connectGoogleSheets(
      req.user.id,
      dto.projectId,
      dto.name,
      dto.sheetId,
      dto.range,
      dto.accessToken,
    );
  }

  @Post('datasource/api')
  async connectAPIDataSource(
    @Body() body: ConnectAPIDataSourceDto,
    @Request() req: { user: { id: string } },
  ) {
    const dto = await validateDto(ConnectAPIDataSourceDto, body);
    return this.chartsService.connectAPIDataSource(
      req.user.id,
      dto.projectId,
      dto.name,
      dto.apiEndpoint,
      dto.headers,
      dto.refreshInterval,
      dto.dataPath,
    );
  }

  @Post('datasource/json')
  async createJSONDataSource(
    @Body() body: CreateJSONDataSourceDto,
    @Request() req: { user: { id: string } },
  ) {
    const dto = await validateDto(CreateJSONDataSourceDto, body);
    return this.chartsService.createDataSourceFromJSON(
      req.user.id,
      dto.projectId,
      dto.name,
      dto.jsonContent,
    );
  }

  @Post('datasource/:dataSourceId/refresh')
  async refreshDataSource(@Param('dataSourceId') dataSourceId: string) {
    if (!dataSourceId) {
      throw new BadRequestException('dataSourceId is required');
    }
    return this.chartsService.refreshDataSource(dataSourceId);
  }

  // ─── Charts ────────────────────────────────────────────────────────────────

  @Post(':projectId/chart')
  async createChart(
    @Param('projectId') projectId: string,
    @Body() dto: CreateChartDto,
  ) {
    if (!projectId) {
      throw new BadRequestException('projectId is required');
    }
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
    if (!dto?.config) {
      throw new BadRequestException('config is required');
    }
    return this.chartsService.updateChartConfig(chartId, dto.config);
  }

  // ─── AI Suggestions ────────────────────────────────────────────────────────

  @Post('datasource/:dataSourceId/suggest')
  async suggestChartType(
    @Param('dataSourceId') dataSourceId: string,
    @Body() body: SuggestChartDto,
  ) {
    const dto = await validateDto(SuggestChartDto, body ?? {});
    return this.chartsService.suggestChartType(dataSourceId, dto.goal);
  }
}
