import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

export interface PresentationAnalysis {
  overallScore: number;
  categories: {
    content: CategoryScore;
    design: CategoryScore;
    engagement: CategoryScore;
    clarity: CategoryScore;
    accessibility: CategoryScore;
  };
  suggestions: Suggestion[];
  strengths: string[];
  improvements: string[];
  estimatedDuration: number;
  readabilityScore: number;
  wordCount: number;
  slideCount: number;
}

export interface CategoryScore {
  score: number;
  maxScore: number;
  feedback: string;
  tips: string[];
}

export interface Suggestion {
  type: 'critical' | 'warning' | 'info';
  category: string;
  slideIndex?: number;
  title: string;
  description: string;
  autoFixAvailable: boolean;
  autoFixAction?: string;
}

export interface RehearsalFeedback {
  pace: {
    wordsPerMinute: number;
    rating: 'too-slow' | 'good' | 'too-fast';
    suggestion: string;
  };
  fillerWords: {
    count: number;
    words: { word: string; count: number }[];
    suggestion: string;
  };
  clarity: {
    score: number;
    feedback: string;
  };
  timing: {
    totalDuration: number;
    perSlide: { slideIndex: number; duration: number; suggested: number }[];
    suggestion: string;
  };
  confidence: {
    score: number;
    indicators: string[];
    tips: string[];
  };
}

@Injectable()
export class PresentationCoachService {
  private readonly logger = new Logger(PresentationCoachService.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get('OPENAI_API_KEY'),
    });
  }

  async analyzePresentation(presentation: {
    title: string;
    slides: Array<{
      content: string;
      speakerNotes?: string;
      hasImage: boolean;
      layout: string;
    }>;
    audience?: string;
    purpose?: string;
  }): Promise<PresentationAnalysis> {
    const { slides } = presentation;
    const totalWords = slides.reduce(
      (acc, s) => acc + s.content.split(/\s+/).length,
      0,
    );
    const slideCount = slides.length;

    // Analyze with AI
    const prompt = `Analyze this presentation and provide detailed feedback:

Title: ${presentation.title}
Audience: ${presentation.audience || 'General'}
Purpose: ${presentation.purpose || 'Inform'}

Slides:
${slides
  .map(
    (s, i) => `
Slide ${i + 1} (${s.layout}):
Content: ${s.content}
Speaker Notes: ${s.speakerNotes || 'None'}
Has Image: ${s.hasImage}
`,
  )
  .join('\n')}

Provide analysis in JSON format:
{
  "overallScore": <0-100>,
  "content": {
    "score": <0-25>,
    "feedback": "<feedback>",
    "tips": ["<tip1>", "<tip2>"]
  },
  "design": {
    "score": <0-25>,
    "feedback": "<feedback>",
    "tips": ["<tip1>", "<tip2>"]
  },
  "engagement": {
    "score": <0-25>,
    "feedback": "<feedback>",
    "tips": ["<tip1>", "<tip2>"]
  },
  "clarity": {
    "score": <0-25>,
    "feedback": "<feedback>",
    "tips": ["<tip1>", "<tip2>"]
  },
  "suggestions": [
    {
      "type": "critical|warning|info",
      "category": "<category>",
      "slideIndex": <optional number>,
      "title": "<title>",
      "description": "<description>",
      "autoFixAvailable": true|false
    }
  ],
  "strengths": ["<strength1>", "<strength2>"],
  "improvements": ["<improvement1>", "<improvement2>"]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert presentation coach. Analyze presentations and provide actionable feedback. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      return {
        overallScore: analysis.overallScore || 75,
        categories: {
          content: {
            score: analysis.content?.score || 20,
            maxScore: 25,
            feedback: analysis.content?.feedback || 'Content analysis pending',
            tips: analysis.content?.tips || [],
          },
          design: {
            score: analysis.design?.score || 20,
            maxScore: 25,
            feedback: analysis.design?.feedback || 'Design analysis pending',
            tips: analysis.design?.tips || [],
          },
          engagement: {
            score: analysis.engagement?.score || 18,
            maxScore: 25,
            feedback:
              analysis.engagement?.feedback || 'Engagement analysis pending',
            tips: analysis.engagement?.tips || [],
          },
          clarity: {
            score: analysis.clarity?.score || 20,
            maxScore: 25,
            feedback: analysis.clarity?.feedback || 'Clarity analysis pending',
            tips: analysis.clarity?.tips || [],
          },
          accessibility: await this.checkAccessibility(slides),
        },
        suggestions: analysis.suggestions || [],
        strengths: analysis.strengths || [],
        improvements: analysis.improvements || [],
        estimatedDuration: Math.ceil(totalWords / 130), // ~130 words per minute
        readabilityScore: this.calculateReadability(slides),
        wordCount: totalWords,
        slideCount,
      };
    } catch (error) {
      this.logger.error('Failed to analyze presentation:', error);
      throw error;
    }
  }

  async getRehearsalFeedback(rehearsalData: {
    transcript: string;
    duration: number;
    slideTimings: { slideIndex: number; startTime: number; endTime: number }[];
    suggestedDurationPerSlide: number;
  }): Promise<RehearsalFeedback> {
    const { transcript, duration, slideTimings, suggestedDurationPerSlide } =
      rehearsalData;
    const words = transcript.split(/\s+/).filter((w) => w.length > 0);
    const wordCount = words.length;
    const wpm = Math.round((wordCount / duration) * 60);

    // Detect filler words
    const fillerWordsList = [
      'um',
      'uh',
      'like',
      'you know',
      'basically',
      'actually',
      'literally',
      'so',
      'right',
      'okay',
    ];
    const fillerCounts: Record<string, number> = {};

    fillerWordsList.forEach((filler) => {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      const matches = transcript.match(regex);
      if (matches && matches.length > 0) {
        fillerCounts[filler] = matches.length;
      }
    });

    const totalFillers = Object.values(fillerCounts).reduce((a, b) => a + b, 0);

    // Analyze with AI for confidence and clarity
    const prompt = `Analyze this presentation rehearsal transcript for confidence and clarity:

Transcript: "${transcript.substring(0, 2000)}..."
Duration: ${duration} seconds
Words per minute: ${wpm}
Filler word count: ${totalFillers}

Provide analysis in JSON format:
{
  "clarityScore": <0-100>,
  "clarityFeedback": "<feedback>",
  "confidenceScore": <0-100>,
  "confidenceIndicators": ["<indicator1>", "<indicator2>"],
  "confidenceTips": ["<tip1>", "<tip2>"]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a presentation coach analyzing rehearsal performance. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      return {
        pace: {
          wordsPerMinute: wpm,
          rating: wpm < 100 ? 'too-slow' : wpm > 160 ? 'too-fast' : 'good',
          suggestion:
            wpm < 100
              ? 'Try to speak a bit faster to maintain audience engagement.'
              : wpm > 160
                ? 'Slow down slightly to ensure your audience can follow along.'
                : 'Great pace! Your speaking speed is ideal for presentations.',
        },
        fillerWords: {
          count: totalFillers,
          words: Object.entries(fillerCounts).map(([word, count]) => ({
            word,
            count,
          })),
          suggestion:
            totalFillers > 10
              ? 'Practice pausing instead of using filler words. This will make you sound more confident.'
              : 'Good job minimizing filler words!',
        },
        clarity: {
          score: analysis.clarityScore || 80,
          feedback: analysis.clarityFeedback || 'Your articulation is clear.',
        },
        timing: {
          totalDuration: duration,
          perSlide: slideTimings.map((st) => ({
            slideIndex: st.slideIndex,
            duration: st.endTime - st.startTime,
            suggested: suggestedDurationPerSlide,
          })),
          suggestion: this.getTimingSuggestion(
            slideTimings,
            suggestedDurationPerSlide,
          ),
        },
        confidence: {
          score: analysis.confidenceScore || 75,
          indicators: analysis.confidenceIndicators || [],
          tips: analysis.confidenceTips || [
            'Practice more to build confidence',
          ],
        },
      };
    } catch (error) {
      this.logger.error('Failed to analyze rehearsal:', error);
      throw error;
    }
  }

  async suggestImprovements(slide: {
    content: string;
    type: string;
    context: string;
  }): Promise<{
    improvedContent: string;
    explanation: string;
    alternatives: string[];
  }> {
    const prompt = `Improve this presentation slide content:

Content: ${slide.content}
Slide Type: ${slide.type}
Context: ${slide.context}

Provide improvements in JSON format:
{
  "improvedContent": "<improved version>",
  "explanation": "<why this is better>",
  "alternatives": ["<alt1>", "<alt2>", "<alt3>"]
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a presentation expert. Improve content to be more engaging and clear. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  async generateSpeakerNotes(slide: {
    title: string;
    content: string;
    context: string;
    duration: number;
  }): Promise<{
    notes: string;
    talkingPoints: string[];
    transitionPhrase: string;
  }> {
    const prompt = `Generate speaker notes for this slide:

Title: ${slide.title}
Content: ${slide.content}
Context: ${slide.context}
Target Duration: ${slide.duration} seconds

Provide in JSON format:
{
  "notes": "<comprehensive speaker notes>",
  "talkingPoints": ["<point1>", "<point2>", "<point3>"],
  "transitionPhrase": "<smooth transition to next slide>"
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a presentation coach. Generate helpful speaker notes. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  private async checkAccessibility(
    slides: Array<{ content: string; hasImage: boolean }>,
  ): Promise<CategoryScore> {
    let score = 25;
    const tips: string[] = [];

    // Check for image alt text (simplified check)
    const slidesWithImages = slides.filter((s) => s.hasImage).length;
    if (slidesWithImages > 0) {
      tips.push('Ensure all images have descriptive alt text');
      score -= 3;
    }

    // Check for color contrast (would need more data in real implementation)
    tips.push('Verify text has sufficient contrast against backgrounds');

    // Check for font sizes
    tips.push('Use minimum 24pt font for body text for readability');

    // Check for content density
    const avgWordsPerSlide =
      slides.reduce((acc, s) => acc + s.content.split(/\s+/).length, 0) /
      slides.length;
    if (avgWordsPerSlide > 75) {
      tips.push('Consider reducing text per slide for better readability');
      score -= 5;
    }

    return {
      score,
      maxScore: 25,
      feedback:
        score >= 20
          ? 'Good accessibility practices'
          : 'Some accessibility improvements needed',
      tips,
    };
  }

  private calculateReadability(slides: Array<{ content: string }>): number {
    // Simplified Flesch-Kincaid readability score
    const text = slides.map((s) => s.content).join(' ');
    const sentences = text
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0).length;
    const words = text.split(/\s+/).filter((w) => w.length > 0).length;
    const syllables = this.countSyllables(text);

    if (sentences === 0 || words === 0) return 80;

    const fleschScore =
      206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
    return Math.max(0, Math.min(100, Math.round(fleschScore)));
  }

  private countSyllables(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    return words.reduce((count, word) => {
      word = word.replace(/[^a-z]/g, '');
      if (word.length <= 3) return count + 1;

      word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
      word = word.replace(/^y/, '');

      const syllables = word.match(/[aeiouy]{1,2}/g);
      return count + (syllables ? syllables.length : 1);
    }, 0);
  }

  private getTimingSuggestion(
    slideTimings: { slideIndex: number; startTime: number; endTime: number }[],
    suggested: number,
  ): string {
    const issues: string[] = [];

    slideTimings.forEach((st) => {
      const duration = st.endTime - st.startTime;
      if (duration < suggested * 0.5) {
        issues.push(`Slide ${st.slideIndex + 1} was too quick`);
      } else if (duration > suggested * 1.5) {
        issues.push(`Slide ${st.slideIndex + 1} took too long`);
      }
    });

    if (issues.length === 0) {
      return 'Great pacing across all slides!';
    }

    return `Consider adjusting timing: ${issues.slice(0, 3).join(', ')}${issues.length > 3 ? ` and ${issues.length - 3} more` : ''}.`;
  }
}
