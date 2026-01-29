import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { SubscriptionPlan } from '@prisma/client';

// Types for export
interface ExportOptions {
  format: 'pdf' | 'html' | 'json';
  includeNotes?: boolean;
}

interface ExportBlock {
  blockType: string;
  content: any;
  style?: any;
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
}

interface ExportResult {
  filename: string;
  mimeType: string;
  data: string | Buffer;
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
        return this.exportToPdf(exportData);
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
      slides: (project.slides || []).map((slide: ExportSlide) => ({
        layout: slide.layout,
        order: slide.order,
        blocks: (slide.blocks || []).map((block: ExportBlock) => ({
          type: block.blockType,
          content: block.content,
          style: block.style,
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
   * Export to PDF format
   * In production, use a proper PDF generation library like Puppeteer or wkhtmltopdf
   */
  private exportToPdf(project: ExportProject): ExportResult {
    // Generate HTML first
    const htmlExport = this.exportToHtml(project);

    // For now, return HTML with instructions to print as PDF
    // In production, integrate with a PDF generation service
    this.logger.warn(
      'PDF export falling back to HTML - integrate PDF service for production',
    );

    return {
      filename: `${this.sanitizeFilename(project.title)}.html`,
      mimeType: 'text/html',
      data: htmlExport.data,
    };
  }

  /**
   * Render a block to HTML
   */
  private renderBlockToHtml(block: ExportBlock, theme: ExportTheme): string {
    const content = block.content?.text || '';

    switch (block.blockType) {
      case 'HEADING':
        return `<h1>${this.escapeHtml(content)}</h1>`;
      case 'SUBHEADING':
        return `<h2>${this.escapeHtml(content)}</h2>`;
      case 'PARAGRAPH':
        return `<p>${this.escapeHtml(content)}</p>`;
      case 'BULLET_LIST': {
        const bullets = content.split('\n').filter(Boolean);
        return `<ul>${bullets.map((b: string) => `<li>${this.escapeHtml(b)}</li>`).join('')}</ul>`;
      }
      case 'NUMBERED_LIST': {
        const items = content.split('\n').filter(Boolean);
        return `<ol>${items.map((i: string) => `<li>${this.escapeHtml(i)}</li>`).join('')}</ol>`;
      }
      case 'QUOTE':
        return `<blockquote>${this.escapeHtml(content)}</blockquote>`;
      case 'CODE':
        return `<pre><code>${this.escapeHtml(content)}</code></pre>`;
      case 'IMAGE': {
        const imageUrl = block.content?.url || '';
        return `<img src="${this.escapeHtml(imageUrl)}" alt="${this.escapeHtml(block.content?.alt || '')}" style="max-width: 100%;" />`;
      }
      case 'DIVIDER':
        return `<hr style="border: none; border-top: 1px solid ${theme.colors?.textMuted || '#ccc'}; margin: 2rem 0;" />`;
      default:
        return `<p>${this.escapeHtml(content)}</p>`;
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
    return name
      .replace(/[^a-z0-9\s-]/gi, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50);
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
