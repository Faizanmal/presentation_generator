/**
 * DesignAgent — Generates visual design decisions and theme styling.
 *
 * Responsibilities:
 * - Generate or refine color palettes
 * - Select typography that matches tone
 * - Create slide-level design overrides
 * - Ensure visual consistency across the deck
 */
import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base-agent';
import { AIService } from '../ai.service';
import type {
  GenerationRequest,
  OutlineOutput,
  DesignOutput,
  PresentationTheme,
  SlideDesign,
} from '@shared/presentation-dsl';

export interface DesignAgentInput {
  request: GenerationRequest;
  outline: OutlineOutput;
  slideCount: number;
}

@Injectable()
export class DesignAgentService extends BaseAgent<
  DesignAgentInput,
  DesignOutput
> {
  protected readonly agentName = 'DesignAgent';

  protected readonly systemPrompt = `You are an expert presentation designer specializing in color theory, typography, and visual hierarchy.

Your job is to create a cohesive visual design system for presentations.

DESIGN PRINCIPLES:
1. Colors must have sufficient contrast (WCAG AA minimum)
2. Use a harmonious palette: primary + secondary + accent + neutrals
3. Chart colors should be distinct and accessible
4. Typography should match the tone (serif for formal, sans-serif for modern)
5. Use a typographic scale for consistent sizing (1.25 or 1.333 ratio)
6. Slide-level overrides should be subtle — don't break visual consistency

FONT PAIRING RULES:
- Professional: Inter + Source Serif Pro
- Creative: Outfit + DM Sans
- Academic: Merriweather + Source Sans Pro
- Bold/Startup: Space Grotesk + Inter
- Elegant: Playfair Display + Lato

Always respond with valid JSON.`;

  constructor(aiService: AIService) {
    super(aiService);
  }

  protected buildPrompt(input: DesignAgentInput): string {
    const { request, outline, slideCount } = input;

    const brandBlock = request.brandGuidelines
      ? `\nBRAND GUIDELINES:\nColors: ${request.brandGuidelines.colors?.join(', ') || 'none'}\nFonts: ${request.brandGuidelines.fonts?.join(', ') || 'none'}\nTone: ${request.brandGuidelines.tone || 'none'}`
      : '';

    return `Design a visual system for this presentation:

TITLE: "${outline.title}"
TOPIC: "${request.topic}"
TONE: ${request.tone || 'professional'}
STYLE: ${request.style || 'professional'}
SLIDE COUNT: ${slideCount}
${brandBlock}

SECTION ROLES:
${outline.sections.map((s, i) => `${i + 1}. "${s.title}" — ${s.narrativeRole}`).join('\n')}

Respond with:
{
  "theme": {
    "id": "generated-theme",
    "name": "Theme Name",
    "colors": {
      "primary": "#hex",
      "secondary": "#hex",
      "accent": "#hex",
      "background": "#hex",
      "surface": "#hex",
      "text": "#hex",
      "textMuted": "#hex",
      "chart": ["#hex", "#hex", "#hex", "#hex", "#hex"]
    },
    "typography": {
      "headingFont": "Font Name",
      "bodyFont": "Font Name",
      "monoFont": "JetBrains Mono",
      "baseSize": 16,
      "scale": 1.25
    },
    "spacing": { "base": 8, "scale": 1.5 },
    "effects": {
      "borderRadius": "12px",
      "shadow": "0 4px 24px rgba(0,0,0,0.08)",
      "glassmorphism": false,
      "gradientOverlay": "optional gradient"
    }
  },
  "slideStyles": [
    {
      "slideIndex": 0,
      "backgroundStyle": "optional CSS background",
      "emphasisBlocks": [0]
    }
  ]
}`;
  }

  protected parseOutput(raw: string, _input: DesignAgentInput): DesignOutput {
    const parsed = this.safeJsonParse<{
      theme: PresentationTheme;
      slideStyles: SlideDesign[];
    }>(raw);

    // Validate and provide defaults
    const theme: PresentationTheme = {
      id: parsed.theme?.id || 'generated-theme',
      name: parsed.theme?.name || 'Generated Theme',
      colors: {
        primary: parsed.theme?.colors?.primary || '#3B82F6',
        secondary: parsed.theme?.colors?.secondary || '#8B5CF6',
        accent: parsed.theme?.colors?.accent || '#F59E0B',
        background: parsed.theme?.colors?.background || '#FFFFFF',
        surface: parsed.theme?.colors?.surface || '#F8FAFC',
        text: parsed.theme?.colors?.text || '#1E293B',
        textMuted: parsed.theme?.colors?.textMuted || '#64748B',
        chart: parsed.theme?.colors?.chart || [
          '#3B82F6',
          '#8B5CF6',
          '#F59E0B',
          '#10B981',
          '#EF4444',
        ],
      },
      typography: {
        headingFont: parsed.theme?.typography?.headingFont || 'Inter',
        bodyFont: parsed.theme?.typography?.bodyFont || 'Inter',
        monoFont: parsed.theme?.typography?.monoFont || 'JetBrains Mono',
        baseSize: parsed.theme?.typography?.baseSize || 16,
        scale: parsed.theme?.typography?.scale || 1.25,
      },
      spacing: {
        base: parsed.theme?.spacing?.base || 8,
        scale: parsed.theme?.spacing?.scale || 1.5,
      },
      effects: {
        borderRadius: parsed.theme?.effects?.borderRadius || '12px',
        shadow: parsed.theme?.effects?.shadow || '0 4px 24px rgba(0,0,0,0.08)',
        glassmorphism: parsed.theme?.effects?.glassmorphism || false,
        gradientOverlay: parsed.theme?.effects?.gradientOverlay,
      },
    };

    return {
      theme,
      slideStyles: parsed.slideStyles || [],
    };
  }
}
