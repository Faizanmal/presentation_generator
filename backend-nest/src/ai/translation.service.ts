import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface TranslationResult {
  originalLanguage: string;
  targetLanguage: string;
  translations: SlideTranslation[];
  warnings: string[];
}

export interface SlideTranslation {
  slideId: string;
  originalContent: any;
  translatedContent: any;
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
  private openai: OpenAI;

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
    { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', rtl: false },
    { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', rtl: false },
  ];

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  getSupportedLanguages(): SupportedLanguage[] {
    return this.supportedLanguages;
  }

  async detectLanguage(text: string): Promise<{ code: string; confidence: number }> {
    const prompt = `Detect the language of the following text and return the ISO 639-1 language code.

Text: "${text.substring(0, 500)}"

Return JSON: { "code": "xx", "confidence": 0.0 }`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });

      const result = this.parseJsonResponse(response.choices[0].message.content || '{}');
      return {
        code: result.code || 'en',
        confidence: result.confidence || 0.5,
      };
    } catch {
      return { code: 'en', confidence: 0.5 };
    }
  }

  async translatePresentation(
    slides: any[],
    targetLanguage: string,
    options: {
      preserveFormatting?: boolean;
      adaptCulturally?: boolean;
      glossary?: Record<string, string>;
    } = {}
  ): Promise<TranslationResult> {
    const targetLang = this.supportedLanguages.find((l) => l.code === targetLanguage);
    if (!targetLang) {
      throw new Error(`Unsupported language: ${targetLanguage}`);
    }

    const translations: SlideTranslation[] = [];
    const warnings: string[] = [];

    // Detect source language from first slide
    const firstSlideText = this.extractText(slides[0]?.content);
    const sourceLanguage = await this.detectLanguage(firstSlideText);

    for (const slide of slides) {
      try {
        const translated = await this.translateSlide(
          slide,
          sourceLanguage.code,
          targetLanguage,
          options
        );
        translations.push(translated);
      } catch (error) {
        warnings.push(`Failed to translate slide ${slide.id}: ${error}`);
        translations.push({
          slideId: slide.id,
          originalContent: slide.content,
          translatedContent: slide.content,
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
    slide: any,
    sourceLanguage: string,
    targetLanguage: string,
    options: {
      preserveFormatting?: boolean;
      adaptCulturally?: boolean;
      glossary?: Record<string, string>;
    } = {}
  ): Promise<SlideTranslation> {
    const textElements = this.extractTextElements(slide.content);
    
    if (textElements.length === 0) {
      return {
        slideId: slide.id,
        originalContent: slide.content,
        translatedContent: slide.content,
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
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a professional translator specializing in business presentations. Maintain formatting, structure, and professional tone.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      });

      const translatedElements = this.parseJsonResponse(
        response.choices[0].message.content || '[]'
      );

      const translatedContent = this.applyTranslations(
        slide.content,
        textElements,
        translatedElements
      );

      return {
        slideId: slide.id,
        originalContent: slide.content,
        translatedContent,
        confidence: 0.9,
      };
    } catch (error) {
      console.error('Translation error:', error);
      return {
        slideId: slide.id,
        originalContent: slide.content,
        translatedContent: slide.content,
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
    } = {}
  ): Promise<{ translated: string; confidence: number }> {
    const formalityNote = options.formal
      ? 'Use formal language appropriate for business presentations.'
      : '';

    const contextNote = options.context
      ? `Context: ${options.context}`
      : '';

    const prompt = `Translate the following text to ${targetLanguage}:

"${text}"

${formalityNote}
${contextNote}

Return JSON: { "translated": "...", "confidence": 0.0 }`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      const result = this.parseJsonResponse(response.choices[0].message.content || '{}');
      return {
        translated: result.translated || text,
        confidence: result.confidence || 0.5,
      };
    } catch {
      return { translated: text, confidence: 0 };
    }
  }

  async createMultilingualPresentation(
    slides: any[],
    targetLanguages: string[]
  ): Promise<Map<string, TranslationResult>> {
    const results = new Map<string, TranslationResult>();

    for (const lang of targetLanguages) {
      const translation = await this.translatePresentation(slides, lang);
      results.set(lang, translation);
    }

    return results;
  }

  async suggestLocalizationImprovements(
    slides: any[],
    targetLanguage: string
  ): Promise<{
    suggestions: {
      slideId: string;
      issue: string;
      suggestion: string;
      severity: 'low' | 'medium' | 'high';
    }[];
  }> {
    const allText = slides.map((s) => this.extractText(s.content)).join('\n\n');

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
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      });

      return this.parseJsonResponse(response.choices[0].message.content || '{ "suggestions": [] }');
    } catch {
      return { suggestions: [] };
    }
  }

  private extractText(content: any): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.map((item) => this.extractText(item)).join(' ');
    }
    if (typeof content === 'object' && content !== null) {
      if (content.text) return content.text;
      if (content.content) return this.extractText(content.content);
      return Object.values(content)
        .map((v) => this.extractText(v))
        .join(' ');
    }
    return '';
  }

  private extractTextElements(
    content: any,
    path: string[] = []
  ): { path: string[]; text: string }[] {
    const elements: { path: string[]; text: string }[] = [];

    if (typeof content === 'string' && content.trim()) {
      elements.push({ path, text: content });
    } else if (Array.isArray(content)) {
      content.forEach((item, index) => {
        elements.push(...this.extractTextElements(item, [...path, String(index)]));
      });
    } else if (typeof content === 'object' && content !== null) {
      for (const [key, value] of Object.entries(content)) {
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
    originalContent: any,
    originalElements: { path: string[]; text: string }[],
    translatedElements: { path: string[]; text: string }[]
  ): any {
    const content = JSON.parse(JSON.stringify(originalContent));

    for (let i = 0; i < originalElements.length && i < translatedElements.length; i++) {
      const { path } = originalElements[i];
      const { text: translatedText } = translatedElements[i];

      this.setNestedValue(content, path, translatedText);
    }

    return content;
  }

  private setNestedValue(obj: any, path: string[], value: any): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (current[key] === undefined) return;
      current = current[key];
    }
    current[path[path.length - 1]] = value;
  }

  private parseJsonResponse(text: string): any {
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
