import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

interface SlideContent {
  id: string;
  title?: string;
  content?: string;
  notes?: string;
  blocks?: Array<{
    type: string;
    content?: unknown;
  }>;
}

interface PresentationData {
  id: string;
  title: string;
  description?: string;
  slides: SlideContent[];
  metadata?: {
    author?: string;
    createdAt?: Date;
    tags?: string[];
  };
}

interface PresentationSummary {
  executive: string;
  keyPoints: string[];
  slideOverviews: Array<{
    slideNumber: number;
    title: string;
    summary: string;
    keyTakeaway: string;
  }>;
  actionItems: string[];
  audienceNotes: string;
  talkingPoints: string[];
  hashtags: string[];
  socialPost: {
    twitter: string;
    linkedin: string;
  };
  outline: string;
  wordCloud: Array<{ word: string; weight: number }>;
  readingTime: number;
  complexity: 'beginner' | 'intermediate' | 'advanced';
}

interface SummaryOptions {
  style: 'executive' | 'detailed' | 'bullet-points' | 'narrative';
  length: 'short' | 'medium' | 'long';
  audience: 'general' | 'technical' | 'executive' | 'academic';
  includeActionItems: boolean;
  includeSocialPosts: boolean;
  language: string;
}

@Injectable()
export class PresentationSummarizerService {
  private readonly logger = new Logger(PresentationSummarizerService.name);
  private readonly openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async summarizePresentation(
    presentation: PresentationData,
    options: Partial<SummaryOptions> = {},
  ): Promise<PresentationSummary> {
    const defaultOptions: SummaryOptions = {
      style: 'executive',
      length: 'medium',
      audience: 'general',
      includeActionItems: true,
      includeSocialPosts: true,
      language: 'en',
      ...options,
    };

    const presentationText = this.extractPresentationText(presentation);

    const [
      executiveSummary,
      keyPoints,
      slideOverviews,
      actionItems,
      socialPosts,
      talkingPoints,
      wordCloud,
    ] = await Promise.all([
      this.generateExecutiveSummary(presentationText, defaultOptions),
      this.extractKeyPoints(presentationText, defaultOptions),
      this.generateSlideOverviews(presentation.slides),
      defaultOptions.includeActionItems
        ? this.extractActionItems(presentationText)
        : Promise.resolve([]),
      defaultOptions.includeSocialPosts
        ? this.generateSocialPosts(presentation.title, presentationText)
        : Promise.resolve({ twitter: '', linkedin: '' }),
      this.generateTalkingPoints(presentationText),
      this.generateWordCloud(presentationText),
    ]);

    const audienceNotes = await this.generateAudienceNotes(
      presentationText,
      defaultOptions.audience,
    );

    const outline = this.generateOutline(presentation);

    return {
      executive: executiveSummary,
      keyPoints,
      slideOverviews,
      actionItems,
      audienceNotes,
      talkingPoints,
      hashtags: this.extractHashtags(presentationText),
      socialPost: socialPosts,
      outline,
      wordCloud,
      readingTime: this.calculateReadingTime(presentationText),
      complexity: this.assessComplexity(presentationText),
    };
  }

  private extractPresentationText(presentation: PresentationData): string {
    const parts: string[] = [];

    parts.push(`Title: ${presentation.title}`);
    if (presentation.description) {
      parts.push(`Description: ${presentation.description}`);
    }

    for (const slide of presentation.slides) {
      if (slide.title) {
        parts.push(`\n## ${slide.title}`);
      }
      if (slide.content) {
        parts.push(slide.content);
      }
      if (slide.blocks) {
        for (const block of slide.blocks) {
          if (block.type === 'text' && typeof block.content === 'string') {
            parts.push(block.content);
          }
        }
      }
      if (slide.notes) {
        parts.push(`[Notes: ${slide.notes}]`);
      }
    }

    return parts.join('\n');
  }

  private async generateExecutiveSummary(
    text: string,
    options: SummaryOptions,
  ): Promise<string> {
    const lengthGuide = {
      short: '2-3 sentences',
      medium: '1 paragraph (4-6 sentences)',
      long: '2-3 paragraphs',
    };

    const styleGuide = {
      executive:
        'high-level, business-focused, emphasizing key outcomes and decisions',
      detailed:
        'comprehensive, covering all major points with supporting details',
      'bullet-points': 'structured as clear bullet points',
      narrative: 'flowing narrative style, telling a story',
    };

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert at summarizing presentations. Generate a ${styleGuide[options.style]} summary in ${lengthGuide[options.length]}. Target audience: ${options.audience}. Language: ${options.language}.`,
        },
        {
          role: 'user',
          content: `Summarize this presentation:\n\n${text}`,
        },
      ],
      temperature: 0.5,
      max_tokens: 500,
    });

    return response.choices[0]?.message?.content || '';
  }

  private async extractKeyPoints(
    text: string,
    options: SummaryOptions,
  ): Promise<string[]> {
    const count =
      options.length === 'short' ? 3 : options.length === 'medium' ? 5 : 8;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Extract the ${count} most important key points from the presentation. Return as a JSON array of strings. Target audience: ${options.audience}.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    try {
      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      return result.keyPoints || result.points || [];
    } catch {
      return [];
    }
  }

  private async generateSlideOverviews(
    slides: SlideContent[],
  ): Promise<PresentationSummary['slideOverviews']> {
    const overviews: PresentationSummary['slideOverviews'] = [];

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const slideText = [
        slide.title,
        slide.content,
        slide.blocks
          ?.filter((b) => b.type === 'text')
          .map((b) => b.content)
          .join(' '),
      ]
        .filter(Boolean)
        .join(' ');

      if (!slideText.trim()) {
        overviews.push({
          slideNumber: i + 1,
          title: slide.title || `Slide ${i + 1}`,
          summary: 'Visual or media content',
          keyTakeaway: '',
        });
        continue;
      }

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'Summarize this slide in 1-2 sentences and provide a key takeaway. Return JSON with "summary" and "keyTakeaway" fields.',
          },
          {
            role: 'user',
            content: slideText,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
        max_tokens: 200,
      });

      try {
        const result = JSON.parse(
          response.choices[0]?.message?.content || '{}',
        );
        overviews.push({
          slideNumber: i + 1,
          title: slide.title || `Slide ${i + 1}`,
          summary: result.summary || '',
          keyTakeaway: result.keyTakeaway || '',
        });
      } catch {
        overviews.push({
          slideNumber: i + 1,
          title: slide.title || `Slide ${i + 1}`,
          summary: '',
          keyTakeaway: '',
        });
      }
    }

    return overviews;
  }

  private async extractActionItems(text: string): Promise<string[]> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'Extract actionable items, next steps, or calls to action from this presentation. Return as a JSON object with an "actionItems" array. If none found, return empty array.',
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    try {
      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      return result.actionItems || [];
    } catch {
      return [];
    }
  }

  private async generateAudienceNotes(
    text: string,
    audience: string,
  ): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are helping tailor a presentation for a ${audience} audience. Provide specific notes on how the content should be presented or adapted for this audience type.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.5,
      max_tokens: 300,
    });

    return response.choices[0]?.message?.content || '';
  }

  private async generateTalkingPoints(text: string): Promise<string[]> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'Generate 5-7 key talking points that a presenter should emphasize when delivering this presentation. Return as a JSON object with a "talkingPoints" array.',
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' },
    });

    try {
      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      return result.talkingPoints || [];
    } catch {
      return [];
    }
  }

  private async generateSocialPosts(
    title: string,
    text: string,
  ): Promise<{ twitter: string; linkedin: string }> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'Generate social media posts for sharing this presentation. Return JSON with "twitter" (max 280 chars, include hashtags) and "linkedin" (2-3 sentences, professional) fields.',
        },
        {
          role: 'user',
          content: `Title: ${title}\n\nContent Summary:\n${text.substring(0, 1000)}`,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    try {
      return JSON.parse(response.choices[0]?.message?.content || '{}');
    } catch {
      return { twitter: '', linkedin: '' };
    }
  }

  private async generateWordCloud(
    text: string,
  ): Promise<Array<{ word: string; weight: number }>> {
    // Simple word frequency analysis
    const words = text
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 3);

    const stopWords = new Set([
      'this',
      'that',
      'with',
      'from',
      'have',
      'been',
      'will',
      'they',
      'their',
      'what',
      'when',
      'where',
      'which',
      'about',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'under',
      'again',
      'further',
      'then',
      'once',
      'here',
      'there',
      'some',
      'such',
      'other',
      'than',
      'these',
      'those',
      'only',
      'same',
      'just',
      'also',
      'more',
      'most',
      'very',
      'slide',
      'slides',
      'presentation',
      'title',
      'notes',
    ]);

    const frequency: Record<string, number> = {};
    for (const word of words) {
      if (!stopWords.has(word)) {
        frequency[word] = (frequency[word] || 0) + 1;
      }
    }

    const sorted = Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);

    const maxFreq = sorted[0]?.[1] || 1;

    return sorted.map(([word, count]) => ({
      word,
      weight: Math.round((count / maxFreq) * 100),
    }));
  }

  private generateOutline(presentation: PresentationData): string {
    const lines: string[] = [];
    lines.push(`# ${presentation.title}`);
    if (presentation.description) {
      lines.push(`*${presentation.description}*`);
    }
    lines.push('');

    for (let i = 0; i < presentation.slides.length; i++) {
      const slide = presentation.slides[i];
      lines.push(`${i + 1}. ${slide.title || `Slide ${i + 1}`}`);
    }

    return lines.join('\n');
  }

  private extractHashtags(text: string): string[] {
    // Extract topics and convert to hashtags
    const words = text
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 4);

    const frequency: Record<string, number> = {};
    for (const word of words) {
      frequency[word] = (frequency[word] || 0) + 1;
    }

    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => `#${word}`);
  }

  private calculateReadingTime(text: string): number {
    const wordsPerMinute = 200;
    const words = text.split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
  }

  private assessComplexity(
    text: string,
  ): 'beginner' | 'intermediate' | 'advanced' {
    // Simple heuristic based on average word length and sentence length
    const words = text.split(/\s+/);
    const avgWordLength =
      words.reduce((sum, w) => sum + w.length, 0) / words.length;
    const sentences = text.split(/[.!?]+/).length;
    const avgSentenceLength = words.length / sentences;

    if (avgWordLength > 7 || avgSentenceLength > 25) {
      return 'advanced';
    }
    if (avgWordLength > 5 || avgSentenceLength > 15) {
      return 'intermediate';
    }
    return 'beginner';
  }

  async generateQuickSummary(text: string): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Provide a 2-3 sentence summary of this presentation.',
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.5,
      max_tokens: 150,
    });

    return response.choices[0]?.message?.content || '';
  }
}
