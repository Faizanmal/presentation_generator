/**
 * OutlineAgent — Generates the structural skeleton of the presentation.
 *
 * Responsibilities:
 * - Determine optimal slide count
 * - Assign narrative roles to sections
 * - Plan content flow and storytelling arc
 * - Suggest layouts per slide
 */
import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base-agent';
import { AIService } from '../ai.service';
import type {
  GenerationRequest,
  OutlineOutput,
  SectionOutline,
  NarrativeRole,
  LayoutPreset,
  ResearchOutput,
} from '@shared/presentation-dsl';

export interface OutlineAgentInput {
  request: GenerationRequest;
  research?: ResearchOutput;
}

@Injectable()
export class OutlineAgentService extends BaseAgent<
  OutlineAgentInput,
  OutlineOutput
> {
  protected readonly agentName = 'OutlineAgent';

  protected readonly systemPrompt = `You are a world-class presentation architect specializing in storytelling-driven slide structures.

Your job is to create a detailed structural outline for a presentation. You must:
1. Design a compelling narrative arc (hook → context → problem → solution → evidence → CTA)
2. Determine the optimal number of slides for the topic
3. Assign a narrative role to each section
4. Suggest the best layout preset for each slide based on content type
5. Identify key points that need data visualization
6. Plan pacing and energy flow across the deck

Available layout presets:
- title-hero: Opening/closing with large text
- title-subtitle: Section headers
- single-column: Text-heavy content
- two-column: Side-by-side content
- two-column-image: Text + image side by side
- image-left / image-right: Image with supporting text
- image-full: Full-bleed image with overlay text
- stats-grid: 3-4 key statistics
- comparison: Before/after or option comparison
- timeline: Sequential events/steps
- quote-centered: Testimonials or key quotes
- chart-focus: Data visualization centered
- bento-grid: Multi-card layout
- blank: Custom layout

Narrative roles: hook, context, problem, solution, evidence, transformation, call-to-action, recap, transition

ALWAYS respond with valid JSON matching the OutlineOutput schema.`;

  constructor(aiService: AIService) {
    super(aiService);
  }

  protected buildPrompt(input: OutlineAgentInput): string {
    const { request, research } = input;
    const researchContext = research
      ? `\n\nRESEARCH DATA:\n${research.summary}\n\nKey Facts:\n${research.keyFacts.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\nStatistics:\n${research.statistics.map((s) => `- ${s.label}: ${s.value}`).join('\n')}`
      : '';

    return `Create a presentation outline for:

TOPIC: "${request.topic}"
AUDIENCE: ${request.audience || 'general professional audience'}
TONE: ${request.tone || 'professional yet engaging'}
TARGET SLIDES: ${request.length || 10}
STYLE: ${request.style || 'professional'}
TEMPLATE TYPE: ${request.templateType || 'general'}
${request.additionalContext ? `ADDITIONAL CONTEXT: ${request.additionalContext}` : ''}
${researchContext}

${request.editMemory?.length ? `\nUSER EDIT MEMORY (respect these constraints):\n${request.editMemory.map((e) => `- Slide "${e.slideId}": ${e.field} must be "${e.newValue}"`).join('\n')}` : ''}

Respond with JSON:
{
  "title": "string",
  "subtitle": "string (optional)",
  "sections": [
    {
      "title": "string",
      "narrativeRole": "hook|context|problem|solution|evidence|transformation|call-to-action|recap|transition",
      "keyPoints": ["string"],
      "suggestedSlideCount": number,
      "suggestedLayouts": ["layout-preset"],
      "dataVisualization": "string or null"
    }
  ],
  "estimatedSlides": number,
  "narrativeArc": "string describing the storytelling flow"
}`;
  }

  protected parseOutput(raw: string, _input: OutlineAgentInput): OutlineOutput {
    const parsed = this.safeJsonParse<{
      title: string;
      subtitle?: string;
      sections: Array<{
        title: string;
        narrativeRole: string;
        keyPoints: string[];
        suggestedSlideCount: number;
        suggestedLayouts: string[];
        dataVisualization?: string;
      }>;
      estimatedSlides: number;
      narrativeArc: string;
    }>(raw);

    const validRoles: NarrativeRole[] = [
      'hook',
      'context',
      'problem',
      'solution',
      'evidence',
      'transformation',
      'call-to-action',
      'recap',
      'transition',
    ];

    const validLayouts: LayoutPreset[] = [
      'title-hero',
      'title-subtitle',
      'single-column',
      'two-column',
      'two-column-image',
      'three-column',
      'image-left',
      'image-right',
      'image-full',
      'stats-grid',
      'comparison',
      'timeline',
      'quote-centered',
      'chart-focus',
      'bento-grid',
      'blank',
    ];

    const sections: SectionOutline[] = parsed.sections.map((s) => ({
      title: s.title,
      narrativeRole: validRoles.includes(s.narrativeRole as NarrativeRole)
        ? (s.narrativeRole as NarrativeRole)
        : 'context',
      keyPoints: s.keyPoints || [],
      suggestedSlideCount: s.suggestedSlideCount || 1,
      suggestedLayouts: (s.suggestedLayouts || []).filter(
        (l): l is LayoutPreset => validLayouts.includes(l as LayoutPreset),
      ),
      dataVisualization: s.dataVisualization || undefined,
    }));

    return {
      title: parsed.title,
      subtitle: parsed.subtitle,
      sections,
      estimatedSlides:
        parsed.estimatedSlides ||
        sections.reduce((sum, s) => sum + s.suggestedSlideCount, 0),
      narrativeArc: parsed.narrativeArc,
    };
  }
}
