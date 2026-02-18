import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZipAdapter } from './zip-adapter';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import PptxGenJS from 'pptxgenjs';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { SubscriptionPlan } from '@prisma/client';

// Types for export
interface ExportOptions {
  format: 'pdf' | 'html' | 'json' | 'pptx';
  includeNotes?: boolean;
  includeAnimations?: boolean;
  quality?: 'standard' | 'high';
}

interface IJSZip {
  file(name: string, data: string): this;
  folder(name: string): this | null;
  generateAsync(options: Record<string, unknown>): Promise<Buffer>;
}

interface ExportBlock {
  blockType: string;
  content: unknown;
  style?: Record<string, unknown>;
  order: number;
}

interface ExportSlide {
  layout: string;
  order: number;
  blocks: ExportBlock[];
}

interface ExportTheme {
  colors?: {
    primary?: string;
    secondary?: string;
    background?: string;
    surface?: string;
    text?: string;
    textMuted?: string;
    accent?: string;
  };
  fonts?: {
    heading?: string;
    body?: string;
  };
}

interface ExportProject {
  title: string;
  description: string | null;
  type: string;
  theme: ExportTheme | null;
  slides: ExportSlide[];
  blocks: ExportBlock[];
}

interface ExportResult {
  filename: string;
  mimeType: string;
  data: string | Buffer;
}

interface PptxSlideElement {
  elementType: string;
  text?: string | Record<string, unknown>[];
  options: Record<string, unknown>;
  type: string;
  order: number;
  style?: Record<string, unknown>;
  path?: string;
  chartType?: string;
  data?: unknown[];
}

interface PptxSlide {
  slideNumber: number;
  layout: string;
  elements: PptxSlideElement[];
}

interface PptxData {
  title: string;
  description: string | null;
  theme: {
    colors?: Record<string, string | undefined>;
    fonts?: Record<string, string | undefined>;
  };
  slides: PptxSlide[];
  metadata: {
    creator: string;
    lastModifiedBy: string;
    revision: number;
    createdAt: string;
    modifiedAt: string;
  };
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Check if user can export (premium feature)
   */
  async canExport(userId: string): Promise<boolean> {
    const subscription = await this.usersService.getSubscription(userId);
    return subscription.plan !== SubscriptionPlan.FREE;
  }

  /**
   * Public export methods for testing and API
   */
  async exportToJSON(projectId: string): Promise<Record<string, unknown>> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        slides: {
          include: {
            blocks: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
        blocks: {
          orderBy: { order: 'asc' },
        },
        theme: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const exportData = project as unknown as ExportProject;
    const result = this.exportToJson(exportData);
    return JSON.parse(result.data as string);
  }

  async exportToHTML(projectId: string): Promise<string> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        slides: {
          include: {
            blocks: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
        blocks: {
          orderBy: { order: 'asc' },
        },
        theme: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const exportData = project as unknown as ExportProject;
    const result = this.exportToHtml(exportData);
    return result.data as string;
  }

  async exportToPDF(
    projectId: string,
    // _options?: ExportOptions,
  ): Promise<Buffer> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        slides: {
          include: {
            blocks: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
        blocks: {
          orderBy: { order: 'asc' },
        },
        theme: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const exportData = project as unknown as ExportProject;
    const result = await this.exportToPdf(exportData);
    return Buffer.from(result.data as string, 'utf-8');
  }

  async exportToPPTX(
    projectId: string,
    // _options?: ExportOptions,
  ): Promise<Buffer> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        slides: {
          include: {
            blocks: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
        blocks: {
          orderBy: { order: 'asc' },
        },
        theme: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const exportData = project as unknown as ExportProject;
    const result = await this.exportToPptx(exportData);
    return result.data as Buffer;
  }

  /**
   * Export project to specified format
   */
  async exportProject(
    userId: string,
    projectId: string,
    options: ExportOptions,
  ): Promise<ExportResult> {
    // Check export permissions
    const canExport = await this.canExport(userId);
    if (!canExport) {
      throw new ForbiddenException(
        'Export is a premium feature. Please upgrade.',
      );
    }

    // Get project with all data
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        slides: {
          include: {
            blocks: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
        blocks: {
          orderBy: { order: 'asc' },
        },
        theme: true,
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException('You cannot export this project');
    }

    const exportData = project as unknown as ExportProject;

    switch (options.format) {
      case 'json':
        return this.exportToJson(exportData);
      case 'html':
        return this.exportToHtml(exportData);
      case 'pdf':
        return await this.exportToPdf(exportData);
      case 'pptx':
        return await this.exportToPptx(exportData);
      default:
        throw new Error('Unsupported export format');
    }
  }

  /**
   * Export to JSON format
   */
  /**
   * Export to JSON format
   */
  private exportToJson(project: ExportProject): ExportResult {
    const data = {
      title: project.title,
      description: project.description,
      type: project.type,
      theme: project.theme,
      blocks: (project.blocks || []).map((block: ExportBlock) => ({
        type: block.blockType,
        content: block.content as Record<string, unknown>,
        style: block.style as Record<string, unknown>,
        order: block.order,
      })),
      slides: (project.slides || []).map((slide: ExportSlide) => ({
        layout: slide.layout,
        order: slide.order,
        blocks: (slide.blocks || []).map((block: ExportBlock) => ({
          type: block.blockType,
          content: block.content as Record<string, unknown>,
          style: block.style as Record<string, unknown>,
          order: block.order,
        })),
      })),
      exportedAt: new Date().toISOString(),
    };

    return {
      filename: `${this.sanitizeFilename(project.title)}.json`,
      mimeType: 'application/json',
      data: JSON.stringify(data, null, 2),
    };
  }

  /**
   * Export to HTML format
   */
  private exportToHtml(project: ExportProject): ExportResult {
    const theme = project.theme || this.getDefaultTheme();

    const slidesHtml = (project.slides || [])
      .map((slide: ExportSlide, index: number) => {
        const blocksHtml = (slide.blocks || [])
          .map((block: ExportBlock) => {
            return this.renderBlockToHtml(block, theme);
          })
          .join('\n');

        return `
        <section class="slide" data-slide="${index + 1}">
          ${blocksHtml}
        </section>
      `;
      })
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(project.title)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: ${theme.fonts?.body || 'Inter'}, -apple-system, BlinkMacSystemFont, sans-serif;
      background: ${theme.colors?.background || '#ffffff'};
      color: ${theme.colors?.text || '#1e293b'};
      line-height: 1.6;
    }
    
    .slide {
      min-height: 100vh;
      padding: 4rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
      page-break-after: always;
    }
    
    h1, h2, h3 {
      font-family: ${theme.fonts?.heading || 'Inter'}, -apple-system, BlinkMacSystemFont, sans-serif;
      color: ${theme.colors?.primary || '#3b82f6'};
      margin-bottom: 1.5rem;
    }
    
    h1 { font-size: 3rem; font-weight: 700; }
    h2 { font-size: 2.25rem; font-weight: 600; }
    h3 { font-size: 1.5rem; font-weight: 600; }
    
    p {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      color: ${theme.colors?.text || '#1e293b'};
    }
    
    ul, ol {
      font-size: 1.25rem;
      margin-left: 2rem;
      margin-bottom: 1rem;
    }
    
    li {
      margin-bottom: 0.5rem;
    }
    
    blockquote {
      font-size: 1.5rem;
      font-style: italic;
      border-left: 4px solid ${theme.colors?.accent || '#f59e0b'};
      padding-left: 1.5rem;
      margin: 2rem 0;
      color: ${theme.colors?.textMuted || '#64748b'};
    }
    
    code {
      background: ${theme.colors?.surface || '#f8fafc'};
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-family: 'Fira Code', monospace;
    }
    
    pre {
      background: ${theme.colors?.surface || '#f8fafc'};
      padding: 1.5rem;
      border-radius: 0.5rem;
      overflow-x: auto;
      margin-bottom: 1rem;
    }
    
    @media print {
      .slide {
        page-break-after: always;
        min-height: auto;
        padding: 2rem;
      }
    }
  </style>
</head>
<body>
  ${slidesHtml}
</body>
</html>`;

    return {
      filename: `${this.sanitizeFilename(project.title)}.html`,
      mimeType: 'text/html',
      data: html,
    };
  }

  /**
   * Export to PDF format using pdf-lib
   * Creates a proper multi-page PDF with slides
   */
  private async exportToPdf(project: ExportProject): Promise<ExportResult> {
    const pdfDoc = await PDFDocument.create();
    const theme = project.theme || this.getDefaultTheme();
    const themeColors = (theme.colors || {}) as Record<string, string>;

    // Embed fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Process each slide
    for (const slide of project.slides || []) {
      // Create a 16:9 aspect ratio page (landscape)
      const page = pdfDoc.addPage([1280, 720]);
      const { width, height } = page.getSize();

      // Draw background
      const bgColor = this.hexToRgb(themeColors.background || '#ffffff');
      page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height,
        color: rgb(bgColor.r / 255, bgColor.g / 255, bgColor.b / 255),
      });

      // Draw blocks
      let yOffset = height - 60; // Start from top with margin

      for (const block of slide.blocks || []) {
        const content = this.getBlockTextContent(block);
        const textColor = this.hexToRgb(themeColors.text || '#000000');

        switch (block.blockType) {
          case 'heading':
          case 'HEADING':
            page.drawText(content, {
              x: 60,
              y: yOffset,
              size: 36,
              font: helveticaBold,
              color: rgb(
                textColor.r / 255,
                textColor.g / 255,
                textColor.b / 255,
              ),
              maxWidth: width - 120,
            });
            yOffset -= 60;
            break;

          case 'subheading':
          case 'SUBHEADING':
            page.drawText(content, {
              x: 60,
              y: yOffset,
              size: 24,
              font: helveticaBold,
              color: rgb(
                textColor.r / 255,
                textColor.g / 255,
                textColor.b / 255,
              ),
              maxWidth: width - 120,
            });
            yOffset -= 45;
            break;

          case 'paragraph':
          case 'PARAGRAPH':
          case 'text':
          case 'TEXT': {
            // Word wrap for paragraphs
            const lines = this.wrapText(content, 100);
            for (const line of lines) {
              if (yOffset < 60) break;
              page.drawText(line, {
                x: 60,
                y: yOffset,
                size: 16,
                font: helveticaFont,
                color: rgb(
                  textColor.r / 255,
                  textColor.g / 255,
                  textColor.b / 255,
                ),
              });
              yOffset -= 24;
            }
            yOffset -= 10;
            break;
          }

          case 'bullet_list':
          case 'BULLET_LIST':
          case 'list':
          case 'LIST': {
            const items = this.getListItems(block);
            for (const item of items) {
              if (yOffset < 60) break;
              page.drawText(`• ${item}`, {
                x: 80,
                y: yOffset,
                size: 16,
                font: helveticaFont,
                color: rgb(
                  textColor.r / 255,
                  textColor.g / 255,
                  textColor.b / 255,
                ),
                maxWidth: width - 140,
              });
              yOffset -= 28;
            }
            yOffset -= 10;
            break;
          }

          default:
            if (content) {
              page.drawText(content, {
                x: 60,
                y: yOffset,
                size: 16,
                font: helveticaFont,
                color: rgb(
                  textColor.r / 255,
                  textColor.g / 255,
                  textColor.b / 255,
                ),
                maxWidth: width - 120,
              });
              yOffset -= 30;
            }
        }
      }

      // Add slide number
      page.drawText(`${(slide.order || 0) + 1}`, {
        x: width - 60,
        y: 30,
        size: 12,
        font: helveticaFont,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();

    return {
      filename: `${this.sanitizeFilename(project.title)}.pdf`,
      mimeType: 'application/pdf',
      data: Buffer.from(pdfBytes),
    };
  }

  /**
   * Helper to convert hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      };
    }
    return { r: 0, g: 0, b: 0 };
  }

  /**
   * Helper to wrap text for PDF
   */
  private wrapText(text: string, maxCharsPerLine: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    return lines;
  }

  /**
   * Helper to get list items from block
   */
  private getListItems(block: ExportBlock): string[] {
    const content = block.content as Record<string, unknown>;
    if (Array.isArray(content?.items)) {
      return content.items.map((item: unknown) =>
        typeof item === 'string'
          ? item
          : ((item as Record<string, unknown>)?.text as string) || '',
      );
    }
    if (typeof content?.text === 'string') {
      return content.text.split('\n').filter(Boolean);
    }
    return [];
  }

  /**
   * Helper to get text content from block
   */
  private getBlockTextContent(block: ExportBlock): string {
    const content = block.content as Record<string, unknown>;
    if (typeof content === 'string') return content;
    if (typeof content?.text === 'string') return content.text;
    if (typeof content?.content === 'string') return content.content;
    return '';
  }

  /**
   * Export to PowerPoint (PPTX) format
   * Production-ready implementation using pptxgenjs
   */
  private async exportToPptx(project: ExportProject): Promise<ExportResult> {
    const theme = project.theme || this.getDefaultTheme();
    const themeColors = (theme.colors || {}) as Record<string, string>;

    // Create new presentation
    const pptx = new PptxGenJS();

    // Set presentation properties
    pptx.author = 'Presentation Designer';
    pptx.title = project.title || 'Untitled Presentation';
    pptx.subject = project.description || '';
    pptx.company = 'Presentation Designer';

    // Set layout to 16:9
    pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 });
    pptx.layout = 'WIDE';

    // Process each slide
    for (const slide of project.slides || []) {
      const pptxSlide = pptx.addSlide();

      // Set background color
      if (themeColors.background) {
        pptxSlide.background = {
          color: themeColors.background.replace('#', ''),
        };
      }

      let yPosition = 0.5; // Start position in inches

      for (const block of slide.blocks || []) {
        const content = this.getBlockTextContent(block);
        const textColor = (themeColors.text || '#000000').replace('#', '');

        switch (block.blockType) {
          case 'heading':
          case 'HEADING':
            pptxSlide.addText(content, {
              x: 0.5,
              y: yPosition,
              w: 12.333,
              h: 0.8,
              fontSize: 36,
              fontFace: 'Arial',
              color: textColor,
              bold: true,
            });
            yPosition += 1;
            break;

          case 'subheading':
          case 'SUBHEADING':
            pptxSlide.addText(content, {
              x: 0.5,
              y: yPosition,
              w: 12.333,
              h: 0.6,
              fontSize: 24,
              fontFace: 'Arial',
              color: textColor,
              bold: true,
            });
            yPosition += 0.8;
            break;

          case 'paragraph':
          case 'PARAGRAPH':
          case 'text':
          case 'TEXT':
            pptxSlide.addText(content, {
              x: 0.5,
              y: yPosition,
              w: 12.333,
              h: 1,
              fontSize: 16,
              fontFace: 'Arial',
              color: textColor,
              valign: 'top',
            });
            yPosition += 1.2;
            break;

          case 'bullet_list':
          case 'BULLET_LIST':
          case 'list':
          case 'LIST': {
            const items = this.getListItems(block);
            const textProps = items.map((item) => ({
              text: item,
              options: { bullet: true, color: textColor, fontSize: 16 },
            }));
            pptxSlide.addText(textProps, {
              x: 0.5,
              y: yPosition,
              w: 12.333,
              h: items.length * 0.4,
              fontFace: 'Arial',
              valign: 'top',
            });
            yPosition += items.length * 0.4 + 0.3;
            break;
          }

          case 'image':
          case 'IMAGE': {
            const imageContent = block.content as Record<string, unknown>;
            const imageUrl = imageContent?.url || imageContent?.src;
            if (typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
              try {
                pptxSlide.addImage({
                  path: imageUrl,
                  x: 0.5,
                  y: yPosition,
                  w: 6,
                  h: 4,
                });
                yPosition += 4.2;
              } catch {
                this.logger.warn(`Failed to add image: ${imageUrl}`);
              }
            }
            break;
          }

          default:
            if (content) {
              pptxSlide.addText(content, {
                x: 0.5,
                y: yPosition,
                w: 12.333,
                h: 0.5,
                fontSize: 14,
                fontFace: 'Arial',
                color: textColor,
              });
              yPosition += 0.6;
            }
        }
      }

      // Add slide number
      pptxSlide.addText(String((slide.order || 0) + 1), {
        x: 12.5,
        y: 7,
        w: 0.5,
        h: 0.3,
        fontSize: 10,
        color: '808080',
        align: 'right',
      });
    }

    // Generate PPTX buffer
    const pptxBuffer = (await pptx.write({
      outputType: 'nodebuffer',
    })) as Buffer;

    return {
      filename: `${this.sanitizeFilename(project.title)}.pptx`,
      mimeType:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      data: pptxBuffer,
    };
  }

  /**
   * Convert block to PPTX element format
   */
  private convertBlockToPptxElement(
    block: ExportBlock,
    theme: ExportTheme,
  ): PptxSlideElement {
    const blockContent = block.content as Record<string, unknown> | undefined;
    const content = (
      (blockContent?.text as string) ||
      (typeof block.content === 'string' ? block.content : '') ||
      ''
    ).toString();

    const baseElement = {
      type: block.blockType,
      order: block.order,

      style: block.style as Record<string, unknown>,
    };

    switch (block.blockType) {
      case 'HEADING':
        return {
          ...baseElement,
          elementType: 'text',
          text: content,
          options: {
            x: 0.5,
            y: 0.5,
            w: 9,
            h: 1,
            fontSize: 44,
            fontFace: theme.fonts?.heading || 'Arial',
            color: theme.colors?.primary?.replace('#', '') || '3b82f6',
            bold: true,
          },
        };
      case 'SUBHEADING':
        return {
          ...baseElement,
          elementType: 'text',
          text: content,
          options: {
            x: 0.5,
            y: 1.5,
            w: 9,
            h: 0.8,
            fontSize: 28,
            fontFace: theme.fonts?.heading || 'Arial',
            color: theme.colors?.text?.replace('#', '') || '1e293b',
            bold: true,
          },
        };
      case 'PARAGRAPH':
        return {
          ...baseElement,
          elementType: 'text',
          text: content,
          options: {
            x: 0.5,
            y: 2.5,
            w: 9,
            h: 2,
            fontSize: 18,
            fontFace: theme.fonts?.body || 'Arial',
            color: theme.colors?.text?.replace('#', '') || '1e293b',
          },
        };
      case 'BULLET_LIST':
        return {
          ...baseElement,
          elementType: 'text',
          text: content.split('\n').map((line) => ({
            text: line,
            options: { bullet: true },
          })),
          options: {
            x: 0.5,
            y: 2.5,
            w: 9,
            h: 3,
            fontSize: 18,
            fontFace: theme.fonts?.body || 'Arial',
            color: theme.colors?.text?.replace('#', '') || '1e293b',
          },
        };
      case 'NUMBERED_LIST':
        return {
          ...baseElement,
          elementType: 'text',
          text: content.split('\n').map((line, idx: number) => ({
            text: `${idx + 1}. ${line}`,
          })),
          options: {
            x: 0.5,
            y: 2.5,
            w: 9,
            h: 3,
            fontSize: 18,
            fontFace: theme.fonts?.body || 'Arial',
          },
        };
      case 'IMAGE':
        return {
          ...baseElement,
          elementType: 'image',
          path: (blockContent?.url as string) || content,
          options: {
            x: 1,
            y: 1.5,
            w: 8,
            h: 4.5,
          },
        };
      case 'CHART':
        return {
          ...baseElement,
          elementType: 'chart',
          chartType: (blockContent?.chartType as string) || 'bar',
          data: (blockContent?.chartData as unknown[]) || [],
          options: {
            x: 1,
            y: 1.5,
            w: 8,
            h: 4,
          },
        };
      case 'QUOTE':
        return {
          ...baseElement,
          elementType: 'text',
          text: `"${content}"`,
          options: {
            x: 1,
            y: 2,
            w: 8,
            h: 2,
            fontSize: 24,
            fontFace: theme.fonts?.body || 'Arial',
            italic: true,
            color: theme.colors?.textMuted?.replace('#', '') || '64748b',
          },
        };
      default:
        return {
          ...baseElement,
          elementType: 'text',
          text: content,
          options: {
            x: 0.5,
            y: 2.5,
            w: 9,
            h: 2,
            fontSize: 18,
          },
        };
    }
  }

  /**
   * Generate actual PPTX buffer using Office Open XML
   * This creates a valid PPTX file structure
   */
  private async generatePptxBuffer(
    pptxData: PptxData,
    theme: ExportTheme,
  ): Promise<Buffer> {
    // Create PPTX structure - Office Open XML format
    // PPTX is a ZIP file containing XML files

    const zip = new ZipAdapter() as unknown as IJSZip;

    // [Content_Types].xml
    zip.file(
      '[Content_Types].xml',
      this.generateContentTypes(pptxData.slides.length),
    );

    // _rels/.rels
    zip.folder('_rels')!.file('.rels', this.generateRootRels());

    // docProps/
    const docProps = zip.folder('docProps')!;
    docProps.file('app.xml', this.generateAppXml(pptxData));
    docProps.file('core.xml', this.generateCoreXml(pptxData));

    // ppt/
    const ppt = zip.folder('ppt')!;
    ppt.file(
      'presentation.xml',
      this.generatePresentationXml(pptxData.slides.length),
    );
    ppt.file('presProps.xml', this.generatePresPropsXml());
    ppt.file('tableStyles.xml', this.generateTableStylesXml());
    ppt.file('viewProps.xml', this.generateViewPropsXml());

    // ppt/_rels/
    const pptRels = ppt.folder('_rels')!;
    pptRels.file(
      'presentation.xml.rels',
      this.generatePresentationRels(pptxData.slides.length),
    );

    // ppt/slideLayouts/
    const slideLayouts = ppt.folder('slideLayouts')!;
    slideLayouts.file('slideLayout1.xml', this.generateSlideLayout());
    const slideLayoutRels = slideLayouts.folder('_rels')!;
    slideLayoutRels.file(
      'slideLayout1.xml.rels',
      this.generateSlideLayoutRels(),
    );

    // ppt/slideMasters/
    const slideMasters = ppt.folder('slideMasters')!;
    slideMasters.file('slideMaster1.xml', this.generateSlideMaster(theme));
    const slideMasterRels = slideMasters.folder('_rels')!;
    slideMasterRels.file(
      'slideMaster1.xml.rels',
      this.generateSlideMasterRels(),
    );

    // ppt/theme/
    const themeFolder = ppt.folder('theme')!;
    themeFolder.file('theme1.xml', this.generateThemeXml(theme));

    // ppt/slides/
    const slides = ppt.folder('slides')!;
    const slidesRels = slides.folder('_rels')!;

    pptxData.slides.forEach((slide, index: number) => {
      slides.file(`slide${index + 1}.xml`, this.generateSlideXml(slide, theme));
      slidesRels.file(`slide${index + 1}.xml.rels`, this.generateSlideRels());
    });

    // Generate the PPTX file
    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    return buffer;
  }

  // PPTX XML Generation Methods

  private generateContentTypes(slideCount: number): string {
    const slideEntries = Array.from(
      { length: slideCount },
      (_, i) =>
        `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
    ).join('\n');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>
  <Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>
  <Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  ${slideEntries}
</Types>`;
  }

  private generateRootRels(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
  }

  private generateAppXml(pptxData: PptxData): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Presentation Designer</Application>
  <Slides>${pptxData.slides.length}</Slides>
  <Company>Presentation Designer</Company>
</Properties>`;
  }

  private generateCoreXml(pptxData: PptxData): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" 
                   xmlns:dc="http://purl.org/dc/elements/1.1/" 
                   xmlns:dcterms="http://purl.org/dc/terms/">
  <dc:title>${this.escapeXml(pptxData.title)}</dc:title>
  <dc:creator>${pptxData.metadata.creator}</dc:creator>
  <cp:lastModifiedBy>${pptxData.metadata.lastModifiedBy}</cp:lastModifiedBy>
  <dcterms:created>${pptxData.metadata.createdAt}</dcterms:created>
  <dcterms:modified>${pptxData.metadata.modifiedAt}</dcterms:modified>
</cp:coreProperties>`;
  }

  private generatePresentationXml(slideCount: number): string {
    const slideIdList = Array.from(
      { length: slideCount },
      (_, i) => `<p:sldId id="${256 + i}" r:id="rId${2 + i}"/>`,
    ).join('\n');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" 
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" 
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
    ${slideIdList}
  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
  }

  private generatePresentationRels(slideCount: number): string {
    const slideRels = Array.from(
      { length: slideCount },
      (_, i) =>
        `<Relationship Id="rId${2 + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`,
    ).join('\n');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${slideRels}
  <Relationship Id="rId${2 + slideCount}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/>
  <Relationship Id="rId${3 + slideCount}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/>
  <Relationship Id="rId${4 + slideCount}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
  <Relationship Id="rId${5 + slideCount}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/>
</Relationships>`;
  }

  private generatePresPropsXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentationPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`;
  }

  private generateViewPropsXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:viewPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr>
</p:viewPr>`;
  }

  private generateTableStylesXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`;
  }

  private generateSlideLayout(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" 
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" 
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
</p:sldLayout>`;
  }

  private generateSlideLayoutRels(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
  }

  private generateSlideMaster(theme: ExportTheme): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" 
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" 
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:solidFill><a:srgbClr val="${(theme.colors?.background || '#ffffff').replace('#', '')}"/></a:solidFill>
      </p:bgPr>
    </p:bg>
    <p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rId1"/>
  </p:sldLayoutIdLst>
</p:sldMaster>`;
  }

  private generateSlideMasterRels(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;
  }

  private generateThemeXml(theme: ExportTheme): string {
    const primary = (theme.colors?.primary || '#3b82f6').replace('#', '');
    const secondary = (theme.colors?.secondary || '#8b5cf6').replace('#', '');
    const accent = (theme.colors?.accent || '#f59e0b').replace('#', '');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Presentation Designer Theme">
  <a:themeElements>
    <a:clrScheme name="Custom">
      <a:dk1><a:srgbClr val="1e293b"/></a:dk1>
      <a:lt1><a:srgbClr val="ffffff"/></a:lt1>
      <a:dk2><a:srgbClr val="64748b"/></a:dk2>
      <a:lt2><a:srgbClr val="f8fafc"/></a:lt2>
      <a:accent1><a:srgbClr val="${primary}"/></a:accent1>
      <a:accent2><a:srgbClr val="${secondary}"/></a:accent2>
      <a:accent3><a:srgbClr val="${accent}"/></a:accent3>
      <a:accent4><a:srgbClr val="10b981"/></a:accent4>
      <a:accent5><a:srgbClr val="ef4444"/></a:accent5>
      <a:accent6><a:srgbClr val="06b6d4"/></a:accent6>
      <a:hlink><a:srgbClr val="${primary}"/></a:hlink>
      <a:folHlink><a:srgbClr val="${secondary}"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Custom">
      <a:majorFont><a:latin typeface="${theme.fonts?.heading || 'Arial'}"/></a:majorFont>
      <a:minorFont><a:latin typeface="${theme.fonts?.body || 'Arial'}"/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Custom">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`;
  }

  private generateSlideXml(slide: PptxSlide, theme: ExportTheme): string {
    const elements = slide.elements
      .map((el, idx: number) => this.generateSlideElement(el, idx + 2, theme))
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" 
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" 
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      ${elements}
    </p:spTree>
  </p:cSld>
</p:sld>`;
  }

  private generateSlideElement(
    element: PptxSlideElement,
    id: number,
    theme: ExportTheme,
  ): string {
    if (element.elementType === 'image') {
      return ''; // Images require additional handling with relationships
    }

    const text =
      typeof element.text === 'string'
        ? element.text
        : Array.isArray(element.text)
          ? element.text
              .map((t) => (typeof t === 'string' ? t : t.text))
              .join('\n')
          : '';

    const opts = element.options as Record<string, number | string>;
    const x = Math.round(((opts.x as number) || 0.5) * 914400);
    const y = Math.round(((opts.y as number) || 0.5) * 914400);
    const w = Math.round(((opts.w as number) || 9) * 914400);
    const h = Math.round(((opts.h as number) || 1) * 914400);
    const fontSize = ((opts.fontSize as number) || 18) * 100;
    const fontFace = (opts.fontFace as string) || theme.fonts?.body || 'Arial';
    const color =
      (opts.color as string) ||
      (theme.colors?.text || '#1e293b').replace('#', '');
    const bold = opts.bold ? '<a:b val="true"/>' : '';
    const italic = opts.italic ? '<a:i val="true"/>' : '';

    return `<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${id}" name="TextBox ${id}"/>
    <p:cNvSpPr txBox="1"/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
  </p:spPr>
  <p:txBody>
    <a:bodyPr/>
    <a:lstStyle/>
    <a:p>
      <a:r>
        <a:rPr lang="en-US" sz="${fontSize}" ${bold} ${italic}>
          <a:solidFill><a:srgbClr val="${color}"/></a:solidFill>
          <a:latin typeface="${fontFace}"/>
        </a:rPr>
        <a:t>${this.escapeXml(text)}</a:t>
      </a:r>
    </a:p>
  </p:txBody>
</p:sp>`;
  }

  private generateSlideRels(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Render a block to HTML
   */
  private renderBlockToHtml(block: ExportBlock, theme: ExportTheme): string {
    const blockContent = block.content as Record<string, unknown> | undefined;

    switch (block.blockType) {
      case 'HEADING':
      case 'SUBHEADING':
      case 'PARAGRAPH': {
        const text = (blockContent?.text as string) || '';
        return block.blockType === 'HEADING'
          ? `<h1>${this.escapeHtml(text)}</h1>`
          : block.blockType === 'SUBHEADING'
            ? `<h2>${this.escapeHtml(text)}</h2>`
            : `<p>${this.escapeHtml(text)}</p>`;
      }
      case 'BULLET_LIST': {
        const items = (blockContent?.items as string[]) || [];
        return `<ul>${items.map((item) => `<li>${this.escapeHtml(item)}</li>`).join('')}</ul>`;
      }
      case 'NUMBERED_LIST': {
        const items = (blockContent?.items as string[]) || [];
        return `<ol>${items.map((item) => `<li>${this.escapeHtml(item)}</li>`).join('')}</ol>`;
      }
      case 'QUOTE': {
        const quoteText = (blockContent?.text as string) || '';
        return `<blockquote>${this.escapeHtml(quoteText)}</blockquote>`;
      }
      case 'CODE': {
        const codeText = (blockContent?.text as string) || '';
        return `<pre><code>${this.escapeHtml(codeText)}</code></pre>`;
      }
      case 'IMAGE': {
        const imageUrl = (blockContent?.url as string) || '';
        const imageAlt = (blockContent?.alt as string) || '';
        return `<img src="${this.escapeHtml(imageUrl)}" alt="${this.escapeHtml(imageAlt)}" style="max-width: 100%;" />`;
      }
      case 'DIVIDER':
        return `<hr style="border: none; border-top: 1px solid ${theme.colors?.textMuted || '#ccc'}; margin: 2rem 0;" />`;
      default: {
        const defaultText = (blockContent?.text as string) || '';
        return `<p>${this.escapeHtml(defaultText)}</p>`;
      }
    }
  }

  /**
   * Get default theme
   */
  private getDefaultTheme(): ExportTheme {
    return {
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        background: '#ffffff',
        surface: '#f8fafc',
        text: '#1e293b',
        textMuted: '#64748b',
        accent: '#f59e0b',
      },
      fonts: {
        heading: 'Inter',
        body: 'Inter',
      },
    };
  }

  /**
   * Sanitize filename
   */
  private sanitizeFilename(name: string): string {
    const sanitized = name
      .replace(/[^a-z0-9\s-]/gi, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50);
    return sanitized || 'untitled';
  }

  /**
   * Escape HTML entities
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }
}
