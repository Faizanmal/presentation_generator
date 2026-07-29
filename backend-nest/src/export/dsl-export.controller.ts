/**
 * DSL Export Controller — export PresentationDocument to HTML / speaker notes.
 */
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DslExportService } from './dsl-export.service';
import type { PresentationDocument } from '../../../shared/presentation-dsl';

@Controller('export/dsl')
@UseGuards(JwtAuthGuard)
export class DslExportController {
  constructor(private readonly dslExport: DslExportService) {}

  /**
   * POST /export/dsl/html
   * Export a PresentationDocument to standalone HTML.
   */
  @Post('html')
  exportHtml(
    @Body() body: { document?: PresentationDocument },
    @Res() res: Response,
  ) {
    if (!body.document?.sections?.length) {
      throw new BadRequestException('document with sections is required');
    }

    const result = this.dslExport.exportToHtmlPresentation(body.document);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.data);
  }

  /**
   * POST /export/dsl/notes
   * Export speaker notes as Markdown.
   */
  @Post('notes')
  exportNotes(
    @Body() body: { document?: PresentationDocument },
    @Res() res: Response,
  ) {
    if (!body.document?.sections?.length) {
      throw new BadRequestException('document with sections is required');
    }

    const result = this.dslExport.exportToSpeakerNotes(body.document);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.data);
  }
}
