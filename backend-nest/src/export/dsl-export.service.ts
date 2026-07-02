/**
 * DSL-Aware Export Service
 *
 * Exports PresentationDocument (from the generation pipeline DSL)
 * to PDF, PPTX, and standalone HTML presentation mode.
 *
 * This service works with the new DSL types alongside the existing
 * ExportService which handles legacy Prisma model exports.
 */
import { Injectable, Logger } from '@nestjs/common';
import type {
  PresentationDocument,
  PresentationSlide,
  SlideBlock,
} from '../../../shared/presentation-dsl';

interface DslExportResult {
  filename: string;
  mimeType: string;
  data: string | Buffer;
}

@Injectable()
export class DslExportService {
  private readonly logger = new Logger(DslExportService.name);

  /**
   * Export a PresentationDocument to standalone HTML presentation.
   * Includes keyboard navigation, fullscreen mode, and animations.
   */
  exportToHtmlPresentation(doc: PresentationDocument): DslExportResult {
    const theme = doc.theme;
    const allSlides = doc.sections.flatMap((s) => s.slides);

    const slidesHtml = allSlides
      .map((slide, idx) => this.renderSlideToHtml(slide, idx))
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(doc.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(theme.typography.headingFont)}:wght@400;600;700&family=${encodeURIComponent(theme.typography.bodyFont)}:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --color-primary: ${theme.colors.primary};
      --color-secondary: ${theme.colors.secondary};
      --color-accent: ${theme.colors.accent};
      --color-bg: ${theme.colors.background};
      --color-surface: ${theme.colors.surface};
      --color-text: ${theme.colors.text};
      --color-text-muted: ${theme.colors.textMuted};
      --font-heading: '${theme.typography.headingFont}', system-ui, sans-serif;
      --font-body: '${theme.typography.bodyFont}', system-ui, sans-serif;
      --font-mono: '${theme.typography.monoFont}', 'Fira Code', monospace;
      --radius: ${theme.effects.borderRadius};
      --shadow: ${theme.effects.shadow};
    }

    html, body {
      width: 100vw; height: 100vh;
      overflow: hidden;
      background: #000;
      font-family: var(--font-body);
    }

    .slide-container {
      width: 100vw; height: 100vh;
      display: flex; align-items: center; justify-content: center;
    }

    .slide {
      width: 100%; height: 100%;
      max-width: 100vw; max-height: 100vh;
      aspect-ratio: 16/9;
      background: var(--color-bg);
      color: var(--color-text);
      display: none;
      flex-direction: column;
      justify-content: center;
      padding: 5% 8%;
      position: relative;
      overflow: hidden;
    }

    .slide.active { display: flex; animation: fadeIn 0.4s ease; }

    .slide-number {
      position: absolute; bottom: 24px; right: 32px;
      font-size: 14px; color: var(--color-text-muted);
      font-family: var(--font-body);
    }

    /* Block styles */
    .block-heading {
      font-family: var(--font-heading);
      font-size: clamp(28px, 3.5vw, 56px);
      font-weight: 700;
      color: var(--color-text);
      margin-bottom: 1em;
      line-height: 1.15;
    }

    .block-subheading {
      font-family: var(--font-heading);
      font-size: clamp(20px, 2.2vw, 36px);
      font-weight: 600;
      color: var(--color-text-muted);
      margin-bottom: 0.8em;
    }

    .block-paragraph {
      font-size: clamp(16px, 1.4vw, 22px);
      line-height: 1.7;
      color: var(--color-text);
      margin-bottom: 1em;
      max-width: 72ch;
    }

    .block-bullet-list, .block-numbered-list {
      font-size: clamp(16px, 1.3vw, 20px);
      line-height: 1.8;
      padding-left: 1.5em;
      margin-bottom: 1em;
    }

    .block-bullet-list li, .block-numbered-list li {
      margin-bottom: 0.5em;
    }

    .block-statistic {
      display: flex; flex-direction: column;
      align-items: flex-start; gap: 4px;
      margin-bottom: 1em;
    }

    .block-statistic .stat-value {
      font-family: var(--font-heading);
      font-size: clamp(40px, 5vw, 80px);
      font-weight: 700;
      color: var(--color-primary);
      line-height: 1;
    }

    .block-statistic .stat-label {
      font-size: clamp(14px, 1.2vw, 18px);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .block-quote {
      font-size: clamp(18px, 2vw, 28px);
      font-style: italic;
      color: var(--color-text-muted);
      border-left: 4px solid var(--color-accent);
      padding-left: 1.5em;
      margin: 1em 0;
      max-width: 60ch;
    }

    .block-callout {
      background: var(--color-surface);
      border-radius: var(--radius);
      padding: 1.2em 1.5em;
      font-size: clamp(14px, 1.2vw, 18px);
      margin-bottom: 1em;
      border-left: 4px solid var(--color-primary);
    }

    .block-image {
      max-width: 100%; max-height: 60vh;
      border-radius: var(--radius);
      object-fit: cover;
      margin-bottom: 1em;
    }

    .block-code {
      background: var(--color-surface);
      border-radius: var(--radius);
      padding: 1.5em;
      font-family: var(--font-mono);
      font-size: clamp(12px, 1vw, 16px);
      overflow-x: auto;
      margin-bottom: 1em;
    }

    /* Controls */
    .controls {
      position: fixed; bottom: 20px; left: 50%;
      transform: translateX(-50%);
      display: flex; gap: 12px; align-items: center;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(12px);
      padding: 8px 16px; border-radius: 24px;
      opacity: 0; transition: opacity 0.3s;
      z-index: 100;
    }

    .controls:hover, body:hover .controls { opacity: 1; }

    .controls button {
      background: rgba(255,255,255,0.15); border: none;
      color: white; padding: 8px 14px; border-radius: 8px;
      cursor: pointer; font-size: 14px;
      transition: background 0.2s;
    }

    .controls button:hover { background: rgba(255,255,255,0.25); }
    .controls .slide-counter { color: rgba(255,255,255,0.7); font-size: 13px; }

    /* Progress bar */
    .progress-bar {
      position: fixed; top: 0; left: 0; height: 3px;
      background: var(--color-primary);
      transition: width 0.4s ease; z-index: 101;
    }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

    @media print {
      .slide { display: flex !important; page-break-after: always; height: auto; min-height: 100vh; }
      .controls, .progress-bar { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="progress-bar" id="progressBar"></div>

  ${slidesHtml}

  <div class="controls">
    <button onclick="prevSlide()" title="Previous (ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â)">ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬</button>
    <span class="slide-counter" id="slideCounter">1 / ${allSlides.length}</span>
    <button onclick="nextSlide()" title="Next (ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢)">ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¶</button>
    <button onclick="toggleFullscreen()" title="Fullscreen (F)">ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂºÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¶</button>
  </div>

  <script>
    let currentSlide = 0;
    const totalSlides = ${allSlides.length};

    function showSlide(n) {
      const slides = document.querySelectorAll('.slide');
      slides.forEach(s => s.classList.remove('active'));
      currentSlide = Math.max(0, Math.min(n, totalSlides - 1));
      slides[currentSlide].classList.add('active');
      document.getElementById('slideCounter').textContent = (currentSlide + 1) + ' / ' + totalSlides;
      document.getElementById('progressBar').style.width = ((currentSlide + 1) / totalSlides * 100) + '%';
    }

    function nextSlide() { showSlide(currentSlide + 1); }
    function prevSlide() { showSlide(currentSlide - 1); }

    function toggleFullscreen() {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextSlide(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prevSlide(); }
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      if (e.key === 'Escape' && document.fullscreenElement) document.exitFullscreen();
      if (e.key === 'Home') showSlide(0);
      if (e.key === 'End') showSlide(totalSlides - 1);
    });

    // Touch support
    let touchStartX = 0;
    document.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; });
    document.addEventListener('touchend', (e) => {
      const diff = e.changedTouches[0].screenX - touchStartX;
      if (Math.abs(diff) > 50) { diff > 0 ? prevSlide() : nextSlide(); }
    });

    showSlide(0);
  </script>
</body>
</html>`;

    return {
      filename: `${this.sanitizeFilename(doc.title)}_presentation.html`,
      mimeType: 'text/html',
      data: html,
    };
  }

  /**
   * Export to speaker notes document (Markdown).
   */
  exportToSpeakerNotes(doc: PresentationDocument): DslExportResult {
    const allSlides = doc.sections.flatMap((s) => s.slides);

    let markdown = `# ${doc.title} ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â Speaker Notes\n\n`;
    markdown += `**Duration:** ~${doc.metadata.estimatedDuration} minutes\n`;
    markdown += `**Audience:** ${doc.metadata.audience}\n\n---\n\n`;

    allSlides.forEach((slide, idx) => {
      const heading = slide.blocks.find((b) => b.kind === 'heading');
      markdown += `## Slide ${idx + 1}: ${heading?.content.text || 'Untitled'}\n\n`;

      if (slide.speakerNotes) {
        markdown += `${slide.speakerNotes}\n\n`;
      } else {
        markdown += `*(No speaker notes)*\n\n`;
      }

      if (slide.duration) {
        markdown += `ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â± Target: ${slide.duration}s\n\n`;
      }

      markdown += `---\n\n`;
    });

    return {
      filename: `${this.sanitizeFilename(doc.title)}_speaker_notes.md`,
      mimeType: 'text/markdown',
      data: markdown,
    };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private renderSlideToHtml(
    slide: PresentationSlide,
    index: number,
  ): string {
    const blocksHtml = slide.blocks
      .sort((a, b) => a.order - b.order)
      .map((block) => this.renderBlockToHtml(block))
      .join('\n');

    return `
    <div class="slide-container">
      <div class="slide" data-slide="${index}">
        ${blocksHtml}
        <div class="slide-number">${index + 1}</div>
      </div>
    </div>`;
  }

  private renderBlockToHtml(block: SlideBlock): string {
    const c = block.content;

    switch (block.kind) {
      case 'heading':
        return `<h1 class="block-heading">${this.escapeHtml(c.text || '')}</h1>`;

      case 'subheading':
        return `<h2 class="block-subheading">${this.escapeHtml(c.text || '')}</h2>`;

      case 'paragraph':
        return `<p class="block-paragraph">${this.escapeHtml(c.text || '')}</p>`;

      case 'bullet-list':
        return `<ul class="block-bullet-list">${(c.items || []).map((item) => `<li>${this.escapeHtml(item)}</li>`).join('')}</ul>`;

      case 'numbered-list':
        return `<ol class="block-numbered-list">${(c.items || []).map((item) => `<li>${this.escapeHtml(item)}</li>`).join('')}</ol>`;

      case 'statistic':
        return `<div class="block-statistic"><span class="stat-value">${this.escapeHtml(String(c.value || ''))}</span><span class="stat-label">${this.escapeHtml(c.label || '')}</span></div>`;

      case 'quote':
        return `<blockquote class="block-quote">"${this.escapeHtml(c.text || '')}"${c.author ? `<cite> ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ${this.escapeHtml(c.author)}</cite>` : ''}</blockquote>`;

      case 'callout':
        return `<div class="block-callout">${this.escapeHtml(c.text || '')}</div>`;

      case 'image':
        return c.url
          ? `<img class="block-image" src="${this.escapeHtml(c.url)}" alt="${this.escapeHtml(c.alt || '')}" loading="lazy">`
          : '';

      case 'code':
        return `<pre class="block-code"><code>${this.escapeHtml(c.code || c.text || '')}</code></pre>`;

      case 'divider':
        return `<hr style="border: none; border-top: 1px solid var(--color-text-muted); opacity: 0.2; margin: 1.5em 0;">`;

      default:
        return c.text
          ? `<p class="block-paragraph">${this.escapeHtml(c.text)}</p>`
          : '';
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private sanitizeFilename(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 100);
  }
}
