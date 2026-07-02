/**
 * NarrativeAgent — Generates rich, storytelling-driven content for each slide.
 *
 * Responsibilities:
 * - Write compelling slide copy with strong storytelling
 * - Generate speaker notes with delivery cues
 * - Create emotional pacing through the deck
 * - Generate callouts, statistics, and quotes
 */
import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base-agent';
import { AIService } from '../ai.service';
import type {
  OutlineOutput,
  NarrativeOutput,
  NarrativeSection,
  NarrativeSlide,
  GenerationRequest,
  ResearchOutput,
  StoryBeat,
} from '@shared/presentation-dsl';

export interface NarrativeAgentInput {
  request: GenerationRequest;
  outline: OutlineOutput;
  research?: ResearchOutput;
}

@Injectable()
export class NarrativeAgentService extends BaseAgent<
  NarrativeAgentInput,
  NarrativeOutput
> {
  protected readonly agentName = 'NarrativeAgent';

  protected readonly systemPrompt = `You are a world-class presentation copywriter and storytelling expert.

Your job is to write PREMIUM content for each slide in a presentation. You must:
1. Write in the specified tone — make it feel natural and compelling
2. Use storytelling techniques: hooks, tension, payoff, emotional beats
3. Each slide should have a single clear message
4. Write concise headings (max 8 words) that create curiosity
5. Body content should be scannable — use short paragraphs, not walls of text
6. Generate bullet points that are action-oriented and specific
7. Write speaker notes that include delivery cues and talking points
8. Create a coherent emotional journey across slides
9. Include concrete data points and examples where appropriate
10. Add callout text for key insights or statistics

QUALITY RULES:
- NO generic filler content ("In today's world...", "It's important to note...")
- NO bullet points that just restate the heading
- Every slide must ADD something new to the narrative
- Statistics should be specific, not vague
- Speaker notes should sound like a real person talking

ALWAYS respond with valid JSON.`;

  constructor(aiService: AIService) {
    super(aiService);
  }

  protected buildPrompt(input: NarrativeAgentInput): string {
    const { request, outline, research } = input;

    const researchBlock = research
      ? `\nAVAILABLE RESEARCH DATA:\n${research.summary}\nFacts: ${research.keyFacts.join('; ')}\nStats: ${research.statistics.map((s) => `${s.label}: ${s.value}`).join('; ')}`
      : '';

    const sectionsDetail = outline.sections
      .map(
        (s, i) =>
          `Section ${i + 1}: "${s.title}" (role: ${s.narrativeRole}, ${s.suggestedSlideCount} slides)\n  Key points: ${s.keyPoints.join(', ')}\n  Visualization: ${s.dataVisualization || 'none'}`,
      )
      .join('\n');

    return `Write the full narrative content for this presentation:

TITLE: "${outline.title}"
NARRATIVE ARC: ${outline.narrativeArc}
AUDIENCE: ${request.audience || 'general'}
TONE: ${request.tone || 'professional'}
STYLE: ${request.style || 'professional'}
${researchBlock}

OUTLINE:
${sectionsDetail}

${
  request.editMemory?.length
    ? `\nPINNED CONTENT (DO NOT CHANGE):\n${request.editMemory
        .filter((e) => e.pinned)
        .map((e) => `- ${e.field}: "${e.newValue}"`)
        .join('\n')}`
    : ''
}

For EACH section, generate slides with:
{
  "sections": [
    {
      "sectionId": "section-{index}",
      "title": "Section Title",
      "slides": [
        {
          "heading": "Concise, compelling heading (max 8 words)",
          "bodyContent": "1-3 sentences of supporting copy",
          "bulletPoints": ["Action-oriented point 1", "..."] or null,
          "speakerNotes": "Natural delivery notes with [pause] and [emphasis] cues",
          "suggestedVisual": "Description of ideal image/graphic" or null,
          "calloutText": "Key insight or stat to highlight" or null,
          "statisticHighlight": { "label": "Revenue Growth", "value": "340%" } or null
        }
      ],
      "storybeat": {
        "emotionalTone": "curiosity|tension|revelation|inspiration|urgency|confidence",
        "energyLevel": 1-10,
        "keyMessage": "The one takeaway from this section",
        "transitionHint": "How to bridge to next section"
      }
    }
  ],
  "overallStoryArc": "Brief description of the story structure",
  "emotionalJourney": "How emotions flow through the presentation"
}`;
  }

  protected parseOutput(
    raw: string,
    _input: NarrativeAgentInput,
  ): NarrativeOutput {
    const parsed = this.safeJsonParse<{
      sections: Array<{
        sectionId: string;
        title: string;
        slides: Array<{
          heading: string;
          bodyContent: string;
          bulletPoints?: string[];
          speakerNotes: string;
          suggestedVisual?: string;
          calloutText?: string;
          statisticHighlight?: { label: string; value: string };
        }>;
        storybeat: {
          emotionalTone: string;
          energyLevel: number;
          keyMessage: string;
          transitionHint?: string;
        };
      }>;
      overallStoryArc: string;
      emotionalJourney: string;
    }>(raw);

    const validTones = [
      'curiosity',
      'tension',
      'revelation',
      'inspiration',
      'urgency',
      'confidence',
    ] as const;

    const sections: NarrativeSection[] = parsed.sections.map((s, idx) => ({
      sectionId: s.sectionId || `section-${idx}`,
      title: s.title,
      slides: (s.slides || []).map(
        (slide): NarrativeSlide => ({
          heading: slide.heading,
          bodyContent: slide.bodyContent,
          bulletPoints: slide.bulletPoints || undefined,
          speakerNotes: slide.speakerNotes || '',
          suggestedVisual: slide.suggestedVisual || undefined,
          calloutText: slide.calloutText || undefined,
          statisticHighlight: slide.statisticHighlight || undefined,
        }),
      ),
      storybeat: {
        emotionalTone: validTones.includes(
          s.storybeat?.emotionalTone as (typeof validTones)[number],
        )
          ? (s.storybeat.emotionalTone as StoryBeat['emotionalTone'])
          : 'confidence',
        energyLevel: Math.min(10, Math.max(1, s.storybeat?.energyLevel || 5)),
        keyMessage: s.storybeat?.keyMessage || s.title,
        transitionHint: s.storybeat?.transitionHint,
      },
    }));

    return {
      sections,
      overallStoryArc: parsed.overallStoryArc || '',
      emotionalJourney: parsed.emotionalJourney || '',
    };
  }
}
