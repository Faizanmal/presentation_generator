/**
 * QAAgent — Quality assurance and validation for generated presentations.
 *
 * Responsibilities:
 * - Score overall presentation quality
 * - Check content, structure, design, accessibility
 * - Identify issues with severity levels
 * - Suggest auto-fixable improvements
 * - Gate presentations before delivery
 */
import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base-agent';
import { AIService } from '../ai.service';
import type {
  PresentationDocument,
  QAOutput,
  QAIssue,
  QABreakdown,
  GenerationRequest,
} from '@shared/presentation-dsl';

export interface QAAgentInput {
  request: GenerationRequest;
  presentation: PresentationDocument;
}

@Injectable()
export class QAAgentService extends BaseAgent<QAAgentInput, QAOutput> {
  protected readonly agentName = 'QAAgent';

  protected readonly systemPrompt = `You are a rigorous presentation quality analyst.

Your job is to evaluate a generated presentation across 6 dimensions and identify specific issues.

SCORING CRITERIA (each 0-100):
1. Content Quality: Accuracy, depth, specificity. Penalize vague/generic content.
2. Structure Flow: Logical progression, narrative coherence, pacing.
3. Visual Consistency: Theme adherence, layout variety, visual rhythm.
4. Audience Alignment: Tone match, complexity match, relevance.
5. Grammar & Spelling: Errors, awkward phrasing, consistency.
6. Accessibility: Contrast, text size, alt text, readability.

ISSUE SEVERITY:
- "critical": Must fix before delivery (broken content, wrong audience, major errors)
- "warning": Should fix for quality (weak sections, poor pacing, minor errors)
- "info": Nice to have improvements (polish, optimization)

Mark issues as autoFixable if they can be corrected programmatically.

Be HONEST and SPECIFIC. Score fairly — most AI-generated presentations are 60-80.
A score of 90+ should be rare and genuinely earned.

Respond with valid JSON.`;

  constructor(aiService: AIService) {
    super(aiService);
  }

  protected buildPrompt(input: QAAgentInput): string {
    const { request, presentation } = input;

    const slidesSummary = presentation.sections
      .flatMap((section) =>
        section.slides.map((slide, idx) => {
          const blockTypes = slide.blocks.map((b) => b.kind).join(', ');
          const textBlocks = slide.blocks
            .filter((b) => b.content.text)
            .map((b) => b.content.text!.substring(0, 100))
            .join(' | ');

          return `Slide ${idx + 1} [${slide.layout.preset}]: "${textBlocks}" (blocks: ${blockTypes})`;
        }),
      )
      .join('\n');

    return `Evaluate this presentation:

TITLE: "${presentation.title}"
TOPIC: "${request.topic}"
TARGET AUDIENCE: ${request.audience || 'general'}
EXPECTED TONE: ${request.tone || 'professional'}
TOTAL SLIDES: ${presentation.metadata.totalSlides}

SLIDES:
${slidesSummary}

THEME: ${presentation.theme.name}
Colors: ${presentation.theme.colors.primary}, ${presentation.theme.colors.secondary}
Fonts: ${presentation.theme.typography.headingFont} / ${presentation.theme.typography.bodyFont}

Respond with:
{
  "overallScore": 0-100,
  "passed": boolean (true if score >= 70),
  "issues": [
    {
      "severity": "critical|warning|info",
      "slideIndex": number or null,
      "blockId": "string or null",
      "category": "content|design|structure|accessibility|grammar",
      "message": "Specific issue description",
      "autoFixable": boolean,
      "suggestedFix": "How to fix" or null
    }
  ],
  "suggestions": ["High-level improvement suggestions"],
  "breakdown": {
    "contentQuality": 0-100,
    "structureFlow": 0-100,
    "visualConsistency": 0-100,
    "audienceAlignment": 0-100,
    "grammarSpelling": 0-100,
    "accessibilityScore": 0-100
  }
}`;
  }

  protected parseOutput(raw: string, _input: QAAgentInput): QAOutput {
    const parsed = this.safeJsonParse<{
      overallScore: number;
      passed: boolean;
      issues: Array<{
        severity: string;
        slideIndex?: number;
        blockId?: string;
        category: string;
        message: string;
        autoFixable: boolean;
        suggestedFix?: string;
      }>;
      suggestions: string[];
      breakdown: QABreakdown;
    }>(raw);

    const validSeverities = ['critical', 'warning', 'info'] as const;
    const validCategories = [
      'content',
      'design',
      'structure',
      'accessibility',
      'grammar',
    ] as const;

    const issues: QAIssue[] = (parsed.issues || []).map((issue) => ({
      severity: validSeverities.includes(
        issue.severity as (typeof validSeverities)[number],
      )
        ? (issue.severity as QAIssue['severity'])
        : 'info',
      slideIndex: issue.slideIndex,
      blockId: issue.blockId,
      category: validCategories.includes(
        issue.category as (typeof validCategories)[number],
      )
        ? (issue.category as QAIssue['category'])
        : 'content',
      message: issue.message,
      autoFixable: issue.autoFixable || false,
      suggestedFix: issue.suggestedFix,
    }));

    const score = Math.min(100, Math.max(0, parsed.overallScore || 50));

    return {
      overallScore: score,
      passed: parsed.passed ?? score >= 70,
      issues,
      suggestions: parsed.suggestions || [],
      breakdown: {
        contentQuality: Math.min(
          100,
          Math.max(0, parsed.breakdown?.contentQuality || 50),
        ),
        structureFlow: Math.min(
          100,
          Math.max(0, parsed.breakdown?.structureFlow || 50),
        ),
        visualConsistency: Math.min(
          100,
          Math.max(0, parsed.breakdown?.visualConsistency || 50),
        ),
        audienceAlignment: Math.min(
          100,
          Math.max(0, parsed.breakdown?.audienceAlignment || 50),
        ),
        grammarSpelling: Math.min(
          100,
          Math.max(0, parsed.breakdown?.grammarSpelling || 50),
        ),
        accessibilityScore: Math.min(
          100,
          Math.max(0, parsed.breakdown?.accessibilityScore || 50),
        ),
      },
    };
  }
}
