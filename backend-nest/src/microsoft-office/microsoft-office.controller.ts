import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MicrosoftOfficeService } from './microsoft-office.service';
import type { ImportOptions, ExportOptions } from './microsoft-office.service';
import type { Request, Response } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string };
}

@ApiTags('microsoft-office')
@Controller('api/microsoft')
export class MicrosoftOfficeController {
  constructor(
    private readonly microsoftOfficeService: MicrosoftOfficeService,
  ) {}

  // ============================================
  // OAUTH
  // ============================================

  @Get('auth')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Microsoft OAuth URL' })
  getMicrosoftAuthUrl(@Req() req: AuthenticatedRequest) {
    return {
      url: this.microsoftOfficeService.getMicrosoftAuthUrl(req.user.id),
    };
  }

  @Get('callback')
  @ApiOperation({ summary: 'Microsoft OAuth callback' })
  async microsoftCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      await this.microsoftOfficeService.exchangeMicrosoftCode(code, state);
      res.redirect('/settings/integrations?connected=microsoft');
    } catch (error) {
      res.redirect(
        `/settings/integrations?error=${encodeURIComponent(error.message)}`,
      );
    }
  }

  // ============================================
  // ONEDRIVE
  // ============================================

  @Get('onedrive/files')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List OneDrive files' })
  async listOneDriveFiles(
    @Query('folderId') folderId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.microsoftOfficeService.listOneDriveFiles(req.user.id, folderId);
  }

  @Post('onedrive/import/:fileId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import PowerPoint from OneDrive' })
  @ApiBody({
    schema: {
      properties: {
        preserveLayout: { type: 'boolean' },
        extractImages: { type: 'boolean' },
        extractNotes: { type: 'boolean' },
      },
    },
  })
  async importFromOneDrive(
    @Param('fileId') fileId: string,
    @Body() options: Partial<ImportOptions>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.microsoftOfficeService.importFromOneDrive(
      req.user.id,
      fileId,
      options,
    );
  }

  @Post('onedrive/export/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export project to OneDrive' })
  @ApiBody({
    schema: {
      properties: {
        folderId: { type: 'string', description: 'OneDrive folder ID' },
        includeNotes: { type: 'boolean' },
        templateStyle: {
          type: 'string',
          enum: ['modern', 'classic', 'minimal', 'corporate'],
        },
      },
    },
  })
  async exportToOneDrive(
    @Param('projectId') projectId: string,
    @Body() body: { folderId?: string } & Partial<ExportOptions>,
    @Req() req: AuthenticatedRequest,
  ) {
    const { folderId, ...options } = body;
    return this.microsoftOfficeService.exportToOneDrive(
      req.user.id,
      projectId,
      folderId,
      options,
    );
  }

  // ============================================
  // SHAREPOINT
  // ============================================

  @Get('sharepoint/sites')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List SharePoint sites' })
  async listSharePointSites(@Req() req: AuthenticatedRequest) {
    return this.microsoftOfficeService.listSharePointSites(req.user.id);
  }

  @Get('sharepoint/sites/:siteId/files')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List files in SharePoint site' })
  async listSharePointFiles(
    @Param('siteId') siteId: string,
    @Query('folderId') folderId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.microsoftOfficeService.listSharePointFiles(
      req.user.id,
      siteId,
      folderId,
    );
  }

  // ============================================
  // POWERPOINT IMPORT/EXPORT
  // ============================================

  @Post('import/upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import PowerPoint from uploaded file' })
  async importPowerPoint(
    @UploadedFile() file: Express.Multer.File,
    @Body() options: Partial<ImportOptions>,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
    ];

    if (!validTypes.includes(file.mimetype)) {
      throw new Error('Invalid file type. Please upload a PowerPoint file.');
    }

    return this.microsoftOfficeService.importPowerPoint(
      req.user.id,
      file.buffer,
      file.originalname,
      options,
    );
  }

  @Post('export/:projectId/pptx')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export project to PowerPoint file' })
  @ApiBody({
    schema: {
      properties: {
        includeNotes: { type: 'boolean' },
        includeAnimations: { type: 'boolean' },
        templateStyle: {
          type: 'string',
          enum: ['modern', 'classic', 'minimal', 'corporate'],
        },
        author: { type: 'string' },
        company: { type: 'string' },
      },
    },
  })
  async exportToPowerPoint(
    @Param('projectId') projectId: string,
    @Body() options: Partial<ExportOptions>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.microsoftOfficeService.exportToPowerPoint(
      req.user.id,
      projectId,
      options,
    );
  }
}
