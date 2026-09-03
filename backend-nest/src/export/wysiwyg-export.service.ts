import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { isGenericKicker } from '../ai/slide-recipes';

/**
 * WysiwygExportService
 *
 * Generates a self-contained HTML representation of a presentation
 * that can be rendered in a headless browser (Puppeteer/Playwright)
 * to produce pixel-perfect PDF/PNG/PPTX exports matching what users
 * see in the browser editor.
 *
 * This works by:
 * 1. Fetching the full project data (slides + blocks + theme)
 * 2. Generating a self-contained HTML document that replicates the editor canvas
 * 3. Each slide is rendered as a 1280x720 section, matching the 16:9 aspect ratio
 * 4. The HTML can be fed to Puppeteer for screenshot-per-slide → high-fidelity PDF
 */

interface WysiwygBlock {
  blockType: string;
  content: Record<string, unknown>;
  style?: Record<string, unknown>;
  order: number;
}

interface WysiwygSlide {
  id: string;
  layout: string;
  order: number;
  blocks: WysiwygBlock[];
  background?: string;
  transition?: Record<string, unknown>;
}

interface WysiwygTheme {
  colors?: Record<string, string>;
  fonts?: Record<string, string>;
}

interface WysiwygProject {
  title: string;
  description: string | null;
  slides: WysiwygSlide[];
  theme: WysiwygTheme | null;
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

@Injectable()
export class WysiwygExportService {
  private readonly logger = new Logger(WysiwygExportService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Generate a full WYSIWYG HTML document for a project.
   * Each slide is a 1280x720 fixed-dimension section.
   * This HTML is self-contained and can be opened in any browser or
   * fed to Puppeteer for pixel-perfect screenshots.
   */
  async generateWysiwygHtml(projectId: string): Promise<string> {
    const project = await this.fetchProject(projectId);
    const theme = this.normalizeTheme(project.theme);
    const imageMap = await this.prefetchImages(project.slides || []);

    const slidesHtml = (project.slides || [])
      .sort((a, b) => a.order - b.order)
      .map((slide, index) =>
        this.renderSlideHtml(slide, theme, index, imageMap),
      )
      .join('\n');

    return this.wrapInFullDocument(project.title, theme, slidesHtml);
  }

  /**
   * Generate an array of per-slide HTML pages
   * (useful for Puppeteer to screenshot each individually)
   */
  async generatePerSlideHtml(
    projectId: string,
  ): Promise<{ slideIndex: number; html: string }[]> {
    const project = await this.fetchProject(projectId);
    const theme = this.normalizeTheme(project.theme);
    const imageMap = await this.prefetchImages(project.slides || []);

    return (project.slides || [])
      .sort((a, b) => a.order - b.order)
      .map((slide, index) => ({
        slideIndex: index,
        html: this.wrapInFullDocument(
          `${project.title} - Slide ${index + 1}`,
          theme,
          this.renderSlideHtml(slide, theme, index, imageMap),
        ),
      }));
  }

  private async fetchProject(projectId: string): Promise<WysiwygProject> {
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
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project as unknown as WysiwygProject;
  }

  private async prefetchImages(
    slides: WysiwygSlide[],
  ): Promise<Map<string, string>> {
    const urls = new Set<string>();
    for (const slide of slides) {
      for (const block of slide.blocks || []) {
        const content = block.content || {};
        const url = asString(content.url) || asString(content.src);
        if (/^https?:\/\//i.test(url)) urls.add(url);
      }
    }
    const imageMap = new Map<string, string>();
    await Promise.all(
      [...urls].map(async (url) => {
        try {
          const response = await axios.get<ArrayBuffer>(url, {
            responseType: 'arraybuffer',
            timeout: 12_000,
            maxRedirects: 5,
            headers: { Accept: 'image/*' },
          });
          const mime =
            String(response.headers['content-type'] || 'image/jpeg').split(
              ';',
            )[0] || 'image/jpeg';
          imageMap.set(
            url,
            `data:${mime};base64,${Buffer.from(response.data).toString('base64')}`,
          );
        } catch (error) {
          this.logger.warn(
            `Could not inline image ${url}: ${(error as Error).message}`,
          );
        }
      }),
    );
    return imageMap;
  }

  private isGenericKicker(text: string): boolean {
    return isGenericKicker(text);
  }

  private normalizeTheme(theme: WysiwygTheme | null): Required<WysiwygTheme> {
    return {
      colors: {
        primary: theme?.colors?.primary || '#6366f1',
        secondary: theme?.colors?.secondary || '#8b5cf6',
        background: theme?.colors?.background || '#0f172a',
        surface: theme?.colors?.surface || '#1e293b',
        text: theme?.colors?.text || '#f1f5f9',
        textMuted: theme?.colors?.textMuted || '#94a3b8',
        accent: theme?.colors?.accent || '#f59e0b',
      },
      fonts: {
        heading: theme?.fonts?.heading || 'Source Serif 4',
        body: theme?.fonts?.body || 'Source Sans 3',
      },
    };
  }

  /**
   * Render a single slide as an HTML section
   */
  private renderSlideHtml(
    slide: WysiwygSlide,
    theme: Required<WysiwygTheme>,
    slideIndex: number,
    imageMap: Map<string, string> = new Map(),
  ): string {
    const blocks = (slide.blocks || []).sort((a, b) => a.order - b.order);
    const blocksHtml = this.renderLayoutBlocks(
      blocks,
      theme,
      slide.layout,
      imageMap,
    );

    const bgColor = slide.background || theme.colors.background;

    return `
      <section class="slide" data-slide-index="${slideIndex}" style="background: ${bgColor};">
        <div class="slide-content layout-${slide.layout || 'content'}">
          ${blocksHtml}
        </div>
        <div class="slide-number">${slideIndex + 1}</div>
      </section>`;
  }

  private renderLayoutBlocks(
    blocks: WysiwygBlock[],
    theme: Required<WysiwygTheme>,
    layout: string,
    imageMap: Map<string, string> = new Map(),
  ): string {
    const isMedia = (block: WysiwygBlock) =>
      ['IMAGE', 'VIDEO', 'EMBED', 'CHART'].includes(
        String(block.blockType || '').toUpperCase(),
      );
    const isTitle = (block: WysiwygBlock) =>
      ['HEADING', 'SUBHEADING'].includes(
        String(block.blockType || '').toUpperCase(),
      );
    const media = blocks.filter(isMedia);
    const titles = blocks.filter(isTitle);
    const body = blocks.filter((block) => !isMedia(block) && !isTitle(block));
    const render = (list: WysiwygBlock[]) =>
      list
        .map((block) => this.renderBlockHtml(block, theme, layout, imageMap))
        .join('\n');

    if (layout === 'title-hero') {
      return `<div class="hero-media">${render(media)}</div><div class="hero-copy">${render(titles)}${render(body)}</div>`;
    }
    if (layout === 'image-left' || layout === 'two-column-image') {
      return `<div class="hero-media">${render(media)}</div><div class="hero-copy">${render(titles)}${render(body)}</div>`;
    }
    if (layout === 'image-right') {
      return `<div class="hero-copy">${render(titles)}${render(body)}</div><div class="hero-media">${render(media)}</div>`;
    }
    return blocks
      .map((block) => this.renderBlockHtml(block, theme, layout, imageMap))
      .join('\n');
  }

  /**
   * Render a single block as HTML with inline styles for WYSIWYG fidelity
   */
  private renderBlockHtml(
    block: WysiwygBlock,
    theme: Required<WysiwygTheme>,
    layout: string,
    imageMap: Map<string, string> = new Map(),
  ): string {
    const content = block.content || {};
    const style = (block.style || {}) as Record<
      string,
      string | number | undefined
    >;
    const customStyle = this.buildInlineStyle(style);

    switch (block.blockType?.toUpperCase()) {
      case 'HEADING':
        return `<h1 class="block block-heading" style="${customStyle}; color: ${theme.colors.primary}; font-family: '${theme.fonts.heading}', serif;">${this.escapeHtml((content.text as string) || '')}</h1>`;

      case 'SUBHEADING': {
        const variant = String(style.variant || '');
        const text = String((content.text as string) || '');
        if (this.isGenericKicker(text)) {
          return '';
        }
        if (variant === 'kicker') {
          return `<div class="block block-kicker" style="${customStyle}">${this.escapeHtml(text)}</div>`;
        }
        return `<h2 class="block block-subheading" style="${customStyle}; color: ${theme.colors.text}; font-family: '${theme.fonts.heading}', sans-serif;">${this.escapeHtml(text)}</h2>`;
      }

      case 'PARAGRAPH':
      case 'TEXT':
        return `<p class="block block-paragraph" style="${customStyle}; color: ${theme.colors.text}; font-family: '${theme.fonts.body}', sans-serif;">${this.escapeHtml((content.text as string) || '')}</p>`;

      case 'BULLET_LIST':
      case 'LIST': {
        const items = Array.isArray(content.items) ? content.items : [];
        const lis = items
          .map(
            (item: unknown) =>
              `<li>${this.escapeHtml(typeof item === 'string' ? item : ((item as Record<string, unknown>)?.text as string) || '')}</li>`,
          )
          .join('\n');
        return `<ul class="block block-list" style="${customStyle}; color: ${theme.colors.text}; font-family: '${theme.fonts.body}', sans-serif;">${lis}</ul>`;
      }

      case 'QUOTE':
        return `<blockquote class="block block-quote" style="${customStyle}; border-left-color: ${theme.colors.accent}; color: ${theme.colors.textMuted}; font-family: '${theme.fonts.body}', sans-serif;">
          <p>${this.escapeHtml((content.text as string) || '')}</p>
          ${content.attribution ? `<cite>— ${this.escapeHtml(content.attribution as string)}</cite>` : ''}
        </blockquote>`;

      case 'IMAGE': {
        const rawSrc = (content.url as string) || (content.src as string) || '';
        const src = imageMap.get(rawSrc) || rawSrc;
        const alt =
          (content.alt as string) || (content.description as string) || '';
        if (src) {
          return `<div class="block block-image" style="${customStyle}">
            <img src="${this.escapeHtml(src)}" alt="${this.escapeHtml(alt)}" />
          </div>`;
        }
        return `<div class="block block-image-placeholder" style="${customStyle}">
          <div class="image-placeholder">${this.escapeHtml(alt || 'Image')}</div>
        </div>`;
      }

      case 'TABLE': {
        const headers = Array.isArray(content.headers) ? content.headers : [];
        const rows = Array.isArray(content.rows) ? content.rows : [];
        const thHtml = headers
          .map((h: unknown) => `<th>${this.escapeHtml(String(h))}</th>`)
          .join('');
        const trHtml = rows
          .map(
            (row: unknown) =>
              '<tr>' +
              (Array.isArray(row)
                ? row
                    .map(
                      (cell: unknown) =>
                        `<td>${this.escapeHtml(String(cell))}</td>`,
                    )
                    .join('')
                : '') +
              '</tr>',
          )
          .join('');
        return `<table class="block block-table" style="${customStyle}; color: ${theme.colors.text};">
          <thead><tr>${thHtml}</tr></thead>
          <tbody>${trHtml}</tbody>
        </table>`;
      }

      case 'CODE': {
        const code = (content.code as string) || (content.text as string) || '';
        const lang = (content.language as string) || '';
        return `<pre class="block block-code" style="${customStyle}; background: ${theme.colors.surface}; color: ${theme.colors.text};"><code data-language="${lang}">${this.escapeHtml(code)}</code></pre>`;
      }

      case 'STATS':
      case 'STATS_GRID': {
        const statItems = Array.isArray(content.stats)
          ? content.stats
          : Array.isArray(content.items)
            ? content.items
            : [];
        const statsHtml = statItems
          .map((item: unknown) => {
            const stat = item as Record<string, unknown>;
            const valueText =
              typeof stat.value === 'string' || typeof stat.value === 'number'
                ? String(stat.value)
                : typeof item === 'string'
                  ? item
                  : '';
            const labelText = typeof stat.label === 'string' ? stat.label : '';
            return `<div class="stat-item">
                <div class="stat-value" style="color: ${theme.colors.accent};">${this.escapeHtml(valueText)}</div>
                <div class="stat-label" style="color: ${theme.colors.textMuted};">${this.escapeHtml(labelText)}</div>
              </div>`;
          })
          .join('');
        return `<div class="block block-stats ${layout === 'two-column' ? 'stats-row' : ''}" style="${customStyle}">${statsHtml}</div>`;
      }

      case 'COMPARISON': {
        const items = Array.isArray(content.items) ? content.items : [];
        const cards = items
          .map(
            (item: unknown) =>
              `<div class="comparison-card">${this.escapeHtml(typeof item === 'string' ? item : asString((item as Record<string, unknown>)?.text))}</div>`,
          )
          .join('');
        return `<div class="block block-comparison" style="${customStyle}">${cards}</div>`;
      }

      case 'TIMELINE': {
        const items = Array.isArray(content.items) ? content.items : [];
        const steps = items
          .map(
            (item: unknown, i: number) =>
              `<div class="timeline-step"><span class="timeline-index">${i + 1}</span><p>${this.escapeHtml(typeof item === 'string' ? item : asString((item as Record<string, unknown>)?.text))}</p></div>`,
          )
          .join('');
        return `<div class="block block-timeline" style="${customStyle}">${steps}</div>`;
      }

      case 'CALL_TO_ACTION':
        return `<div class="block block-cta" style="${customStyle}; background: ${theme.colors.accent}; color: ${theme.colors.background};">${this.escapeHtml((content.text as string) || '')}</div>`;

      default:
        if (content.text) {
          return `<p class="block block-default" style="${customStyle}; color: ${theme.colors.text};">${this.escapeHtml(content.text as string)}</p>`;
        }
        return '';
    }
  }

  /**
   * Build inline CSS from a style object saved in the block
   */
  private buildInlineStyle(
    style: Record<string, string | number | undefined>,
  ): string {
    const parts: string[] = [];
    if (style.fontSize) parts.push(`font-size: ${String(style.fontSize)}`);
    if (style.fontWeight)
      parts.push(`font-weight: ${String(style.fontWeight)}`);
    if (style.textAlign) parts.push(`text-align: ${String(style.textAlign)}`);
    if (style.color) parts.push(`color: ${String(style.color)}`);
    if (style.backgroundColor)
      parts.push(`background-color: ${String(style.backgroundColor)}`);
    if (style.padding) parts.push(`padding: ${String(style.padding)}`);
    if (style.margin) parts.push(`margin: ${String(style.margin)}`);
    if (style.borderRadius)
      parts.push(`border-radius: ${String(style.borderRadius)}`);
    if (style.opacity) parts.push(`opacity: ${String(style.opacity)}`);
    // Absolute positioning support for canvas-based layouts
    if (style.x !== undefined && style.y !== undefined) {
      parts.push('position: absolute');
      parts.push(`left: ${String(style.x)}px`);
      parts.push(`top: ${String(style.y)}px`);
    }
    if (style.width) parts.push(`width: ${String(style.width)}px`);
    if (style.height) parts.push(`height: ${String(style.height)}px`);
    return parts.join('; ');
  }

  /**
   * Wrap slides HTML in a complete, self-contained document
   */
  private wrapInFullDocument(
    title: string,
    theme: Required<WysiwygTheme>,
    slidesHtml: string,
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${theme.fonts.heading.replace(/\s+/g, '+')}:wght@400;600;700&family=${theme.fonts.body.replace(/\s+/g, '+')}:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: '${theme.fonts.body}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #000;
      color: ${theme.colors.text};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* ===== SLIDE CONTAINER ===== */
    .slide {
      width: 1280px;
      height: 720px;
      position: relative;
      overflow: hidden;
      page-break-after: always;
      background: ${theme.colors.background};
    }

    .slide-content {
      width: 100%;
      height: 100%;
      padding: 60px 80px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
    }

    .slide-number {
      position: absolute;
      bottom: 16px;
      right: 24px;
      font-size: 12px;
      color: ${theme.colors.textMuted};
      opacity: 0.6;
    }

    /* ===== LAYOUT VARIANTS ===== */
    .layout-title, .layout-title-slide, .layout-title-subtitle {
      justify-content: center;
    }
    .layout-title-hero {
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 0;
      padding: 0;
    }
    .layout-title-hero .hero-media,
    .layout-image-left .hero-media,
    .layout-image-right .hero-media,
    .layout-two-column-image .hero-media {
      min-height: 720px;
      height: 100%;
      overflow: hidden;
      background: ${theme.colors.surface};
    }
    .layout-title-hero .hero-media .block,
    .layout-image-left .hero-media .block,
    .layout-image-right .hero-media .block,
    .layout-two-column-image .hero-media .block {
      margin: 0;
      height: 100%;
    }
    .layout-title-hero .hero-media .block-image,
    .layout-image-left .hero-media .block-image,
    .layout-image-right .hero-media .block-image,
    .layout-two-column-image .hero-media .block-image {
      margin: 0;
      height: 100%;
      text-align: left;
    }
    .layout-title-hero .hero-media img,
    .layout-image-left .hero-media img,
    .layout-image-right .hero-media img,
    .layout-two-column-image .hero-media img {
      width: 100%;
      height: 100%;
      max-height: none;
      object-fit: cover;
      border-radius: 0;
      box-shadow: none;
    }
    .layout-title-hero .hero-copy,
    .layout-image-left .hero-copy,
    .layout-image-right .hero-copy,
    .layout-two-column-image .hero-copy {
      padding: 72px 56px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 16px;
    }
    .layout-two-column, .layout-comparison, .layout-three-column {
      display: grid;
      gap: 24px;
    }
    .layout-two-column, .layout-comparison { grid-template-columns: 1fr 1fr; }
    .layout-three-column { grid-template-columns: 1fr 1fr 1fr; }
    .layout-stats-grid .block-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    .layout-timeline { justify-content: flex-start; }
    .layout-image-left, .layout-image-right, .layout-two-column-image {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      align-items: stretch;
    }
    .layout-image-full { padding: 0; }
    .layout-image-full .block-image img { max-height: 720px; width: 100%; object-fit: cover; border-radius: 0; }
    .layout-quote-highlight { align-items: center; text-align: center; }
    .layout-bento-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }
    .layout-chart-focus { justify-content: flex-start; }

    .layout-title-slide .block-heading, .layout-title .block-heading, .layout-title-hero .block-heading { font-size: 52px; margin-bottom: 16px; }
    .layout-title-slide .block-subheading { font-size: 28px; opacity: 0.8; }

    .block-kicker {
      display: inline-flex;
      align-items: center;
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      font-weight: 700;
      color: ${theme.colors.accent};
      border: 1px solid ${theme.colors.accent};
      border-radius: 999px;
      padding: 6px 12px;
      width: fit-content;
    }
    .comparison-card, .timeline-step {
      background: ${theme.colors.surface};
      border-radius: 16px;
      padding: 20px;
      font-size: 18px;
      line-height: 1.45;
    }
    .block-comparison, .block-timeline { display: grid; gap: 16px; }
    .block-comparison { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .timeline-step { display: flex; gap: 12px; align-items: flex-start; }
    .timeline-index {
      width: 28px; height: 28px; border-radius: 8px;
      background: ${theme.colors.accent}; color: ${theme.colors.background};
      display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;
    }
    .block-cta {
      border-radius: 16px;
      padding: 24px;
      font-size: 24px;
      font-weight: 700;
      text-align: center;
    }

    /* ===== BLOCK STYLES ===== */
    .block { margin-bottom: 20px; }

    .block-heading {
      font-family: '${theme.fonts.heading}', 'Source Serif 4', Georgia, serif;
      font-size: 42px;
      font-weight: 700;
      line-height: 1.15;
      letter-spacing: -0.03em;
      margin-bottom: 12px;
    }

    .block-subheading {
      font-family: '${theme.fonts.heading}', sans-serif;
      font-size: 26px;
      font-weight: 500;
      line-height: 1.3;
      margin-bottom: 16px;
      color: ${theme.colors.textMuted};
    }

    .block-paragraph {
      font-size: 20px;
      line-height: 1.6;
      margin-bottom: 16px;
    }

    .block-list {
      font-size: 20px;
      line-height: 1.5;
      padding-left: 28px;
      margin-bottom: 16px;
    }

    .block-list li {
      margin-bottom: 8px;
      padding-left: 4px;
    }

    .block-list li::marker {
      color: ${theme.colors.accent};
    }

    .block-quote {
      font-size: 22px;
      font-style: italic;
      border-left: 4px solid ${theme.colors.accent};
      padding: 16px 24px;
      margin: 20px 0;
      background: ${theme.colors.surface};
      border-radius: 0 8px 8px 0;
    }

    .block-quote cite {
      display: block;
      margin-top: 8px;
      font-size: 16px;
      font-style: normal;
      opacity: 0.7;
    }

    .block-image { text-align: center; margin: 16px 0; }
    .block-image img {
      max-width: 100%;
      max-height: 400px;
      border-radius: 12px;
      object-fit: contain;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }

    .block-image-placeholder {
      text-align: center;
      margin: 16px 0;
    }

    .image-placeholder {
      width: 400px;
      height: 250px;
      background: ${theme.colors.surface};
      border: 2px dashed ${theme.colors.textMuted};
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${theme.colors.textMuted};
      font-size: 16px;
      margin: 0 auto;
    }

    .block-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border-radius: 8px;
      overflow: hidden;
      font-size: 16px;
    }

    .block-table th {
      background: ${theme.colors.surface};
      color: ${theme.colors.text};
      font-weight: 600;
      padding: 12px 16px;
      text-align: left;
      border-bottom: 2px solid ${theme.colors.accent};
    }

    .block-table td {
      padding: 10px 16px;
      border-bottom: 1px solid ${theme.colors.surface};
    }

    .block-code {
      font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
      font-size: 15px;
      padding: 20px 24px;
      border-radius: 8px;
      line-height: 1.5;
      overflow-x: auto;
    }

    .block-stats {
      display: flex;
      gap: 32px;
      flex-wrap: wrap;
      margin: 20px 0;
    }

    .stat-item {
      flex: 1;
      min-width: 120px;
      text-align: center;
      padding: 16px;
      background: ${theme.colors.surface};
      border-radius: 12px;
    }

    .stat-value {
      font-size: 36px;
      font-weight: 700;
      font-family: '${theme.fonts.heading}', sans-serif;
      margin-bottom: 4px;
    }

    .stat-label {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* ===== PRINT / PDF STYLES ===== */
    @media print {
      body { background: white; }
      .slide { page-break-after: always; }
    }
  </style>
</head>
<body>
${slidesHtml}
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
