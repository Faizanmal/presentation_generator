import { IsEnum, IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';

export enum ChartTypeEnum {
    BAR = 'bar',
    LINE = 'line',
    PIE = 'pie',
    DOUGHNUT = 'doughnut',
    RADAR = 'radar',
    SCATTER = 'scatter',
}

export enum DataImportSourceEnum {
    CSV = 'csv',
    EXCEL = 'excel',
}

export class ImportDataDto {
    @IsEnum(DataImportSourceEnum)
    source: DataImportSourceEnum;

    @IsOptional()
    @IsString()
    topic?: string;

    @IsOptional()
    @IsString()
    tone?: string;

    @IsOptional()
    @IsString()
    audience?: string;

    @IsOptional()
    @IsBoolean()
    generateCharts?: boolean;

    @IsOptional()
    @IsEnum(ChartTypeEnum)
    preferredChartType?: ChartTypeEnum;

    @IsOptional()
    @IsBoolean()
    autoDetectHeaders?: boolean;

    @IsOptional()
    @IsNumber()
    maxRows?: number;

    @IsOptional()
    @IsString()
    sheetName?: string; // For Excel files with multiple sheets
}

export interface ParsedDataResult {
    headers: string[];
    rows: Record<string, unknown>[];
    metadata: {
        totalRows: number;
        totalColumns: number;
        sheetName?: string;
        fileName: string;
    };
}

export interface DataAnalysisResult {
    summary: {
        rowCount: number;
        columnCount: number;
        numericColumns: string[];
        categoricalColumns: string[];
        dateColumns: string[];
    };
    insights: {
        type: string;
        description: string;
        significance: 'high' | 'medium' | 'low';
    }[];
    recommendedCharts: {
        type: ChartTypeEnum;
        columns: string[];
        reason: string;
    }[];
}
