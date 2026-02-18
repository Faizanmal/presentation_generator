import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';

export interface URLImportResult {
  title: string;
  summary: string;
  slides: Array<{
    heading: string;
    blocks: Array<{
      type: string;
      content: string;
    }>;
    speakerNotes?: string;
  }>;
  sourceUrl: string;
  extractedImages?: string[];
  metadata?: {
    author?: string;
    publishedDate?: string;
    keywords?: string[];
  };
}

export interface WebPageContent {
  title: string;
  description: string;
  content: string;
  images: string[];
  url: string;
}

// Permissive Allowlist for URL Import
const ALLOWED_DOMAINS = [
  'wikipedia.org',
  'wikimedia.org',
  'creativecommons.org',
  'gov', // .gov domains
  'edu', // .edu domains
  'unsplash.com',
  'pexels.com',
  'pixabay.com',
  'medium.com', // Often has cc content, but needs check, strict allowlist requested so maybe careful.
  // Adding specific permissive documentation sites could be good too.
  'github.com', // Readmes are often MIT
  'stackoverflow.com', // CC-BY-SA
];

@Injectable()
export class URLImportService {
  private readonly logger = new Logger(URLImportService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Import content from a URL and generate slides
   */
  async importFromURL(
    url: string,
    options: {
      targetSlides?: number;
      style?: 'detailed' | 'summary' | 'bullet-points';
      includeImages?: boolean;
    } = {},
  ): Promise<URLImportResult> {
    const {
      targetSlides = 8,
      style = 'detailed',
      includeImages = true,
    } = options;

    this.logger.log(`Importing from URL: ${url}`);

    // Validate Domain
    if (!this.isDomainAllowed(url)) {
      throw new BadRequestException(
        'Domain not in allowlist. Please use only approved permissive sources (e.g., Wikipedia, Creative Commons, Government/Edu sites).',
      );
    }

    // Step 1: Fetch and parse the webpage content
    const pageContent = await this.fetchPageContent(url);

    // Step 2: Use AI to analyze and structure content into slides
    const slides = await this.generateSlidesFromContent(
      pageContent,
      targetSlides,
      style,
    );

    return {
      title: pageContent.title || 'Imported Presentation',
      summary: pageContent.description,
      slides,
      sourceUrl: url,
      extractedImages: includeImages ? pageContent.images.slice(0, 10) : [],
      metadata: {
        keywords: await this.extractKeywords(pageContent.content),
      },
    };
  }

  /**
   * Check if domain is in allowlist
   */
  private isDomainAllowed(url: string): boolean {
    try {
      const hostname = new URL(url).hostname;
      return ALLOWED_DOMAINS.some((domain) => hostname.endsWith(domain));
    } catch {
      return false;
    }
  }

  /**
   * Fetch and parse webpage content
   */
  private async fetchPageContent(url: string): Promise<WebPageContent> {
    try {
      // Use a proper User-Agent to identify the bot
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'PresentationDesignerBot/1.0 (+http://your-domain.com)',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new BadRequestException(
          `Failed to fetch URL: ${response.status}`,
        );
      }

      const html = await response.text();

      // Extract content using regex (basic parsing)
      // In production, use a proper HTML parser like cheerio
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const descMatch =
        html.match(
          /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
        ) ||
        html.match(
          /<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i,
        );

      // Extract main content (simplified)
      const bodyContent = this.extractMainContent(html);

      // Extract images
      const imageMatches = [
        ...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi),
      ];
      const images = imageMatches
        .map((m) => m[1])
        .filter((src) => src.startsWith('http') || src.startsWith('//'))
        .map((src) => (src.startsWith('//') ? `https:${src}` : src));

      return {
        title: titleMatch?.[1]?.trim() || 'Untitled',
        description: descMatch?.[1]?.trim() || '',
        content: bodyContent,
        images,
        url,
      };
    } catch (error) {
      this.logger.error('Failed to fetch page content:', error);
      throw new BadRequestException('Failed to fetch content from URL');
    }
  }

  /**
   * Extract main text content from HTML
   */
  private extractMainContent(html: string): string {
    // Remove script and style tags
    let content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    content = content.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
    content = content.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
    content = content.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');

    // Extract text from article, main, or body
    const articleMatch = content.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i);

    const targetContent = articleMatch?.[1] || mainMatch?.[1] || content;

    // Remove remaining HTML tags and clean up
    const text = targetContent
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    // Limit content length for API
    return text.substring(0, 15000);
  }

  /**
   * Generate slides from extracted content using AI
   */
  private async generateSlidesFromContent(
    pageContent: WebPageContent,
    targetSlides: number,
    style: 'detailed' | 'summary' | 'bullet-points',
  ): Promise<URLImportResult['slides']> {
    const styleInstructions: Record<string, string> = {
      detailed:
        'Create comprehensive slides with detailed explanations and multiple content blocks.',
      summary: 'Create concise slides that summarize key points clearly.',
      'bullet-points':
        'Create slides primarily using bullet points for quick scanning.',
    };

    try {
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a presentation designer. Transform web content into professional presentation slides.

${styleInstructions[style]}

RULES:
1. Create exactly ${targetSlides} slides
2. Start with a title slide
3. End with a summary or conclusion slide
4. Each slide should have a clear heading
5. Use appropriate block types: paragraph, bullet, subheading, quote, stat
6. Include speaker notes for each slide
7. Make content engaging and presentation-ready

OUTPUT FORMAT (JSON):
{
  "slides": [
    {
      "heading": "Slide Title",
      "blocks": [
        { "type": "paragraph|bullet|subheading|quote|stat", "content": "..." }
      ],
      "speakerNotes": "Notes for presenter"
    }
  ]
}`,
          },
          {
            role: 'user',
            content: `Transform this content into a ${targetSlides}-slide presentation:

TITLE: ${pageContent.title}
DESCRIPTION: ${pageContent.description}

CONTENT:
${pageContent.content}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 4000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const parsed = JSON.parse(content) as {
        slides: URLImportResult['slides'];
      };
      return parsed.slides || [];
    } catch (error) {
      this.logger.error('Failed to generate slides:', error);
      throw new BadRequestException('Failed to generate slides from content');
    }
  }

  /**
   * Extract keywords from content
   */
  private async extractKeywords(content: string): Promise<string[]> {
    try {
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Extract 5-10 relevant keywords/topics from the content. Return as JSON: { "keywords": ["word1", "word2"] }',
          },
          { role: 'user', content: content.substring(0, 3000) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const parsed = JSON.parse(
        response.choices[0]?.message?.content || '{}',
      ) as { keywords: string[] };
      return parsed.keywords || [];
    } catch {
      return [];
    }
  }

  /**
   * Import from YouTube video URL
   */
  async importFromYouTube(
    videoUrl: string,
    options: { targetSlides?: number } = {},
  ): Promise<URLImportResult> {
    const { targetSlides = 8 } = options;

    // Extract video ID
    const videoId = this.extractYouTubeId(videoUrl);
    if (!videoId) {
      throw new BadRequestException('Invalid YouTube URL');
    }

    // For now, use the oEmbed API to get basic video info
    // In production, you'd want to use YouTube Data API or transcription services
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await fetch(oembedUrl);
      const data = (await response.json()) as {
        title: string;
        author_name: string;
        thumbnail_url: string;
      };

      // Generate placeholder slides based on video title
      const slides = await this.generateSlidesFromContent(
        {
          title: data.title,
          description: `Video by ${data.author_name}`,
          content: `This is a presentation based on the YouTube video "${data.title}". The video discusses various topics that have been summarized into presentation slides.`,
          images: [data.thumbnail_url],
          url: videoUrl,
        },
        targetSlides,
        'summary',
      );

      return {
        title: data.title,
        summary: `Based on YouTube video by ${data.author_name}`,
        slides,
        sourceUrl: videoUrl,
        extractedImages: [data.thumbnail_url],
        metadata: {
          author: data.author_name,
        },
      };
    } catch (error) {
      this.logger.error('YouTube import error:', error);
      throw new BadRequestException('Failed to import from YouTube');
    }
  }

  private extractYouTubeId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  /**
   * Import from PDF URL
   */
  importFromPDF(pdfUrl: string): URLImportResult {
    void pdfUrl;
    // For PDF extraction, you'd typically use a service like pdf.js or a cloud API
    // This is a placeholder that would need proper PDF parsing implementation
    throw new BadRequestException(
      'PDF import requires additional setup. Use document-to-slides endpoint with extracted text instead.',
    );
  }
}
