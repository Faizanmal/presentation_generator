import { Controller, Get, Param, Query, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  /**
   * Check if user can export
   */
  @Get('can-export')
  async canExport(@CurrentUser() user: { id: string }) {
    const canExport = await this.exportService.canExport(user.id);
    return { canExport };
  }

  /**
   * Export project to specified format
   */
  @Get(':projectId')
  async exportProject(
    @CurrentUser() user: { id: string },
    @Param('projectId') projectId: string,
    @Query('format') format: 'pdf' | 'html' | 'json' = 'html',
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportProject(user.id, projectId, {
      format,
    });

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.data);
  }
}
