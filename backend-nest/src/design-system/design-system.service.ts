import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, DesignSystem as PrismaDesignSystem } from '@prisma/client';

export interface ColorToken {
  name: string;
  value: string;
  type:
    | 'primary'
    | 'secondary'
    | 'accent'
    | 'background'
    | 'text'
    | 'border'
    | 'custom';
  shade?: number; // 50, 100, 200, ... 900
}

export interface TypographyToken {
  name: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string | number;
  lineHeight: string;
  letterSpacing?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  role: 'heading' | 'subheading' | 'body' | 'caption' | 'label' | 'custom';
}

export interface SpacingToken {
  name: string;
  value: string;
  scale: number; // 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, etc.
}

export interface ShadowToken {
  name: string;
  value: string;
  type: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'inner' | 'none' | 'custom';
}

export interface BorderToken {
  name: string;
  width: string;
  style: string;
  radius: string;
  color?: string;
}

export interface DesignSystem {
  id: string;
  name: string;
  description?: string;
  organizationId?: string;
  userId: string;
  isDefault: boolean;

  colors: ColorToken[];
  typography: TypographyToken[];
  spacing: SpacingToken[];
  shadows: ShadowToken[];
  borders: BorderToken[];

  cssVariables: Record<string, string>;
  tailwindConfig?: Record<string, unknown> | undefined;

  createdAt: Date;
  updatedAt: Date;
}

export interface DesignSystemPreset {
  id: string;
  name: string;
  description: string;
  preview: string;
  system: Partial<DesignSystem>;
}

@Injectable()
export class DesignSystemService {
  private readonly logger = new Logger(DesignSystemService.name);

  // Built-in presets
  private readonly presets: DesignSystemPreset[] = [
    {
      id: 'modern-minimal',
      name: 'Modern Minimal',
      description: 'Clean, minimalist design with generous whitespace',
      preview: '/presets/modern-minimal.png',
      system: {
        colors: [
          { name: 'primary', value: '#18181b', type: 'primary' },
          { name: 'secondary', value: '#71717a', type: 'secondary' },
          { name: 'accent', value: '#3b82f6', type: 'accent' },
          { name: 'background', value: '#ffffff', type: 'background' },
          { name: 'text', value: '#18181b', type: 'text' },
        ],
        typography: [
          {
            name: 'h1',
            fontFamily: 'Inter',
            fontSize: '48px',
            fontWeight: 700,
            lineHeight: '1.1',
            role: 'heading',
          },
          {
            name: 'h2',
            fontFamily: 'Inter',
            fontSize: '36px',
            fontWeight: 600,
            lineHeight: '1.2',
            role: 'subheading',
          },
          {
            name: 'body',
            fontFamily: 'Inter',
            fontSize: '16px',
            fontWeight: 400,
            lineHeight: '1.6',
            role: 'body',
          },
        ],
      },
    },
    {
      id: 'corporate-blue',
      name: 'Corporate Blue',
      description: 'Professional corporate style with blue accents',
      preview: '/presets/corporate-blue.png',
      system: {
        colors: [
          { name: 'primary', value: '#1e40af', type: 'primary' },
          { name: 'secondary', value: '#3b82f6', type: 'secondary' },
          { name: 'accent', value: '#fbbf24', type: 'accent' },
          { name: 'background', value: '#f8fafc', type: 'background' },
          { name: 'text', value: '#1e293b', type: 'text' },
        ],
        typography: [
          {
            name: 'h1',
            fontFamily: 'Roboto',
            fontSize: '44px',
            fontWeight: 700,
            lineHeight: '1.2',
            role: 'heading',
          },
          {
            name: 'h2',
            fontFamily: 'Roboto',
            fontSize: '32px',
            fontWeight: 600,
            lineHeight: '1.3',
            role: 'subheading',
          },
          {
            name: 'body',
            fontFamily: 'Roboto',
            fontSize: '16px',
            fontWeight: 400,
            lineHeight: '1.6',
            role: 'body',
          },
        ],
      },
    },
    {
      id: 'creative-bold',
      name: 'Creative Bold',
      description:
        'Vibrant colors and bold typography for creative presentations',
      preview: '/presets/creative-bold.png',
      system: {
        colors: [
          { name: 'primary', value: '#7c3aed', type: 'primary' },
          { name: 'secondary', value: '#ec4899', type: 'secondary' },
          { name: 'accent', value: '#06b6d4', type: 'accent' },
          { name: 'background', value: '#0f172a', type: 'background' },
          { name: 'text', value: '#f8fafc', type: 'text' },
        ],
        typography: [
          {
            name: 'h1',
            fontFamily: 'Poppins',
            fontSize: '56px',
            fontWeight: 800,
            lineHeight: '1.1',
            textTransform: 'uppercase',
            role: 'heading',
          },
          {
            name: 'h2',
            fontFamily: 'Poppins',
            fontSize: '40px',
            fontWeight: 700,
            lineHeight: '1.2',
            role: 'subheading',
          },
          {
            name: 'body',
            fontFamily: 'Open Sans',
            fontSize: '18px',
            fontWeight: 400,
            lineHeight: '1.7',
            role: 'body',
          },
        ],
      },
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new design system
   */
  async createDesignSystem(
    userId: string,
    data: {
      name: string;
      description?: string;
      organizationId?: string;
      presetId?: string;
    },
  ): Promise<DesignSystem> {
    let baseSystem: Partial<DesignSystem> = {};

    if (data.presetId) {
      const preset = this.presets.find((p) => p.id === data.presetId);
      if (preset) {
        baseSystem = { ...preset.system };
      }
    }

    const defaultColors = baseSystem.colors || this.getDefaultColors();
    const defaultTypography =
      baseSystem.typography || this.getDefaultTypography();
    const defaultSpacing = this.getDefaultSpacing();
    const defaultShadows = this.getDefaultShadows();
    const defaultBorders = this.getDefaultBorders();

    const cssVariables = this.generateCSSVariables({
      colors: defaultColors,
      typography: defaultTypography,
      spacing: defaultSpacing,
      shadows: defaultShadows,
      borders: defaultBorders,
    });

    const system = await this.prisma.designSystem.create({
      data: {
        name: data.name,
        organizationId: data.organizationId,
        userId,
        isDefault: false,
        colors: defaultColors as unknown as Prisma.InputJsonValue,
        typography: defaultTypography as unknown as Prisma.InputJsonValue,
        spacing: defaultSpacing as unknown as Prisma.InputJsonValue,
        shadows: defaultShadows as unknown as Prisma.InputJsonValue,
        borders: defaultBorders as unknown as Prisma.InputJsonValue,
        cssVariables,
      },
    });

    return this.mapDesignSystem(system);
  }

  /**
   * Get a design system
   */
  async getDesignSystem(systemId: string): Promise<DesignSystem> {
    const system = await this.prisma.designSystem.findUnique({
      where: { id: systemId },
    });

    if (!system) {
      throw new NotFoundException('Design system not found');
    }

    return this.mapDesignSystem(system);
  }

  /**
   * Update design system tokens
   */
  async updateTokens(
    systemId: string,
    userId: string,
    updates: {
      colors?: ColorToken[];
      typography?: TypographyToken[];
      spacing?: SpacingToken[];
      shadows?: ShadowToken[];
      borders?: BorderToken[];
    },
  ): Promise<DesignSystem> {
    const existing = await this.prisma.designSystem.findFirst({
      where: { id: systemId, userId },
    });

    if (!existing) {
      throw new NotFoundException('Design system not found');
    }

    const merged = {
      colors: updates.colors || (existing.colors as unknown as ColorToken[]),
      typography:
        updates.typography ||
        (existing.typography as unknown as TypographyToken[]),
      spacing:
        updates.spacing || (existing.spacing as unknown as SpacingToken[]),
      shadows:
        updates.shadows || (existing.shadows as unknown as ShadowToken[]),
      borders:
        updates.borders || (existing.borders as unknown as BorderToken[]),
    };

    const cssVariables = this.generateCSSVariables(merged);

    const updated = await this.prisma.designSystem.update({
      where: { id: systemId },
      data: {
        ...(updates as unknown as Prisma.DesignSystemUpdateInput),
        cssVariables,
      },
    });

    return this.mapDesignSystem(updated);
  }

  /**
   * Update a single color token
   */
  async updateColor(
    systemId: string,
    userId: string,
    colorName: string,
    newValue: string,
  ): Promise<DesignSystem> {
    const system = await this.prisma.designSystem.findFirst({
      where: { id: systemId, userId },
    });

    if (!system) {
      throw new NotFoundException('Design system not found');
    }

    const colors = system.colors as unknown as ColorToken[];
    const colorIndex = colors.findIndex((c) => c.name === colorName);

    if (colorIndex === -1) {
      throw new BadRequestException(`Color "${colorName}" not found`);
    }

    colors[colorIndex].value = newValue;

    return this.updateTokens(systemId, userId, { colors });
  }

  /**
   * Apply design system to a project
   */
  /**
   * Apply design system to a project
   */
  async applyToProject(
    systemId: string,
    projectId: string,
  ): Promise<{ success: boolean; appliedStyles: Record<string, string> }> {
    const system = await this.getDesignSystem(systemId);

    // Update project with design system reference
    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        designSystemId: systemId,
      },
    });

    return {
      success: true,
      appliedStyles: system.cssVariables,
    };
  }

  /**
   * Generate a color palette from a base color
   */
  generateColorPalette(baseColor: string, name: string): ColorToken[] {
    const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    const colors: ColorToken[] = [];

    for (const shade of shades) {
      const adjustedColor = this.adjustColorShade(baseColor, shade);
      colors.push({
        name: `${name}-${shade}`,
        value: adjustedColor,
        type: 'custom',
        shade,
      });
    }

    return colors;
  }

  /**
   * Get available presets
   */
  getPresets(): DesignSystemPreset[] {
    return this.presets;
  }

  /**
   * Export design system as CSS
   */
  exportAsCSS(system: DesignSystem): string {
    let css = ':root {\n';

    for (const [key, value] of Object.entries(system.cssVariables)) {
      css += `  ${key}: ${value};\n`;
    }

    css += '}\n\n';

    // Generate typography classes
    for (const typo of system.typography) {
      css += `.${typo.name} {\n`;
      css += `  font-family: ${typo.fontFamily};\n`;
      css += `  font-size: ${typo.fontSize};\n`;
      css += `  font-weight: ${typo.fontWeight};\n`;
      css += `  line-height: ${typo.lineHeight};\n`;
      if (typo.letterSpacing)
        css += `  letter-spacing: ${typo.letterSpacing};\n`;
      if (typo.textTransform)
        css += `  text-transform: ${typo.textTransform};\n`;
      css += '}\n\n';
    }

    return css;
  }

  /**
   * Export design system as Tailwind config
   */
  exportAsTailwindConfig(system: DesignSystem): {
    theme: {
      extend: {
        colors: Record<string, string>;
        fontFamily: Record<string, string[]>;
        fontSize: Record<string, string>;
        spacing: Record<string, string>;
        boxShadow: Record<string, string>;
        borderRadius: Record<string, string>;
      };
    };
  } {
    const colors: Record<string, string> = {};
    const fontFamily: Record<string, string[]> = {};
    const fontSize: Record<string, string> = {};

    for (const color of system.colors) {
      colors[color.name] = color.value;
    }

    for (const typo of system.typography) {
      if (!fontFamily[typo.role]) {
        fontFamily[typo.role] = [typo.fontFamily, 'sans-serif'];
      }
      fontSize[typo.name] = typo.fontSize;
    }

    return {
      theme: {
        extend: {
          colors,
          fontFamily,
          fontSize,
          spacing: Object.fromEntries(
            system.spacing.map((s) => [s.name, s.value]),
          ),
          boxShadow: Object.fromEntries(
            system.shadows.map((s) => [s.name, s.value]),
          ),
          borderRadius: Object.fromEntries(
            system.borders.map((b) => [b.name, b.radius]),
          ),
        },
      },
    };
  }

  /**
   * Get user's design systems
   */
  async getUserDesignSystems(userId: string): Promise<DesignSystem[]> {
    const systems = await this.prisma.designSystem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return systems.map((s) => this.mapDesignSystem(s));
  }

  // Helper methods
  private generateCSSVariables(tokens: {
    colors: ColorToken[];
    typography: TypographyToken[];
    spacing: SpacingToken[];
    shadows: ShadowToken[];
    borders: BorderToken[];
  }): Record<string, string> {
    const vars: Record<string, string> = {};

    for (const color of tokens.colors) {
      vars[`--color-${color.name}`] = color.value;
    }

    for (const typo of tokens.typography) {
      vars[`--font-${typo.name}-family`] = typo.fontFamily;
      vars[`--font-${typo.name}-size`] = typo.fontSize;
      vars[`--font-${typo.name}-weight`] = String(typo.fontWeight);
      vars[`--font-${typo.name}-line-height`] = typo.lineHeight;
    }

    for (const space of tokens.spacing) {
      vars[`--space-${space.name}`] = space.value;
    }

    for (const shadow of tokens.shadows) {
      vars[`--shadow-${shadow.name}`] = shadow.value;
    }

    for (const border of tokens.borders) {
      vars[`--border-${border.name}-width`] = border.width;
      vars[`--border-${border.name}-radius`] = border.radius;
    }

    return vars;
  }

  private getDefaultColors(): ColorToken[] {
    return [
      { name: 'primary', value: '#6366f1', type: 'primary' },
      { name: 'secondary', value: '#8b5cf6', type: 'secondary' },
      { name: 'accent', value: '#06b6d4', type: 'accent' },
      { name: 'background', value: '#ffffff', type: 'background' },
      { name: 'foreground', value: '#0f172a', type: 'text' },
      { name: 'muted', value: '#f1f5f9', type: 'background' },
      { name: 'border', value: '#e2e8f0', type: 'border' },
    ];
  }

  private getDefaultTypography(): TypographyToken[] {
    return [
      {
        name: 'display',
        fontFamily: 'Inter',
        fontSize: '64px',
        fontWeight: 700,
        lineHeight: '1.1',
        role: 'heading',
      },
      {
        name: 'h1',
        fontFamily: 'Inter',
        fontSize: '48px',
        fontWeight: 700,
        lineHeight: '1.2',
        role: 'heading',
      },
      {
        name: 'h2',
        fontFamily: 'Inter',
        fontSize: '36px',
        fontWeight: 600,
        lineHeight: '1.25',
        role: 'subheading',
      },
      {
        name: 'h3',
        fontFamily: 'Inter',
        fontSize: '24px',
        fontWeight: 600,
        lineHeight: '1.3',
        role: 'subheading',
      },
      {
        name: 'body',
        fontFamily: 'Inter',
        fontSize: '16px',
        fontWeight: 400,
        lineHeight: '1.6',
        role: 'body',
      },
      {
        name: 'small',
        fontFamily: 'Inter',
        fontSize: '14px',
        fontWeight: 400,
        lineHeight: '1.5',
        role: 'caption',
      },
    ];
  }

  private getDefaultSpacing(): SpacingToken[] {
    return [
      { name: '0', value: '0px', scale: 0 },
      { name: '1', value: '4px', scale: 1 },
      { name: '2', value: '8px', scale: 2 },
      { name: '3', value: '12px', scale: 3 },
      { name: '4', value: '16px', scale: 4 },
      { name: '6', value: '24px', scale: 6 },
      { name: '8', value: '32px', scale: 8 },
      { name: '12', value: '48px', scale: 12 },
      { name: '16', value: '64px', scale: 16 },
    ];
  }

  private getDefaultShadows(): ShadowToken[] {
    return [
      { name: 'none', value: 'none', type: 'none' },
      { name: 'sm', value: '0 1px 2px 0 rgb(0 0 0 / 0.05)', type: 'sm' },
      { name: 'md', value: '0 4px 6px -1px rgb(0 0 0 / 0.1)', type: 'md' },
      { name: 'lg', value: '0 10px 15px -3px rgb(0 0 0 / 0.1)', type: 'lg' },
      { name: 'xl', value: '0 20px 25px -5px rgb(0 0 0 / 0.1)', type: 'xl' },
    ];
  }

  private getDefaultBorders(): BorderToken[] {
    return [
      { name: 'none', width: '0px', style: 'none', radius: '0px' },
      { name: 'sm', width: '1px', style: 'solid', radius: '4px' },
      { name: 'md', width: '1px', style: 'solid', radius: '8px' },
      { name: 'lg', width: '1px', style: 'solid', radius: '12px' },
      { name: 'full', width: '1px', style: 'solid', radius: '9999px' },
    ];
  }

  private adjustColorShade(hexColor: string, shade: number): string {
    // Convert hex to HSL, adjust lightness, convert back
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0,
      s = 0,
      l = (max + min) / 2;

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

    // Adjust lightness based on shade (500 is the base)
    const lightnessDiff = ((500 - shade) / 500) * 0.5;
    l = Math.max(0, Math.min(1, l + lightnessDiff));

    // Convert back to hex
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const newR = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
    const newG = Math.round(hue2rgb(p, q, h) * 255);
    const newB = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }

  private mapDesignSystem(system: PrismaDesignSystem): DesignSystem {
    return {
      id: system.id,
      name: system.name,
      description: undefined, // Not in Prisma schema
      organizationId: system.organizationId || undefined,
      userId: system.userId || '',
      isDefault: system.isDefault,
      colors: system.colors as unknown as ColorToken[],
      typography: system.typography as unknown as TypographyToken[],
      spacing: system.spacing as unknown as SpacingToken[],
      shadows: system.shadows as unknown as ShadowToken[],
      borders: system.borders as unknown as BorderToken[],
      cssVariables: system.cssVariables as unknown as Record<string, string>,
      tailwindConfig: undefined, // Not in Prisma schema
      createdAt: system.createdAt,
      updatedAt: system.updatedAt,
    };
  }
}
