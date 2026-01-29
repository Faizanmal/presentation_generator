import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';

export interface PresentationInsight {
  category: 'content' | 'engagement' | 'structure' | 'design' | 'timing' | 'audience';
  type: 'strength' | 'improvement' | 'suggestion' | 'warning';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  recommendation?: string;
  relatedSlides?: string[];
}

export interface ContentAnalysis {
  wordCount: number;
  readabilityScore: number;
  readingLevel: string;
  averageWordsPerSlide: number;
  keyTopics: { topic: string; frequency: number }[];
  sentimentOverall: 'positive' | 'neutral' | 'negative';
  jargonWords: string[];
  actionWords: { word: string; count: number }[];
}

export interface StructureAnalysis {
  hasIntroduction: boolean;
  hasConclusion: boolean;
  hasAgenda: boolean;
  sectionCount: number;
  slideDistribution: { section: string; count: number }[];
  flowScore: number;
  logicalGaps: string[];
}

export interface TimingAnalysis {
  totalEstimatedTime: number;
  perSlideTime: { slideId: string; estimatedSeconds: number }[];
  pacingIssues: { slideId: string; issue: string }[];
  recommendedBreakPoints: number[];
}

export interface AudienceAnalysis {
  complexity: 'beginner' | 'intermediate' | 'advanced';
  technicalLevel: number;
  assumedKnowledge: string[];
  accessibilityScore: number;
  accessibilityIssues: { slideId: string; issue: string }[];
}

export interface ComprehensiveInsights {
  overallScore: number;
  insights: PresentationInsight[];
  content: ContentAnalysis;
  structure: StructureAnalysis;
  timing: TimingAnalysis;
  audience: AudienceAnalysis;
  competitorComparison?: {
    similarPresentations: string[];
    uniqueAspects: string[];
    missingElements: string[];
  };
}

@Injectable()
export class PresentationInsightsService {
  private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async analyzePresentation(projectId: string): Promise<ComprehensiveInsights> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { slides: { orderBy: { order: 'asc' } } },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const slides = project.slides;
    const allContent = slides.map((s: any) => 
      this.extractText(s.blocks?.map((b: any) => b.content).join('\n') || '')
    ).join('\n\n');

    // Run analyses in parallel
    const [contentAnalysis, structureAnalysis, timingAnalysis, audienceAnalysis, aiInsights] =
      await Promise.all([
        this.analyzeContent(slides),
        this.analyzeStructure(slides),
        this.analyzeTiming(slides),
        this.analyzeAudience(slides),
        this.getAIInsights(project.title || '', allContent, slides.length),
      ]);

    // Calculate overall score
    const overallScore = this.calculateOverallScore({
      content: contentAnalysis,
      structure: structureAnalysis,
      timing: timingAnalysis,
      audience: audienceAnalysis,
    });

    return {
      overallScore,
      insights: aiInsights,
      content: contentAnalysis,
      structure: structureAnalysis,
      timing: timingAnalysis,
      audience: audienceAnalysis,
    };
  }

  private async analyzeContent(slides: any[]): Promise<ContentAnalysis> {
    let totalWords = 0;
    const topicCounts = new Map<string, number>();
    const actionWordCounts = new Map<string, number>();
    const jargonSet = new Set<string>();

    const actionVerbs = [
      'achieve', 'build', 'create', 'develop', 'drive', 'enable', 'grow',
      'improve', 'increase', 'launch', 'lead', 'optimize', 'reduce', 'transform',
    ];

    for (const slide of slides) {
      const text = this.extractText(slide.content);
      const words = text.toLowerCase().split(/\s+/).filter(Boolean);
      totalWords += words.length;

      // Count action words
      for (const word of words) {
        if (actionVerbs.includes(word)) {
          actionWordCounts.set(word, (actionWordCounts.get(word) || 0) + 1);
        }
      }

      // Extract potential topics (simple noun extraction)
      const potentialTopics = words.filter(
        (w) => w.length > 5 && !['their', 'which', 'would', 'could', 'should'].includes(w)
      );
      for (const topic of potentialTopics) {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
      }
    }

    const averageWordsPerSlide = slides.length > 0 ? totalWords / slides.length : 0;
    
    // Calculate readability (simplified Flesch-Kincaid)
    const readabilityScore = Math.max(0, Math.min(100, 100 - (averageWordsPerSlide - 30)));
    const readingLevel = this.getReadingLevel(readabilityScore);

    return {
      wordCount: totalWords,
      readabilityScore,
      readingLevel,
      averageWordsPerSlide: Math.round(averageWordsPerSlide),
      keyTopics: Array.from(topicCounts.entries())
        .map(([topic, frequency]) => ({ topic, frequency }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10),
      sentimentOverall: 'positive', // Would use sentiment analysis API
      jargonWords: Array.from(jargonSet),
      actionWords: Array.from(actionWordCounts.entries())
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  private async analyzeStructure(slides: any[]): Promise<StructureAnalysis> {
    const slideTexts = slides.map((s) => this.extractText(s.content).toLowerCase());

    const hasIntroduction =
      slideTexts.length > 0 &&
      (slideTexts[0].includes('introduction') ||
        slideTexts[0].includes('overview') ||
        slideTexts[0].includes('welcome'));

    const hasConclusion =
      slideTexts.length > 0 &&
      (slideTexts[slideTexts.length - 1].includes('conclusion') ||
        slideTexts[slideTexts.length - 1].includes('summary') ||
        slideTexts[slideTexts.length - 1].includes('thank you') ||
        slideTexts[slideTexts.length - 1].includes('questions'));

    const hasAgenda = slideTexts.some(
      (t) => t.includes('agenda') || t.includes('outline') || t.includes('today we will')
    );

    // Detect sections based on content patterns
    const sections: { section: string; count: number }[] = [];
    let currentSection = 'Introduction';
    let sectionCount = 0;

    for (const text of slideTexts) {
      if (text.includes('section') || text.length < 50) {
        currentSection = text.substring(0, 30);
        sectionCount++;
      }
    }

    // Calculate flow score
    let flowScore = 70;
    if (hasIntroduction) flowScore += 10;
    if (hasConclusion) flowScore += 10;
    if (hasAgenda) flowScore += 10;

    return {
      hasIntroduction,
      hasConclusion,
      hasAgenda,
      sectionCount: Math.max(1, sectionCount),
      slideDistribution: sections,
      flowScore: Math.min(100, flowScore),
      logicalGaps: [],
    };
  }

  private async analyzeTiming(slides: any[]): Promise<TimingAnalysis> {
    const perSlideTime: { slideId: string; estimatedSeconds: number }[] = [];
    let totalTime = 0;
    const pacingIssues: { slideId: string; issue: string }[] = [];
    const recommendedBreakPoints: number[] = [];

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const text = this.extractText(slide.content);
      const wordCount = text.split(/\s+/).filter(Boolean).length;

      // Estimate 150 words per minute speaking rate
      const estimatedSeconds = Math.max(30, Math.ceil((wordCount / 150) * 60) + 10);
      perSlideTime.push({ slideId: slide.id, estimatedSeconds });
      totalTime += estimatedSeconds;

      // Check for pacing issues
      if (estimatedSeconds > 180) {
        pacingIssues.push({
          slideId: slide.id,
          issue: 'Slide may take too long (over 3 minutes)',
        });
      } else if (estimatedSeconds < 15) {
        pacingIssues.push({
          slideId: slide.id,
          issue: 'Slide may be too brief',
        });
      }

      // Recommend breaks every 15 minutes
      if (totalTime > 0 && totalTime % 900 < estimatedSeconds) {
        recommendedBreakPoints.push(i);
      }
    }

    return {
      totalEstimatedTime: totalTime,
      perSlideTime,
      pacingIssues,
      recommendedBreakPoints,
    };
  }

  private async analyzeAudience(slides: any[]): Promise<AudienceAnalysis> {
    const allText = slides.map((s) => this.extractText(s.content)).join(' ');
    const words = allText.toLowerCase().split(/\s+/);

    // Technical word detection
    const technicalTerms = [
      'algorithm', 'api', 'architecture', 'bandwidth', 'blockchain', 'cloud',
      'database', 'encryption', 'framework', 'infrastructure', 'kubernetes',
      'machine learning', 'microservice', 'neural', 'optimization', 'protocol',
    ];

    let technicalCount = 0;
    for (const word of words) {
      if (technicalTerms.some((term) => word.includes(term))) {
        technicalCount++;
      }
    }

    const technicalLevel = Math.min(100, (technicalCount / words.length) * 1000);
    const complexity =
      technicalLevel > 30 ? 'advanced' : technicalLevel > 15 ? 'intermediate' : 'beginner';

    // Accessibility check
    const accessibilityIssues: { slideId: string; issue: string }[] = [];
    let accessibilityScore = 100;

    for (const slide of slides) {
      const content = slide.content;
      
      // Check for images without alt text
      if (content?.images?.some((img: any) => !img.alt)) {
        accessibilityIssues.push({
          slideId: slide.id,
          issue: 'Image missing alt text',
        });
        accessibilityScore -= 5;
      }

      // Check for low contrast (simplified)
      if (content?.style?.backgroundColor && content?.style?.color) {
        accessibilityIssues.push({
          slideId: slide.id,
          issue: 'Check color contrast',
        });
      }
    }

    return {
      complexity,
      technicalLevel: Math.round(technicalLevel),
      assumedKnowledge: [],
      accessibilityScore: Math.max(0, accessibilityScore),
      accessibilityIssues,
    };
  }

  private async getAIInsights(
    title: string,
    content: string,
    slideCount: number
  ): Promise<PresentationInsight[]> {
    const prompt = `Analyze this presentation and provide insights:

Title: ${title}
Slide Count: ${slideCount}
Content Summary: ${content.substring(0, 3000)}

Provide 5-8 specific, actionable insights about:
1. Content quality and clarity
2. Engagement potential
3. Structure and flow
4. Design recommendations
5. Audience considerations

Format as JSON array:
[
  {
    "category": "content|engagement|structure|design|timing|audience",
    "type": "strength|improvement|suggestion|warning",
    "title": "Short title",
    "description": "Detailed explanation",
    "impact": "high|medium|low",
    "actionable": true|false,
    "recommendation": "What to do"
  }
]`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a presentation expert providing actionable feedback.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      });

      return this.parseJsonResponse(response.choices[0].message.content || '[]');
    } catch (error) {
      console.error('AI insights error:', error);
      return [];
    }
  }

  async getQuickTips(slideContent: any): Promise<string[]> {
    const text = this.extractText(slideContent);
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    const tips: string[] = [];

    if (wordCount > 100) {
      tips.push('Consider reducing text - aim for under 50 words per slide');
    }
    if (wordCount < 10) {
      tips.push('Add more context to help your audience understand the point');
    }
    if (!text.includes('?')) {
      tips.push('Consider adding a question to engage your audience');
    }

    return tips;
  }

  private calculateOverallScore(analyses: {
    content: ContentAnalysis;
    structure: StructureAnalysis;
    timing: TimingAnalysis;
    audience: AudienceAnalysis;
  }): number {
    const { content, structure, timing, audience } = analyses;

    // Weighted scoring
    let score = 0;
    
    // Content (30%)
    score += (content.readabilityScore / 100) * 30;
    
    // Structure (25%)
    score += (structure.flowScore / 100) * 25;
    
    // Timing (20%)
    const pacingScore = Math.max(0, 100 - timing.pacingIssues.length * 10);
    score += (pacingScore / 100) * 20;
    
    // Audience (25%)
    score += (audience.accessibilityScore / 100) * 25;

    return Math.round(score);
  }

  private getReadingLevel(score: number): string {
    if (score >= 80) return 'Easy to understand';
    if (score >= 60) return 'Moderately easy';
    if (score >= 40) return 'Standard';
    if (score >= 20) return 'Fairly difficult';
    return 'Very complex';
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

  private parseJsonResponse(text: string): any {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(text);
    } catch {
      return [];
    }
  }
}
