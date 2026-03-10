import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/**
 * Supported file types for document ingestion
 */
type SupportedMimeType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'text/plain'
  | 'text/markdown'
  | 'text/html';

interface DocumentChunk {
  index: number;
  text: string;
  tokenEstimate: number;
}

interface SlideContent {
  title: string;
  layout: string;
  blocks: Array<{
    blockType: string;
    content: Record<string, unknown>;
    order: number;
  }>;
}

interface IngestionResult {
  originalFilename: string;
  mimeType: string;
  extractedTextLength: number;
  chunkCount: number;
  slides: SlideContent[];
  summary: string;
  suggestedTitle: string;
}

interface IngestionOptions {
  slideCount?: number;
  style?: 'executive' | 'detailed' | 'visual' | 'minimal';
  audienceType?: 'executives' | 'technical' | 'sales' | 'general';
  includeDataSlides?: boolean;
  language?: string;
}

@Injectable()
export class DocumentIngestionService {
  private readonly logger = new Logger(DocumentIngestionService.name);
  private openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Main entry: upload a document file buffer → AI-structured slides
   */
  async ingestDocument(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
    options: IngestionOptions = {},
  ): Promise<IngestionResult> {
    this.logger.log(
      `Ingesting document: ${filename} (${mimeType}, ${fileBuffer.length} bytes)`,
    );

    // 1. Validate file type
    this.validateMimeType(mimeType as SupportedMimeType);

    // 2. Extract raw text from the document
    const rawText = await this.extractText(fileBuffer, mimeType);

    if (!rawText || rawText.trim().length < 50) {
      throw new BadRequestException(
        'Could not extract enough text from the document. Please ensure the file contains readable text content.',
      );
    }

    this.logger.log(`Extracted ${rawText.length} characters from ${filename}`);

    // 3. Chunk the text for LLM processing
    const chunks = this.chunkText(rawText, 6000);

    // 4. Summarize each chunk
    const chunkSummaries = await this.summarizeChunks(chunks);

    // 5. Generate structured slides via AI
    const slides = await this.generateSlidesFromSummaries(
      chunkSummaries,
      rawText.substring(0, 2000), // Pass beginning for context
      options,
    );

    // 6. Generate a title and summary
    const { title, summary } = await this.generateTitleAndSummary(
      chunkSummaries,
      filename,
    );

    return {
      originalFilename: filename,
      mimeType,
      extractedTextLength: rawText.length,
      chunkCount: chunks.length,
      slides,
      summary,
      suggestedTitle: title,
    };
  }

  /**
   * Validate that the uploaded file is a supported type
   */
  private validateMimeType(mimeType: string): void {
    const supported: string[] = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'text/html',
    ];

    if (!supported.includes(mimeType)) {
      throw new BadRequestException(
        `Unsupported file type: ${mimeType}. Supported: PDF, DOCX, TXT, Markdown, HTML`,
      );
    }
  }

  /**
   * Extract raw text from various document formats
   */
  private async extractText(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    switch (mimeType) {
      case 'text/plain':
      case 'text/markdown':
        return fileBuffer.toString('utf-8');

      case 'text/html':
        return this.extractTextFromHtml(fileBuffer.toString('utf-8'));

      case 'application/pdf':
        return this.extractTextFromPdf(fileBuffer);

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.extractTextFromDocx(fileBuffer);

      default:
        throw new BadRequestException(`No extractor for: ${mimeType}`);
    }
  }

  /**
   * Strip HTML tags and extract readable text
   */
  private extractTextFromHtml(html: string): string {
    // Remove script and style tags with content
    let text = html.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      '',
    );
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    // Remove all HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    // Decode HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    // Collapse whitespace
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  }

  /**
   * Extract text from PDF using a lightweight text-layer approach.
   * We parse the raw PDF buffer for text objects.
   * For production, consider pdf-parse or pdfjs-dist.
   */
  private async extractTextFromPdf(fileBuffer: Buffer): Promise<string> {
    try {
      // Lightweight PDF text extraction
      // Looks for text between BT/ET markers and parenthesized strings
      const pdfString = fileBuffer.toString('latin1');
      const textChunks: string[] = [];

      // Strategy 1: Extract parenthesized text strings (most common in PDFs)
      const parenRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
      let match;
      while ((match = parenRegex.exec(pdfString)) !== null) {
        const decoded = match[1]
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\');
        if (decoded.trim().length > 0) {
          textChunks.push(decoded);
        }
      }

      // Strategy 2: Look for hex-encoded text streams
      const hexRegex = /<([0-9A-Fa-f\s]+)>/g;
      while ((match = hexRegex.exec(pdfString)) !== null) {
        const hex = match[1].replace(/\s/g, '');
        if (hex.length > 4 && hex.length % 2 === 0) {
          try {
            const decoded = Buffer.from(hex, 'hex').toString(
              'utf-16be' as BufferEncoding,
            );
            if (decoded.trim().length > 0 && /[a-zA-Z]/.test(decoded)) {
              textChunks.push(decoded);
            }
          } catch {
            // Skip non-decodable hex strings
          }
        }
      }

      const extractedText = textChunks.join(' ').replace(/\s+/g, ' ').trim();

      if (extractedText.length < 50) {
        this.logger.warn(
          'PDF text extraction yielded minimal text. The PDF may be image-based.',
        );
        return `[Extracted from PDF - limited text content] ${extractedText}`;
      }

      return extractedText;
    } catch (error) {
      this.logger.error('PDF extraction failed', error);
      throw new BadRequestException(
        'Failed to extract text from PDF. The file may be corrupted or image-based.',
      );
    }
  }

  /**
   * Extract text from DOCX (Office Open XML)
   * DOCX is a ZIP containing XML files — we extract from word/document.xml
   */
  private async extractTextFromDocx(fileBuffer: Buffer): Promise<string> {
    try {
      // DOCX is a ZIP file. We need to find word/document.xml
      // Simple approach: look for the XML content in the buffer
      const bufStr = fileBuffer.toString('utf-8');

      // Find XML text nodes within w:t tags (Word text runs)
      const textParts: string[] = [];
      const wtRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let match;
      while ((match = wtRegex.exec(bufStr)) !== null) {
        if (match[1].trim()) {
          textParts.push(match[1]);
        }
      }

      if (textParts.length > 0) {
        return textParts.join(' ');
      }

      // Fallback: try to extract any readable text
      const readableText = bufStr
        .replace(/<[^>]+>/g, ' ')
        .replace(/[^\x20-\x7E\n\r\t]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      return readableText || '[No extractable text found in DOCX]';
    } catch (error) {
      this.logger.error('DOCX extraction failed', error);
      throw new BadRequestException('Failed to extract text from DOCX file.');
    }
  }

  /**
   * Split text into chunks that fit within token limits
   */
  private chunkText(text: string, maxCharsPerChunk: number): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [text];

    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      if (
        currentChunk.length + sentence.length > maxCharsPerChunk &&
        currentChunk.length > 0
      ) {
        chunks.push({
          index: chunkIndex++,
          text: currentChunk.trim(),
          tokenEstimate: Math.ceil(currentChunk.length / 4),
        });
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        index: chunkIndex,
        text: currentChunk.trim(),
        tokenEstimate: Math.ceil(currentChunk.length / 4),
      });
    }

    return chunks;
  }

  /**
   * Summarize each chunk of text using the AI
   */
  private async summarizeChunks(chunks: DocumentChunk[]): Promise<string[]> {
    // For small documents (1-2 chunks), no need to summarize
    if (chunks.length <= 2) {
      return chunks.map((c) => c.text);
    }

    const summaries: string[] = [];

    // Process chunks in parallel batches of 3
    const batchSize = 3;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (chunk) => {
          try {
            const response = await this.openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content:
                    'You are a document summarizer. Extract the key points, data, and arguments from the given text. Preserve important numbers, names, and quotes. Keep the summary concise but complete.',
                },
                {
                  role: 'user',
                  content: `Summarize this section of a document (section ${chunk.index + 1}):\n\n${chunk.text}`,
                },
              ],
              max_tokens: 800,
              temperature: 0.3,
            });
            return (
              response.choices[0]?.message?.content || chunk.text.slice(0, 500)
            );
          } catch (error) {
            this.logger.warn(
              `Failed to summarize chunk ${chunk.index}: ${error}`,
            );
            return chunk.text.slice(0, 500);
          }
        }),
      );
      summaries.push(...batchResults);
    }

    return summaries;
  }

  /**
   * Generate structured slide content from summarized chunks
   */
  private async generateSlidesFromSummaries(
    summaries: string[],
    documentBeginning: string,
    options: IngestionOptions,
  ): Promise<SlideContent[]> {
    const {
      slideCount = 10,
      style = 'executive',
      audienceType = 'general',
      includeDataSlides = true,
    } = options;

    const combinedSummary = summaries.join('\n\n---\n\n');

    const styleGuide = {
      executive:
        'Create concise, high-impact slides with key metrics and takeaways. Use bullet points, avoid long paragraphs.',
      detailed:
        'Create thorough slides that cover all important details. Include data tables and comprehensive explanations.',
      visual:
        'Emphasize visual layouts — use image placeholders, charts, and minimal text. Suggest relevant images.',
      minimal:
        'Create minimalist slides with very few words per slide. Focus on one key idea per slide.',
    };

    const audienceGuide = {
      executives:
        'Focus on ROI, strategic impact, and bottom-line results. Lead with conclusions.',
      technical:
        'Include technical details, architecture diagrams, and specifications.',
      sales:
        'Emphasize benefits, competitive advantages, and customer value propositions.',
      general:
        'Use clear, jargon-free language accessible to a broad audience.',
    };

    const prompt = `You are an expert presentation designer. Convert the following document content into a structured presentation with exactly ${slideCount} slides.

STYLE: ${styleGuide[style]}
AUDIENCE: ${audienceGuide[audienceType]}

Document beginning (for context):
${documentBeginning}

Full document summary:
${combinedSummary}

Generate exactly ${slideCount} slides. Each slide must have:
- A "title" (short, compelling)
- A "layout" (one of: "title-slide", "two-column", "content", "bullets", "quote", "data-table", "image-text", "comparison", "timeline", "closing")
- An array of "blocks" with appropriate blockType and content

Block types to use:
- HEADING: { text: "..." }
- SUBHEADING: { text: "..." }
- PARAGRAPH: { text: "..." }
- BULLET_LIST: { items: [{ text: "..." }, ...] }
- QUOTE: { text: "...", attribution: "..." }
- TABLE: { headers: [...], rows: [[...], ...] }
- IMAGE: { description: "Describe an ideal image for this slide", alt: "..." }
- STATS: { items: [{ value: "...", label: "..." }, ...] }

${includeDataSlides ? 'Include data visualization slides where the document contains numbers, metrics, or comparisons.' : ''}

Respond with a valid JSON array of slide objects. No markdown, no explanation, just the JSON array.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a JSON-only response bot. You always respond with valid JSON arrays. Never include markdown formatting or explanation text.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 4000,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{"slides":[]}';
      const parsed = JSON.parse(content);
      const slidesArray: object[] = Array.isArray(parsed)
        ? parsed
        : parsed.slides || [];

      return slidesArray.map(
        (slide: Record<string, unknown>, index: number) => ({
          title: (slide.title as string) || `Slide ${index + 1}`,
          layout: (slide.layout as string) || 'content',
          blocks: Array.isArray(slide.blocks)
            ? (slide.blocks as Record<string, unknown>[]).map(
                (block: Record<string, unknown>, bIdx: number) => ({
                  blockType:
                    (block.blockType as string) ||
                    (block.type as string) ||
                    'PARAGRAPH',
                  content:
                    (block.content as Record<string, unknown>) ||
                    ({ text: '' } as Record<string, unknown>),
                  order: bIdx,
                }),
              )
            : [
                {
                  blockType: 'PARAGRAPH',
                  content: { text: 'Content placeholder' },
                  order: 0,
                },
              ],
        }),
      );
    } catch (error) {
      this.logger.error('Failed to generate slides from AI', error);
      // Return a basic fallback set of slides
      return this.generateFallbackSlides(summaries, slideCount);
    }
  }

  /**
   * Generate a title and summary for the resulting presentation
   */
  private async generateTitleAndSummary(
    summaries: string[],
    filename: string,
  ): Promise<{ title: string; summary: string }> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Generate a presentation title and a 1-2 sentence summary. Respond with JSON: { "title": "...", "summary": "..." }',
          },
          {
            role: 'user',
            content: `Source filename: ${filename}\n\nContent preview:\n${summaries.slice(0, 3).join('\n')}`,
          },
        ],
        max_tokens: 200,
        temperature: 0.5,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      return {
        title: parsed.title || filename.replace(/\.[^/.]+$/, ''),
        summary: parsed.summary || 'Presentation generated from document.',
      };
    } catch {
      return {
        title: filename.replace(/\.[^/.]+$/, ''),
        summary: 'Presentation generated from uploaded document.',
      };
    }
  }

  /**
   * Fallback slide generation if AI fails
   */
  private generateFallbackSlides(
    summaries: string[],
    targetCount: number,
  ): SlideContent[] {
    const slides: SlideContent[] = [];

    // Title slide
    slides.push({
      title: 'Presentation',
      layout: 'title-slide',
      blocks: [
        {
          blockType: 'HEADING',
          content: { text: 'Document Summary' },
          order: 0,
        },
        {
          blockType: 'SUBHEADING',
          content: { text: 'Auto-generated from uploaded document' },
          order: 1,
        },
      ],
    });

    // Content slides from summaries
    for (let i = 0; i < Math.min(summaries.length, targetCount - 2); i++) {
      const summaryText = summaries[i];
      const sentences = summaryText.split(/[.!?]+/).filter((s) => s.trim());

      slides.push({
        title: `Key Points ${i + 1}`,
        layout: 'bullets',
        blocks: [
          {
            blockType: 'HEADING',
            content: { text: `Section ${i + 1}` },
            order: 0,
          },
          {
            blockType: 'BULLET_LIST',
            content: {
              items: sentences.slice(0, 6).map((s) => ({
                text: s.trim(),
              })),
            },
            order: 1,
          },
        ],
      });
    }

    // Closing slide
    slides.push({
      title: 'Summary',
      layout: 'closing',
      blocks: [
        {
          blockType: 'HEADING',
          content: { text: 'Thank You' },
          order: 0,
        },
        {
          blockType: 'PARAGRAPH',
          content: { text: 'Questions?' },
          order: 1,
        },
      ],
    });

    return slides;
  }
}
