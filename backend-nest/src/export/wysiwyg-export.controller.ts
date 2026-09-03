import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Res,
  Header,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import puppeteer from 'puppeteer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WysiwygExportService } from './wysiwyg-export.service';
import { ExportService } from './export.service';
import { ThrottleExportPDF } from '../common/decorators/throttle.decorator';
import { resolveBrowserExecutable } from './browser-executable';

@Controller('export')
@UseGuards(JwtAuthGuard)
export class WysiwygExportController {
  private readonly logger = new Logger(WysiwygExportController.name);

  constructor(
    private readonly wysiwygService: WysiwygExportService,
    private readonly exportService: ExportService,
  ) {}

  /**
   * GET /api/export/:projectId/wysiwyg-html
   * Returns a self-contained HTML document that replicates the editor canvas.
   */
  @Get(':projectId/wysiwyg-html')
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
  async getWysiwygPdf(
    @CurrentUser() _user: { id: string },
    @Param('projectId') projectId: string,
    @Query('quality') quality: 'standard' | 'high' = 'high',
    @Res() res: Response,
  ) {
    try {
      const pdfBuffer = await this.renderWithPuppeteer(projectId, quality);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="presentation-${projectId}.pdf"`,
      );
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(pdfBuffer);
    } catch (error) {
      this.logger.error(
        `WYSIWYG PDF failed, using text fallback: ${(error as Error).message}`,
        (error as Error).stack,
      );
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
   * Screenshot each 16:9 slide and embed the PNG into a PDF.
   * This preserves layout, images, and fonts — unlike the Helvetica pdf-lib path.
   */
  private async renderWithPuppeteer(
    projectId: string,
    quality: 'standard' | 'high',
  ): Promise<Buffer> {
    const slidePages =
      await this.wysiwygService.generatePerSlideHtml(projectId);

    const executablePath = resolveBrowserExecutable();
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ];

    const browser = await this.launchBrowser(executablePath, launchArgs);

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
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });
        await page.evaluate(async () => {
          await (document as Document & { fonts: { ready: Promise<unknown> } })
            .fonts.ready;
          const images = Array.from(document.images);
          await Promise.all(
            images
              .filter((img) => !img.complete)
              .map(
                (img) =>
                  new Promise<void>((resolve) => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                  }),
              ),
          );
        });

        const png = await page.screenshot({
          type: 'png',
          clip: { x: 0, y: 0, width: 1280, height: 720 },
        });
        await page.close();

        const pdfPage = mergedPdf.addPage([1280, 720]);
        const image = await mergedPdf.embedPng(png);
        pdfPage.drawImage(image, {
          x: 0,
          y: 0,
          width: 1280,
          height: 720,
        });
      }

      const mergedBytes = await mergedPdf.save();
      return Buffer.from(mergedBytes);
    } finally {
      await browser.close();
    }
  }

  private async launchBrowser(
    executablePath: string | undefined,
    args: string[],
  ) {
    if (executablePath) {
      this.logger.log(`Launching PDF browser: ${executablePath}`);
      return puppeteer.launch({
        headless: true,
        executablePath,
        args,
      });
    }

    try {
      this.logger.log('Launching PDF browser channel: chrome');
      return await puppeteer.launch({
        headless: true,
        channel: 'chrome',
        args,
      });
    } catch (error) {
      this.logger.warn(
        `PDF browser channel chrome failed: ${(error as Error).message}`,
      );
    }

    return puppeteer.launch({ headless: true, args });
  }
}
