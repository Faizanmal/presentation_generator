import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface ContentSuggestion {
  id: string;
  type:
    | 'text'
    | 'image'
    | 'icon'
    | 'chart'
    | 'quote'
    | 'statistic'
    | 'bullet'
    | 'layout';
  content: string | any;
  confidence: number;
  reason: string;
  preview?: string;
}

export interface SmartCompleteResult {
  completions: string[];
  context: string;
}

export interface RelatedContent {
  images: { url: string; description: string }[];
  icons: { name: string; category: string }[];
  quotes: { text: string; author: string }[];
  statistics: { value: string; description: string; source?: string }[];
}

@Injectable()
export class SmartSuggestionsService {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async getSuggestionsForSlide(
    slideContent: any,
    presentationContext: {
      title: string;
      topic: string;
      previousSlides: any[];
      targetAudience?: string;
    },
  ): Promise<ContentSuggestion[]> {
    const suggestions: ContentSuggestion[] = [];

    // Analyze current slide content
    const currentText = this.extractText(slideContent);
    const slideType = this.detectSlideType(slideContent);

    const prompt = `Analyze this presentation slide and suggest improvements:

Presentation Topic: ${presentationContext.topic}
Target Audience: ${presentationContext.targetAudience || 'General'}
Slide Type: ${slideType}
Current Content: ${currentText}

Provide 5-7 specific suggestions to improve this slide. For each suggestion, provide:
1. Type (text, image, chart, quote, statistic, bullet, layout)
2. The actual content or description
3. Confidence score (0-1)
4. Brief reason why this improves the slide

Format as JSON array with: type, content, confidence, reason`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a presentation design expert. Provide actionable suggestions to improve slide content and design.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      });

      const parsed = this.parseJsonResponse(
        response.choices[0].message.content || '[]',
      );

      for (const item of parsed) {
        suggestions.push({
          id: `sug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: item.type,
          content: item.content,
          confidence: item.confidence,
          reason: item.reason,
        });
      }
    } catch (error) {
      console.error('Smart suggestions error:', error);
    }

    return suggestions;
  }

  async smartComplete(
    partialText: string,
    context: {
      slideTitle?: string;
      presentationTopic?: string;
      previousBullets?: string[];
    },
  ): Promise<SmartCompleteResult> {
    const prompt = `Complete this text for a presentation slide:

Topic: ${context.presentationTopic || 'Unknown'}
Slide Title: ${context.slideTitle || 'Unknown'}
Previous bullets: ${context.previousBullets?.join(', ') || 'None'}

Partial text: "${partialText}"

Provide 3 possible completions that:
1. Are concise and impactful
2. Fit the professional presentation context
3. Add value to the slide content

Return as JSON: { "completions": ["completion1", "completion2", "completion3"] }`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
      });

      const parsed = this.parseJsonResponse(
        response.choices[0].message.content || '{}',
      );

      return {
        completions: parsed.completions || [],
        context: partialText,
      };
    } catch (error) {
      return { completions: [], context: partialText };
    }
  }

  async suggestRelatedContent(
    topic: string,
    slideContent: any,
  ): Promise<RelatedContent> {
    const prompt = `For a presentation about "${topic}", suggest related content:

Current slide content: ${this.extractText(slideContent)}

Suggest:
1. 3 image descriptions that would enhance this slide
2. 3 relevant icons
3. 2 relevant quotes
4. 3 statistics that could be used

Format as JSON:
{
  "images": [{ "description": "..." }],
  "icons": [{ "name": "...", "category": "..." }],
  "quotes": [{ "text": "...", "author": "..." }],
  "statistics": [{ "value": "...", "description": "...", "source": "..." }]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      const parsed = this.parseJsonResponse(
        response.choices[0].message.content || '{}',
      );

      return {
        images: parsed.images || [],
        icons: parsed.icons || [],
        quotes: parsed.quotes || [],
        statistics: parsed.statistics || [],
      };
    } catch (error) {
      return { images: [], icons: [], quotes: [], statistics: [] };
    }
  }

  async suggestNextSlide(
    currentSlides: any[],
    presentationTopic: string,
  ): Promise<{
    suggestedType: string;
    suggestedTitle: string;
    suggestedContent: string[];
    reason: string;
  }> {
    const slideSummaries = currentSlides
      .map((s, i) => `Slide ${i + 1}: ${this.extractText(s).substring(0, 100)}`)
      .join('\n');

    const prompt = `Based on these existing slides about "${presentationTopic}":

${slideSummaries}

Suggest what the next slide should be about. Consider:
1. Logical flow
2. Missing important topics
3. Engagement variety

Respond with JSON:
{
  "suggestedType": "content|agenda|summary|question|comparison|timeline|etc",
  "suggestedTitle": "Suggested Title",
  "suggestedContent": ["bullet 1", "bullet 2", "bullet 3"],
  "reason": "Why this slide makes sense next"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      return this.parseJsonResponse(
        response.choices[0].message.content || '{}',
      );
    } catch (error) {
      return {
        suggestedType: 'content',
        suggestedTitle: 'Continue Here',
        suggestedContent: ['Add your next key point'],
        reason: 'Continue building your presentation',
      };
    }
  }

  async rewriteContent(
    content: string,
    style:
      | 'professional'
      | 'casual'
      | 'concise'
      | 'detailed'
      | 'persuasive'
      | 'educational',
  ): Promise<{ rewritten: string; changes: string[] }> {
    const styleGuides: Record<string, string> = {
      professional:
        'Use formal language, avoid contractions, maintain objectivity',
      casual: 'Use friendly language, contractions okay, conversational tone',
      concise: 'Reduce to essential points only, use short sentences',
      detailed: 'Expand with examples and explanations',
      persuasive: 'Use action verbs, emotional appeals, strong calls to action',
      educational: 'Break down concepts, use clear explanations, add context',
    };

    const prompt = `Rewrite this presentation content in a ${style} style:

Original: "${content}"

Style guide: ${styleGuides[style]}

Respond with JSON:
{
  "rewritten": "the rewritten content",
  "changes": ["change 1 made", "change 2 made"]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      return this.parseJsonResponse(
        response.choices[0].message.content || '{}',
      );
    } catch (error) {
      return { rewritten: content, changes: [] };
    }
  }

  async expandBulletPoint(
    bulletPoint: string,
    context: string,
  ): Promise<{
    expandedContent: string;
    subPoints: string[];
    speakerNotes: string;
  }> {
    const prompt = `Expand this bullet point for a presentation:

Bullet: "${bulletPoint}"
Context: "${context}"

Provide:
1. An expanded version of this bullet point
2. 2-3 supporting sub-points
3. Speaker notes for presenting this point

JSON format:
{
  "expandedContent": "...",
  "subPoints": ["...", "..."],
  "speakerNotes": "..."
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      return this.parseJsonResponse(
        response.choices[0].message.content || '{}',
      );
    } catch (error) {
      return {
        expandedContent: bulletPoint,
        subPoints: [],
        speakerNotes: '',
      };
    }
  }

  async suggestVisualElements(slideContent: any): Promise<{
    layout: string;
    colors: string[];
    visualType: string;
    iconSuggestions: string[];
  }> {
    const text = this.extractText(slideContent);

    const prompt = `Suggest visual elements for this slide content:

"${text}"

Recommend:
1. Layout type (split, centered, grid, comparison, etc.)
2. Color scheme (3 hex colors)
3. Best visual type (chart, image, icons, diagram, etc.)
4. Specific icons that would work

JSON:
{
  "layout": "...",
  "colors": ["#...", "#...", "#..."],
  "visualType": "...",
  "iconSuggestions": ["icon1", "icon2", "icon3"]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      return this.parseJsonResponse(
        response.choices[0].message.content || '{}',
      );
    } catch (error) {
      return {
        layout: 'centered',
        colors: ['#3B82F6', '#10B981', '#6366F1'],
        visualType: 'image',
        iconSuggestions: ['lightbulb', 'chart', 'check'],
      };
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

  private detectSlideType(content: any): string {
    const text = this.extractText(content).toLowerCase();

    if (text.includes('agenda') || text.includes('outline')) return 'agenda';
    if (text.includes('thank you') || text.includes('questions'))
      return 'closing';
    if (text.includes('introduction') || text.includes('welcome'))
      return 'introduction';
    if (text.includes('comparison') || text.includes(' vs '))
      return 'comparison';
    if (text.includes('timeline') || text.includes('roadmap'))
      return 'timeline';
    if (text.includes('summary') || text.includes('conclusion'))
      return 'summary';

    return 'content';
  }

  private parseJsonResponse(text: string): any {
    try {
      // Try to extract JSON from the response
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
