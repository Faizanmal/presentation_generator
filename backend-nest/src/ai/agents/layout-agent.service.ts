/**
 * LayoutAgent — Determines optimal layout for each slide based on content analysis.
 *
 * Responsibilities:
 * - Analyze content density per slide
 * - Select best layout preset
 * - Determine block placements within layout zones
 * - Score layout fitness
 * - Handle content balancing across slides
 */
import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base-agent';
import { AIService } from '../ai.service';
import type {
  NarrativeOutput,
  OutlineOutput,
  LayoutOutput,
  LayoutDecision,
  SlideLayout,
  BlockPlacement,
  BlockKind,
  LayoutPreset,
} from '@shared/presentation-dsl';

export interface LayoutAgentInput {
  outline: OutlineOutput;
  narrative: NarrativeOutput;
}

@Injectable()
export class LayoutAgentService extends BaseAgent<
  LayoutAgentInput,
  LayoutOutput
> {
  protected readonly agentName = 'LayoutAgent';

  protected readonly systemPrompt = `You are an expert presentation layout designer.

Your job is to select the BEST visual layout for each slide based on its content.

LAYOUT SELECTION RULES:
1. Title slides → "title-hero" or "title-subtitle"
2. Statistics/numbers → "stats-grid" (3-4 stats)
3. Comparisons → "comparison"
4. Step-by-step → "timeline"
5. Text + image → "image-left" or "image-right" (alternate for visual rhythm)
6. Heavy text → "two-column" to break it up
7. Key quotes → "quote-centered"
8. Data/charts → "chart-focus"
9. Multiple related items → "bento-grid"
10. Full-impact images → "image-full"

CONTENT DENSITY RULES:
- "sparse": 1-2 content blocks (quotes, big statements)
- "balanced": 3-5 content blocks (standard slides)
- "dense": 6+ content blocks (data-heavy slides)

PACING RULES:
- Never use the same layout 3 times in a row
- Alternate between sparse and dense for visual rhythm
- Place image-heavy layouts after text-heavy ones
- Opening and closing should be "sparse" density

Respond with JSON matching the LayoutOutput schema.`;

  constructor(aiService: AIService) {
    super(aiService);
  }

  protected buildPrompt(input: LayoutAgentInput): string {
    const { outline, narrative } = input;

    const slideSummaries = narrative.sections.flatMap((section, sIdx) =>
      section.slides.map((slide, slideIdx) => {
        const hasStats = !!slide.statisticHighlight;
        const hasBullets = (slide.bulletPoints?.length || 0) > 0;
        const hasVisual = !!slide.suggestedVisual;
        const hasCallout = !!slide.calloutText;
        const bodyLength = slide.bodyContent.length;
        const suggestedLayout =
          outline.sections[sIdx]?.suggestedLayouts?.[slideIdx] || 'auto';

        return `Slide ${sIdx}-${slideIdx}: "${slide.heading}"
  Body length: ${bodyLength} chars
  Has bullets: ${hasBullets} (${slide.bulletPoints?.length || 0} items)
  Has statistic: ${hasStats}
  Has visual suggestion: ${hasVisual}
  Has callout: ${hasCallout}
  Narrative role: ${outline.sections[sIdx]?.narrativeRole || 'content'}
  Suggested layout: ${suggestedLayout}`;
      }),
    );

    return `Assign the optimal layout to each slide:

PRESENTATION: "${outline.title}"
TOTAL SLIDES: ${slideSummaries.length}

SLIDE CONTENT ANALYSIS:
${slideSummaries.join('\n\n')}

For each slide, respond with:
{
  "slides": [
    {
      "slideIndex": 0,
      "layout": {
        "preset": "layout-preset-name",
        "zones": number (1-4),
        "density": "sparse|balanced|dense"
      },
      "blockPlacements": [
        {
          "blockKind": "heading|paragraph|bullet-list|image|chart|statistic|quote|callout",
          "zone": number,
          "suggestedSize": "small|medium|large|full"
        }
      ],
      "fitScore": 0.0-1.0
    }
  ]
}`;
  }

  protected parseOutput(raw: string, _input: LayoutAgentInput): LayoutOutput {
    const parsed = this.safeJsonParse<{
      slides: Array<{
        slideIndex: number;
        layout: {
          preset: string;
          zones: number;
          density: string;
          gridTemplate?: string;
        };
        blockPlacements: Array<{
          blockKind: string;
          zone: number;
          suggestedSize: string;
        }>;
        fitScore: number;
      }>;
    }>(raw);

    const validPresets: LayoutPreset[] = [
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

    const validBlockKinds: BlockKind[] = [
      'heading',
      'subheading',
      'paragraph',
      'bullet-list',
      'numbered-list',
      'quote',
      'statistic',
      'image',
      'chart',
      'table',
      'code',
      'embed',
      'callout',
      'divider',
      'spacer',
      'icon-row',
      'timeline-item',
      'comparison-row',
    ];

    const slides: LayoutDecision[] = (parsed.slides || []).map((s) => {
      const preset = validPresets.includes(s.layout.preset as LayoutPreset)
        ? (s.layout.preset as LayoutPreset)
        : 'single-column';

      const density = ['sparse', 'balanced', 'dense'].includes(s.layout.density)
        ? (s.layout.density as SlideLayout['density'])
        : 'balanced';

      const blockPlacements: BlockPlacement[] = (s.blockPlacements || []).map(
        (bp) => ({
          blockKind: validBlockKinds.includes(bp.blockKind as BlockKind)
            ? (bp.blockKind as BlockKind)
            : 'paragraph',
          zone: bp.zone || 0,
          suggestedSize: (['small', 'medium', 'large', 'full'].includes(
            bp.suggestedSize,
          )
            ? bp.suggestedSize
            : 'medium') as BlockPlacement['suggestedSize'],
        }),
      );

      return {
        slideIndex: s.slideIndex,
        layout: {
          preset,
          zones: Math.min(4, Math.max(1, s.layout.zones || 1)),
          density,
          gridTemplate: s.layout.gridTemplate,
        },
        blockPlacements,
        fitScore: Math.min(1, Math.max(0, s.fitScore || 0.7)),
      };
    });

    return { slides };
  }
}
