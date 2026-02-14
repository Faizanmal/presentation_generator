import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';

export interface ExtractedColor {
  hex: string;
  rgb: { r: number; g: number; b: number };
  name: string;
  percentage: number;
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  colors: ExtractedColor[];
}

@Injectable()
export class ColorPaletteService {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Extract color palette from an image using AI vision
   */
  async extractFromImage(imageUrl: string): Promise<ColorPalette> {
    const response = await this.aiService.chatCompletion({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a color extraction expert. Analyze the image and extract the dominant colors.
Return a JSON object with:
- colors: array of {hex, name, percentage} for top 5-7 dominant colors
- suggested theme colors: primary, secondary, background, surface, text, textMuted, accent

Choose complementary colors that work well together for a presentation theme.
Ensure good contrast between text and background colors.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl },
            },
            {
              type: 'text',
              text: 'Extract the color palette from this image and suggest a presentation theme based on these colors.',
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const result = JSON.parse(content);

    // Parse colors and create RGB values
    const colors: ExtractedColor[] = (result.colors || []).map(
      (c: { hex: string; name: string; percentage: number }) => ({
        hex: c.hex,
        rgb: this.hexToRgb(c.hex),
        name: c.name,
        percentage: c.percentage || 0,
      }),
    );

    return {
      primary: result.primary || colors[0]?.hex || '#3B82F6',
      secondary: result.secondary || colors[1]?.hex || '#8B5CF6',
      background: result.background || '#FFFFFF',
      surface: result.surface || '#F8FAFC',
      text: result.text || '#1E293B',
      textMuted: result.textMuted || '#64748B',
      accent: result.accent || colors[2]?.hex || '#10B981',
      colors,
    };
  }

  /**
   * Generate a theme from a color palette
   */
  async createThemeFromPalette(
    userId: string,
    palette: ColorPalette,
    themeName: string,
  ) {
    const theme = await this.prisma.theme.create({
      data: {
        name: themeName,
        description: `Custom theme extracted from image`,
        isDefault: false,
        isPremium: false,
        colors: {
          primary: palette.primary,
          secondary: palette.secondary,
          background: palette.background,
          surface: palette.surface,
          text: palette.text,
          textMuted: palette.textMuted,
          accent: palette.accent,
        },
        fonts: {
          heading: 'Inter, sans-serif',
          body: 'Inter, sans-serif',
        },
        spacing: {
          base: 16,
          scale: 1.5,
        },
      },
    });

    return theme;
  }

  /**
   * Generate color harmonies from a base color
   */
  generateHarmonies(baseHex: string): {
    complementary: string;
    analogous: string[];
    triadic: string[];
    splitComplementary: string[];
  } {
    const rgb = this.hexToRgb(baseHex);
    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

    return {
      complementary: this.hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l),
      analogous: [
        this.hslToHex((hsl.h + 30) % 360, hsl.s, hsl.l),
        this.hslToHex((hsl.h - 30 + 360) % 360, hsl.s, hsl.l),
      ],
      triadic: [
        this.hslToHex((hsl.h + 120) % 360, hsl.s, hsl.l),
        this.hslToHex((hsl.h + 240) % 360, hsl.s, hsl.l),
      ],
      splitComplementary: [
        this.hslToHex((hsl.h + 150) % 360, hsl.s, hsl.l),
        this.hslToHex((hsl.h + 210) % 360, hsl.s, hsl.l),
      ],
    };
  }

  /**
   * Suggest accessible text color for a background
   */
  getAccessibleTextColor(backgroundHex: string): {
    text: string;
    textMuted: string;
  } {
    const rgb = this.hexToRgb(backgroundHex);
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;

    if (luminance > 0.5) {
      return { text: '#1E293B', textMuted: '#64748B' };
    } else {
      return { text: '#F1F5F9', textMuted: '#94A3B8' };
    }
  }

  /**
   * Get predefined color palettes
   */
  getPredefinedPalettes(): {
    name: string;
    colors: string[];
    category: string;
  }[] {
    return [
      {
        name: 'Ocean Blue',
        colors: ['#0EA5E9', '#0284C7', '#0369A1', '#BAE6FD', '#F0F9FF'],
        category: 'professional',
      },
      {
        name: 'Forest Green',
        colors: ['#10B981', '#059669', '#047857', '#D1FAE5', '#ECFDF5'],
        category: 'nature',
      },
      {
        name: 'Sunset Orange',
        colors: ['#F97316', '#EA580C', '#C2410C', '#FED7AA', '#FFF7ED'],
        category: 'warm',
      },
      {
        name: 'Royal Purple',
        colors: ['#8B5CF6', '#7C3AED', '#6D28D9', '#DDD6FE', '#F5F3FF'],
        category: 'creative',
      },
      {
        name: 'Rose Pink',
        colors: ['#EC4899', '#DB2777', '#BE185D', '#FBCFE8', '#FDF2F8'],
        category: 'creative',
      },
      {
        name: 'Slate Gray',
        colors: ['#64748B', '#475569', '#334155', '#CBD5E1', '#F1F5F9'],
        category: 'professional',
      },
      {
        name: 'Amber Gold',
        colors: ['#F59E0B', '#D97706', '#B45309', '#FDE68A', '#FFFBEB'],
        category: 'warm',
      },
      {
        name: 'Teal',
        colors: ['#14B8A6', '#0D9488', '#0F766E', '#99F6E4', '#F0FDFA'],
        category: 'nature',
      },
    ];
  }

  // Helper functions
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  private rgbToHsl(
    r: number,
    g: number,
    b: number,
  ): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0,
      s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  private hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;

    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color)
        .toString(16)
        .padStart(2, '0');
    };

    return `#${f(0)}${f(8)}${f(4)}`;
  }
}
