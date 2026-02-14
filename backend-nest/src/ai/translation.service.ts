import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIService } from './ai.service';

export interface TranslationResult {
  originalLanguage: string;
  targetLanguage: string;
  translations: SlideTranslation[];
  warnings: string[];
}

export interface SlideTranslation {
  slideId: string;
  originalContent: Record<string, unknown> | string;
  translatedContent: Record<string, unknown> | string;
  confidence: number;
}

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
}

@Injectable()
export class TranslationService {
  private supportedLanguages: SupportedLanguage[] = [
    { code: 'en', name: 'English', nativeName: 'English', rtl: false },
    { code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false },
    { code: 'fr', name: 'French', nativeName: 'Français', rtl: false },
    { code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false },
    { code: 'it', name: 'Italian', nativeName: 'Italiano', rtl: false },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', rtl: false },
    { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', rtl: false },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', rtl: false },
    { code: 'zh', name: 'Chinese', nativeName: '中文', rtl: false },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', rtl: false },
    { code: 'ko', name: 'Korean', nativeName: '한국어', rtl: false },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true },
    { code: 'he', name: 'Hebrew', nativeName: 'עברית', rtl: true },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', rtl: false },
    { code: 'th', name: 'Thai', nativeName: 'ไทย', rtl: false },
    { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', rtl: false },
    { code: 'pl', name: 'Polish', nativeName: 'Polski', rtl: false },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', rtl: false },
    { code: 'sv', name: 'Swedish', nativeName: 'Svenska', rtl: false },
    { code: 'da', name: 'Danish', nativeName: 'Dansk', rtl: false },
    { code: 'fi', name: 'Finnish', nativeName: 'Suomi', rtl: false },
    { code: 'no', name: 'Norwegian', nativeName: 'Norsk', rtl: false },
    { code: 'cs', name: 'Czech', nativeName: 'Čeština', rtl: false },
    { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', rtl: false },
    { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', rtl: false },
    { code: 'ro', name: 'Romanian', nativeName: 'Română', rtl: false },
    { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', rtl: false },
    {
      code: 'id',
      name: 'Indonesian',
      nativeName: 'Bahasa Indonesia',
      rtl: false,
    },
    { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', rtl: false },
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly aiService: AIService,
  ) {}

  getSupportedLanguages(): SupportedLanguage[] {
    return this.supportedLanguages;
  }

  async detectLanguage(
    text: string,
  ): Promise<{ code: string; confidence: number }> {
    const prompt = `Detect the language of the following text and return the ISO 639-1 language code.

Text: "${text.substring(0, 500)}"

Return JSON: { "code": "xx", "confidence": 0.0 }`;

    try {
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });

      const result = this.parseJsonResponse(
        response.choices[0].message.content || '{}',
      ) as { code: string; confidence: number };
      return {
        code: result.code || 'en',

        confidence: result.confidence || 0.5,
      };
    } catch {
      return { code: 'en', confidence: 0.5 };
    }
  }

  async translatePresentation(
    slides: unknown[],
    targetLanguage: string,
    options: {
      preserveFormatting?: boolean;
      adaptCulturally?: boolean;
      glossary?: Record<string, string>;
    } = {},
  ): Promise<TranslationResult> {
    const targetLang = this.supportedLanguages.find(
      (l) => l.code === targetLanguage,
    );
    if (!targetLang) {
      throw new Error(`Unsupported language: ${targetLanguage}`);
    }

    const translations: SlideTranslation[] = [];
    const warnings: string[] = [];

    // Detect source language from first slide
    const firstSlide = slides[0] as Record<string, unknown>;
    const firstSlideText = this.extractText(firstSlide?.content);
    const sourceLanguage = await this.detectLanguage(firstSlideText);

    for (const slide of slides as { id: string; content: unknown }[]) {
      try {
        const translated = await this.translateSlide(
          slide,
          sourceLanguage.code,
          targetLanguage,
          options,
        );
        translations.push(translated);
      } catch (error) {
        const s = slide as Record<string, unknown>;
        warnings.push(
          `Failed to translate slide ${String(s.id)}: ${String(error)}`,
        );
        translations.push({
          slideId: s.id as string,
          originalContent: s.content as Record<string, unknown>,
          translatedContent: s.content as Record<string, unknown>,
          confidence: 0,
        });
      }
    }

    return {
      originalLanguage: sourceLanguage.code,
      targetLanguage,
      translations,
      warnings,
    };
  }

  async translateSlide(
    slide: unknown,
    sourceLanguage: string,
    targetLanguage: string,
    options: {
      preserveFormatting?: boolean;
      adaptCulturally?: boolean;
      glossary?: Record<string, string>;
    } = {},
  ): Promise<SlideTranslation> {
    const slideRecord = slide as Record<string, unknown>;
    const textElements = this.extractTextElements(slideRecord.content);

    if (textElements.length === 0) {
      return {
        slideId: slideRecord.id as string,
        originalContent: slideRecord.content as Record<string, unknown>,
        translatedContent: slideRecord.content as Record<string, unknown>,
        confidence: 1,
      };
    }

    const glossaryInstructions = options.glossary
      ? `Use this glossary for specific terms: ${JSON.stringify(options.glossary)}`
      : '';

    const culturalAdaptation = options.adaptCulturally
      ? 'Adapt cultural references, idioms, and examples to be appropriate for the target audience.'
      : '';

    const prompt = `Translate the following presentation content from ${sourceLanguage} to ${targetLanguage}.

${glossaryInstructions}
${culturalAdaptation}

Maintain the exact JSON structure. Only translate text values, keep all other properties unchanged.

Content to translate:
${JSON.stringify(textElements, null, 2)}

Return the translated content as a JSON array with the same structure.`;

    try {
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a professional translator specializing in business presentations. Maintain formatting, structure, and professional tone.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      });

      const translatedElements = this.parseJsonResponse(
        response.choices[0].message.content || '[]',
      ) as { path: string[]; text: string }[];

      const translatedContent = this.applyTranslations(
        slideRecord.content as Record<string, unknown>,
        textElements,
        translatedElements,
      );

      return {
        slideId: slideRecord.id as string,
        originalContent: slideRecord.content as Record<string, unknown>,
        translatedContent,
        confidence: 0.9,
      };
    } catch (error) {
      console.error('Translation error:', error);
      return {
        slideId: slideRecord.id as string,

        originalContent: slideRecord.content as Record<string, unknown>,

        translatedContent: slideRecord.content as Record<string, unknown>,
        confidence: 0,
      };
    }
  }

  async translateText(
    text: string,
    targetLanguage: string,
    options: {
      context?: string;
      formal?: boolean;
    } = {},
  ): Promise<{ translated: string; confidence: number }> {
    const formalityNote = options.formal
      ? 'Use formal language appropriate for business presentations.'
      : '';

    const contextNote = options.context ? `Context: ${options.context}` : '';

    const prompt = `Translate the following text to ${targetLanguage}:

"${text}"

${formalityNote}
${contextNote}

Return JSON: { "translated": "...", "confidence": 0.0 }`;

    try {
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      const result = this.parseJsonResponse(
        response.choices[0].message.content || '{}',
      ) as { translated: string; confidence: number };
      return {
        translated: result.translated || text,

        confidence: result.confidence || 0.5,
      };
    } catch {
      return { translated: text, confidence: 0 };
    }
  }

  async createMultilingualPresentation(
    slides: unknown[],
    targetLanguages: string[],
  ): Promise<Map<string, TranslationResult>> {
    const results = new Map<string, TranslationResult>();

    for (const lang of targetLanguages) {
      const translation = await this.translatePresentation(slides, lang);
      results.set(lang, translation);
    }

    return results;
  }

  async suggestLocalizationImprovements(
    slides: unknown[],
    targetLanguage: string,
  ): Promise<{
    suggestions: {
      slideId: string;
      issue: string;
      suggestion: string;
      severity: 'low' | 'medium' | 'high';
    }[];
  }> {
    const allText = slides
      .map((s) => this.extractText((s as Record<string, unknown>).content))
      .join('\n\n');

    const prompt = `Analyze this presentation content for localization to ${targetLanguage}:

${allText}

Identify potential issues like:
1. Cultural references that may not translate well
2. Idioms or phrases that need adaptation
3. Date/number formats that need localization
4. Images or examples that may be culturally inappropriate

Return JSON:
{
  "suggestions": [
    {
      "slideId": "slide1",
      "issue": "Description of the issue",
      "suggestion": "How to fix it",
      "severity": "low|medium|high"
    }
  ]
}`;

    try {
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      });

      return this.parseJsonResponse(
        response.choices[0].message.content || '{ "suggestions": [] }',
      ) as {
        suggestions: {
          slideId: string;
          issue: string;
          suggestion: string;
          severity: 'low' | 'medium' | 'high';
        }[];
      };
    } catch {
      return { suggestions: [] };
    }
  }

  private extractText(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.map((item) => this.extractText(item)).join(' ');
    }
    if (typeof content === 'object' && content !== null) {
      const record = content as Record<string, unknown>;
      if ('text' in record && typeof record.text === 'string')
        return record.text;
      if ('content' in record) return this.extractText(record.content);
      return Object.values(record)
        .map((v) => this.extractText(v))
        .join(' ');
    }
    return '';
  }

  private extractTextElements(
    content: unknown,
    path: string[] = [],
  ): { path: string[]; text: string }[] {
    const elements: { path: string[]; text: string }[] = [];

    if (typeof content === 'string' && content.trim()) {
      elements.push({ path, text: content });
    } else if (Array.isArray(content)) {
      content.forEach((item, index) => {
        elements.push(
          ...this.extractTextElements(item, [...path, String(index)]),
        );
      });
    } else if (typeof content === 'object' && content !== null) {
      for (const [key, value] of Object.entries(
        content as Record<string, unknown>,
      )) {
        if (key === 'text' && typeof value === 'string') {
          elements.push({ path: [...path, key], text: value });
        } else {
          elements.push(...this.extractTextElements(value, [...path, key]));
        }
      }
    }

    return elements;
  }

  private applyTranslations(
    originalContent: unknown,
    originalElements: { path: string[]; text: string }[],
    translatedElements: { path: string[]; text: string }[],
  ): Record<string, unknown> {
    const content = JSON.parse(JSON.stringify(originalContent)) as Record<
      string,
      unknown
    >;

    for (
      let i = 0;
      i < originalElements.length && i < translatedElements.length;
      i++
    ) {
      const { path } = originalElements[i];
      const { text: translatedText } = translatedElements[i];

      this.setNestedValue(content, path, translatedText);
    }

    return content;
  }

  private setNestedValue(obj: unknown, path: string[], value: unknown): void {
    let current = obj as Record<string, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (current[key] === undefined) return;
      current = current[key] as Record<string, unknown>;
    }
    const lastKey = path[path.length - 1];
    if (current && typeof current === 'object') {
      current[lastKey] = value;
    }
  }

  private parseJsonResponse(text: string): unknown {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(text);
    } catch {
      return {};
    }
  }
}
