import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  UseGuards,
  Get,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DataImportService } from './data-import.service';
import { ImportDataDto, DataImportSourceEnum } from './dto/data-import.dto';
import { ProjectsService } from '../projects/projects.service';

@Controller('ai/data-import')
@UseGuards(JwtAuthGuard)
export class DataImportController {
  constructor(
    private readonly dataImportService: DataImportService,
    private readonly projectsService: ProjectsService,
  ) {}

  /**
   * Upload and parse CSV/Excel file
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDataFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() importDto: ImportDataDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file type
    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/csv',
    ];

    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf('.'));

    if (
      !allowedMimeTypes.includes(file.mimetype) &&
      !allowedExtensions.includes(fileExtension)
    ) {
      throw new BadRequestException(
        'Invalid file type. Only CSV and Excel files are supported.',
      );
    }

    // Determine source type from file
    const isExcel =
      fileExtension === '.xlsx' ||
      fileExtension === '.xls' ||
      file.mimetype.includes('spreadsheet');

    const source = isExcel
      ? DataImportSourceEnum.EXCEL
      : DataImportSourceEnum.CSV;

    // Parse file based on type
    let parsedData;
    if (source === DataImportSourceEnum.EXCEL) {
      parsedData = await this.dataImportService.parseExcel(
        file.buffer,
        file.originalname,
        importDto.sheetName,
      );
    } else {
      parsedData = await this.dataImportService.parseCSV(
        file.buffer,
        file.originalname,
        importDto.autoDetectHeaders !== false,
      );
    }

    // Analyze the data
    const analysis = await this.dataImportService.analyzeData(parsedData);

    return {
      success: true,
      data: {
        parsed: parsedData,
        analysis,
      },
    };
  }

  /**
   * Generate presentation from uploaded data
   */
  @Post('generate-presentation')
  @UseInterceptors(FileInterceptor('file'))
  async generatePresentationFromData(
    @UploadedFile() file: Express.Multer.File,
    @Body() importDto: ImportDataDto,
    @Body('userId') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    // Parse file
    const isExcel =
      file.originalname.toLowerCase().endsWith('.xlsx') ||
      file.originalname.toLowerCase().endsWith('.xls');

    let parsedData;
    if (isExcel) {
      parsedData = await this.dataImportService.parseExcel(
        file.buffer,
        file.originalname,
        importDto.sheetName,
      );
    } else {
      parsedData = await this.dataImportService.parseCSV(
        file.buffer,
        file.originalname,
        importDto.autoDetectHeaders !== false,
      );
    }

    // Generate presentation
    const presentation =
      await this.dataImportService.generatePresentationFromData(
        parsedData,
        importDto,
      );

    // Create project with the generated presentation
    const project = await this.projectsService.createProjectFromAI(
      userId,
      presentation,
      {
        source: 'data_import',
        fileName: file.originalname,
        dataRows: parsedData.metadata.totalRows,
        dataColumns: parsedData.metadata.totalColumns,
      },
    );

    return {
      success: true,
      data: {
        project,
        presentation,
        metadata: parsedData.metadata,
      },
    };
  }

  /**
   * Get available sheets from Excel file (preview)
   */
  @Post('preview-sheets')
  @UseInterceptors(FileInterceptor('file'))
  async previewExcelSheets(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const sheets = await this.dataImportService.getExcelSheets(file.buffer);

    return {
      success: true,
      data: {
        fileName: file.originalname,
        sheets,
      },
    };
  }

  /**
   * Analyze data without generating presentation (preview)
   */
  @Post('analyze')
  @UseInterceptors(FileInterceptor('file'))
  async analyzeDataFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('sheetName') sheetName?: string,
    @Query('autoDetectHeaders') autoDetectHeaders?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const isExcel =
      file.originalname.toLowerCase().endsWith('.xlsx') ||
      file.originalname.toLowerCase().endsWith('.xls');

    let parsedData;
    if (isExcel) {
      parsedData = await this.dataImportService.parseExcel(
        file.buffer,
        file.originalname,
        sheetName,
      );
    } else {
      parsedData = await this.dataImportService.parseCSV(
        file.buffer,
        file.originalname,
        autoDetectHeaders !== 'false',
      );
    }

    const analysis = await this.dataImportService.analyzeData(parsedData);

    return {
      success: true,
      data: {
        metadata: parsedData.metadata,
        analysis,
        preview: {
          headers: parsedData.headers,
          sampleRows: parsedData.rows.slice(0, 5),
        },
      },
    };
  }
}
