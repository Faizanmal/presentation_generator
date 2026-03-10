import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Res,
  Header,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WysiwygExportService } from './wysiwyg-export.service';
import { ExportService } from './export.service';
import { ThrottleExportPDF } from '../common/decorators/throttle.decorator';
import { Feature } from '../common/decorators/feature.decorator';

@Controller('export')
@UseGuards(JwtAuthGuard)
export class WysiwygExportController {
  constructor(
    private readonly wysiwygService: WysiwygExportService,
    private readonly exportService: ExportService,
  ) {}

  /**
   * GET /api/export/:projectId/wysiwyg-html
   * Returns a self-contained HTML document that replicates the editor canvas.
   * Can be used for:
   *  - Direct browser preview
   *  - Puppeteer-based PDF screenshot rendering
   *  - PPTX image-based exports
   */
  @Get(':projectId/wysiwyg-html')
  @Feature('highResExport')
  @Header('Content-Type', 'text/html')
  async getWysiwygHtml(
    @CurrentUser() _user: { id: string },
    @Param('projectId') projectId: string,
  ): Promise<string> {
    return this.wysiwygService.generateWysiwygHtml(projectId);
  }

  /**
   * GET /api/export/:projectId/wysiwyg-pdf
   * High-fidelity PDF export that uses the WYSIWYG HTML
   * (falls back to standard export if Puppeteer is not available)
   */
  @Get(':projectId/wysiwyg-pdf')
  @ThrottleExportPDF()
  @Feature('highResExport')
  async getWysiwygPdf(
    @CurrentUser() _user: { id: string },
    @Param('projectId') projectId: string,
    @Query('quality') quality: 'standard' | 'high' = 'high',
    @Res() res: Response,
  ) {
    try {
      // Try Puppeteer-based WYSIWYG export
      const pdfBuffer = await this.renderWithPuppeteer(projectId, quality);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="presentation-${projectId}.pdf"`,
      );
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(pdfBuffer);
    } catch {
      // Fallback to standard PDF export
      const fallback = await this.exportService.exportToPDF(projectId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="presentation-${projectId}.pdf"`,
      );
      res.send(fallback);
    }
  }

  /**
   * Render HTML to PDF using Puppeteer (if available).
   * Each slide is rendered as a full 1280x720 page.
   */
  private async renderWithPuppeteer(
    projectId: string,
    quality: 'standard' | 'high',
  ): Promise<Buffer> {
    // Dynamic import to avoid hard dependency on puppeteer
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer = require('puppeteer');

    const slidePages =
      await this.wysiwygService.generatePerSlideHtml(projectId);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    try {
      const { PDFDocument } = await import('pdf-lib');
      const mergedPdf = await PDFDocument.create();

      const deviceScaleFactor = quality === 'high' ? 2 : 1;

      for (const slidePage of slidePages) {
        const page = await browser.newPage();
        await page.setViewport({
          width: 1280,
          height: 720,
          deviceScaleFactor,
        });
        await page.setContent(slidePage.html, {
          waitUntil: 'networkidle0',
          timeout: 15000,
        });

        // Wait a bit for fonts to load
        await page.evaluate(() => new Promise((r) => setTimeout(r, 500)));

        const pdfBuffer = await page.pdf({
          width: '1280px',
          height: '720px',
          printBackground: true,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        });

        // Merge individual slide PDFs
        const slidePdf = await PDFDocument.load(pdfBuffer);
        const [copiedPage] = await mergedPdf.copyPages(slidePdf, [0]);
        mergedPdf.addPage(copiedPage);

        await page.close();
      }

      const mergedBytes = await mergedPdf.save();
      return Buffer.from(mergedBytes);
    } finally {
      await browser.close();
    }
  }
}
