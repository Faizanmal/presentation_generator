import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AIService } from '../ai/ai.service';

interface DesignIssue {
  type:
    | 'color'
    | 'contrast'
    | 'typography'
    | 'layout'
    | 'cultural'
    | 'accessibility'
    | 'language';
  severity: 'error' | 'warning' | 'info';
  element: string;
  description: string;
  suggestion: string;
  wcagCriteria?: string;
}

export interface DesignReport {
  score: number;
  issues: DesignIssue[];
  passedChecks: string[];
  culturalIssues: CulturalIssue[];
}

interface CulturalIssue {
  type: 'color-meaning' | 'symbol' | 'gesture' | 'text-direction' | 'imagery';
  region: string;
  description: string;
  suggestion: string;
}

@Injectable()
export class UniversalDesignService {
  private readonly logger = new Logger(UniversalDesignService.name);

  // Color meanings across cultures
  private readonly colorCulturalMeanings: Record<
    string,
    Record<string, string>
  > = {
    red: {
      Western: 'danger, passion, excitement',
      China: 'luck, prosperity, happiness',
      India: 'purity, fertility',
      'South Africa': 'mourning',
      'Middle East': 'danger, caution',
    },
    white: {
      Western: 'purity, peace, cleanliness',
      China: 'death, mourning',
      Japan: 'death, mourning',
      India: 'unhappiness',
      'Middle East': 'purity, mourning',
    },
    green: {
      Western: 'nature, growth, money',
      China: 'infidelity',
      'Middle East': 'Islam, strength',
      Japan: 'eternal life',
    },
    yellow: {
      Western: 'happiness, caution',
      China: 'royalty, honor',
      Japan: 'courage',
      Egypt: 'mourning',
    },
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Run full design check on a project
   */
  async checkProject(
    projectId: string,
    options?: {
      targetRegions?: string[];
      checkAccessibility?: boolean;
      checkCultural?: boolean;
    },
  ): Promise<DesignReport> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        slides: {
          include: { blocks: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const issues: DesignIssue[] = [];
    const culturalIssues: CulturalIssue[] = [];
    const passedChecks: string[] = [];

    // Run checks
    if (options?.checkAccessibility !== false) {
      const accessibilityIssues = this.checkAccessibility(project);
      issues.push(...accessibilityIssues);
    }

    if (options?.checkCultural !== false) {
      const cultural = this.checkCulturalSensitivity(
        project,
        options?.targetRegions || ['Western', 'China', 'Middle East'],
      );
      culturalIssues.push(...cultural);
    }

    // Check typography
    const typographyIssues = this.checkTypography(project);
    issues.push(...typographyIssues);

    // Check layout
    const layoutIssues = this.checkLayout(project);
    issues.push(...layoutIssues);

    // Track passed checks
    if (!issues.some((i) => i.type === 'contrast')) {
      passedChecks.push('Color contrast meets WCAG standards');
    }
    if (!issues.some((i) => i.type === 'typography')) {
      passedChecks.push('Typography is accessible');
    }
    if (!layoutIssues.length) {
      passedChecks.push('Layout follows best practices');
    }

    // Calculate score
    const score = this.calculateScore(issues, culturalIssues);

    // Store report
    await this.prisma.universalDesignReport.create({
      data: {
        projectId,
        overallScore: score,
        accessibilityScore: score,
        culturalScore: 0,
        readabilityScore: 0,
        issuesFound: issues.length + culturalIssues.length,
        issues: issues as unknown as Prisma.InputJsonValue,
        suggestions: [] as unknown as Prisma.InputJsonValue,
        details: {
          issues,
          culturalIssues,
          passedChecks,
        } as unknown as Prisma.InputJsonValue,
        targetRegions: options?.targetRegions || ['Universal'],
      },
    });

    return {
      score,
      issues,
      passedChecks,
      culturalIssues,
    };
  }

  /**
   * Check accessibility compliance
   */
  private checkAccessibility(project: {
    slides: Array<{
      blocks: Array<{ blockType: string; content: unknown; styles?: unknown }>;
    }>;
  }): DesignIssue[] {
    const issues: DesignIssue[] = [];

    for (const slide of project.slides) {
      for (const block of slide.blocks) {
        const content =
          (block.content as { text?: string; alt?: string }) || {};
        const styles =
          (block.styles as {
            fontSize?: number;
            color?: string;
            backgroundColor?: string;
          }) || {};

        // Check for alt text on images
        if (block.blockType === 'image' && !content.alt) {
          issues.push({
            type: 'accessibility',
            severity: 'error',
            element: `Image block`,
            description: 'Image missing alternative text',
            suggestion: 'Add descriptive alt text for screen readers',
            wcagCriteria: 'WCAG 1.1.1',
          });
        }

        // Check font size
        if (styles.fontSize && styles.fontSize < 14) {
          issues.push({
            type: 'typography',
            severity: 'warning',
            element: `Text block`,
            description: `Font size ${styles.fontSize}px is too small`,
            suggestion: 'Use minimum 14px for body text, 18px recommended',
            wcagCriteria: 'WCAG 1.4.4',
          });
        }

        // Check color contrast
        if (styles.color && styles.backgroundColor) {
          const contrast = this.calculateContrast(
            styles.color,
            styles.backgroundColor,
          );
          if (contrast < 4.5) {
            issues.push({
              type: 'contrast',
              severity: 'error',
              element: 'Text element',
              description: `Contrast ratio ${contrast.toFixed(1)}:1 is below minimum 4.5:1`,
              suggestion: 'Increase contrast between text and background',
              wcagCriteria: 'WCAG 1.4.3',
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Calculate color contrast ratio (WCAG 2.0 algorithm)
   */
  private calculateContrast(foreground: string, background: string): number {
    const fgLum = this.getRelativeLuminance(foreground);
    const bgLum = this.getRelativeLuminance(background);
    const lighter = Math.max(fgLum, bgLum);
    const darker = Math.min(fgLum, bgLum);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Calculate relative luminance from a CSS color string
   */
  private getRelativeLuminance(color: string): number {
    const rgb = this.parseColor(color);
    if (!rgb) return 0;
    const [r, g, b] = rgb.map((c) => {
      const sRGB = c / 255;
      return sRGB <= 0.03928
        ? sRGB / 12.92
        : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Parse CSS color string (hex, rgb) into [r, g, b] array
   */
  private parseColor(color: string): number[] | null {
    // Hex: #RGB, #RRGGBB
    const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
    if (hexMatch) {
      let hex = hexMatch[1];
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      return [
        parseInt(hex.substring(0, 2), 16),
        parseInt(hex.substring(2, 4), 16),
        parseInt(hex.substring(4, 6), 16),
      ];
    }
    // rgb(r, g, b) or rgba(r, g, b, a)
    const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) {
      return [
        parseInt(rgbMatch[1]),
        parseInt(rgbMatch[2]),
        parseInt(rgbMatch[3]),
      ];
    }

    // Named colors (common ones)
    const namedColors: Record<string, number[]> = {
      white: [255, 255, 255],
      black: [0, 0, 0],
      red: [255, 0, 0],
      green: [0, 128, 0],
      blue: [0, 0, 255],
      yellow: [255, 255, 0],
      gray: [128, 128, 128],
      grey: [128, 128, 128],
    };
    return namedColors[color.toLowerCase()] || null;
  }

  /**
   * Check cultural sensitivity
   */
  private checkCulturalSensitivity(
    project: {
      slides: Array<{ blocks: Array<{ content: unknown; styles?: unknown }> }>;
    },
    regions: string[],
  ): CulturalIssue[] {
    const issues: CulturalIssue[] = [];

    for (const slide of project.slides) {
      for (const block of slide.blocks) {
        const styles =
          (block.styles as { color?: string; backgroundColor?: string }) || {};

        // Check color meanings
        for (const colorProp of ['color', 'backgroundColor'] as const) {
          const color = styles[colorProp];
          if (color) {
            const colorName = this.getColorName(color);
            if (colorName && this.colorCulturalMeanings[colorName]) {
              for (const region of regions) {
                const meaning = this.colorCulturalMeanings[colorName][region];
                if (
                  meaning &&
                  (meaning.includes('death') || meaning.includes('mourning'))
                ) {
                  issues.push({
                    type: 'color-meaning',
                    region,
                    description: `${colorName} color signifies ${meaning} in ${region} culture`,
                    suggestion: `Consider color alternatives for ${region} audience`,
                  });
                }
              }
            }
          }
        }
      }
    }

    return issues;
  }

  /**
   * Get color name from hex/rgb
   */
  private getColorName(color: string): string | null {
    const colorMap: Record<string, string[]> = {
      red: ['#ff0000', '#f00', 'red', '#e53935', '#d32f2f'],
      white: ['#ffffff', '#fff', 'white'],
      green: ['#00ff00', '#0f0', 'green', '#4caf50', '#388e3c'],
      yellow: ['#ffff00', '#ff0', 'yellow', '#ffc107', '#ffeb3b'],
    };

    const lowerColor = color.toLowerCase();
    for (const [name, values] of Object.entries(colorMap)) {
      if (values.includes(lowerColor)) {
        return name;
      }
    }
    return null;
  }

  /**
   * Check typography
   */
  private checkTypography(project: {
    slides: Array<{ blocks: Array<{ content: unknown; styles?: unknown }> }>;
  }): DesignIssue[] {
    const issues: DesignIssue[] = [];
    const fontFamilies = new Set<string>();

    for (const slide of project.slides) {
      for (const block of slide.blocks) {
        const styles = (block.styles as { fontFamily?: string }) || {};
        if (styles.fontFamily) {
          fontFamilies.add(styles.fontFamily);
        }
      }
    }

    // Check for too many fonts
    if (fontFamilies.size > 3) {
      issues.push({
        type: 'typography',
        severity: 'warning',
        element: 'Project',
        description: `Using ${fontFamilies.size} different fonts`,
        suggestion: 'Limit to 2-3 font families for consistency',
      });
    }

    return issues;
  }

  /**
   * Check layout
   */
  private checkLayout(project: {
    slides: Array<{ blocks: Array<{ content: unknown }> }>;
  }): DesignIssue[] {
    const issues: DesignIssue[] = [];

    for (let i = 0; i < project.slides.length; i++) {
      const slide = project.slides[i];

      // Check for overcrowded slides
      if (slide.blocks.length > 8) {
        issues.push({
          type: 'layout',
          severity: 'warning',
          element: `Slide ${i + 1}`,
          description: 'Slide has too many elements',
          suggestion: 'Consider splitting content across multiple slides',
        });
      }

      // Check for text density
      let textLength = 0;
      for (const block of slide.blocks) {
        const content = (block.content as { text?: string }) || {};
        if (content.text) {
          textLength += content.text.length;
        }
      }

      if (textLength > 500) {
        issues.push({
          type: 'layout',
          severity: 'warning',
          element: `Slide ${i + 1}`,
          description: 'Slide has too much text',
          suggestion: 'Reduce text and use bullet points or visuals',
        });
      }
    }

    return issues;
  }

  /**
   * Calculate overall score
   */
  private calculateScore(
    issues: DesignIssue[],
    culturalIssues: CulturalIssue[],
  ): number {
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'error':
          score -= 10;
          break;
        case 'warning':
          score -= 5;
          break;
        case 'info':
          score -= 1;
          break;
      }
    }

    score -= culturalIssues.length * 3;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get cultural guide for region
   */
  getCulturalGuide(region: string) {
    const guides: Record<string, object> = {
      Western: {
        colors: { green: 'positive', red: 'danger/passion', white: 'purity' },
        symbols: { thumbsUp: 'positive', ok: 'positive' },
        textDirection: 'ltr',
        tips: ['Use direct communication', 'Time-sensitive audiences'],
      },
      China: {
        colors: {
          red: 'luck/prosperity',
          white: 'mourning',
          yellow: 'royalty',
        },
        symbols: { number4: 'avoid (death)', number8: 'lucky' },
        textDirection: 'ltr',
        tips: ['Emphasize group harmony', 'Respect hierarchy'],
      },
      'Middle East': {
        colors: { green: 'Islam/positive', white: 'purity' },
        symbols: { leftHand: 'avoid' },
        textDirection: 'rtl',
        tips: ['Consider RTL layout', 'Modest imagery'],
      },
      Japan: {
        colors: { white: 'mourning', red: 'good luck' },
        symbols: { silence: 'respect' },
        textDirection: 'ltr',
        tips: ['Indirect communication', 'Attention to detail'],
      },
    };

    return guides[region] || { message: 'Guide not available for this region' };
  }

  /**
   * Get report history
   */
  async getReportHistory(projectId: string, _projectId2?: never) {
    return this.prisma.universalDesignReport.findMany({
      where: { projectId },
      orderBy: { checkedAt: 'desc' },
      take: 10,
    });
  }

  /**
   * Auto-fix issues for a project
   */
  async autoFix(projectId: string, issueTypes: string[]) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { slides: { include: { blocks: true } } },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const fixResults: Array<{ type: string; element: string; action: string }> =
      [];

    for (const slide of project.slides) {
      for (const block of slide.blocks) {
        const styles = (block.style as Record<string, any>) || {};
        const content = (block.content as Record<string, any>) || {};
        let updated = false;
        const updates: { style?: object; content?: object } = {};

        // Fix small font sizes
        if (
          issueTypes.includes('typography') &&
          styles.fontSize &&
          styles.fontSize < 14
        ) {
          updates.style = { ...styles, fontSize: 16 };
          fixResults.push({
            type: 'typography',
            element: `Block ${block.id}`,
            action: `Increased font size from ${styles.fontSize}px to 16px`,
          });
          updated = true;
        }

        // Fix missing alt text on images
        if (
          issueTypes.includes('accessibility') &&
          block.blockType === 'IMAGE' &&
          !content.alt
        ) {
          const altText = content.src
            ? `Image: ${
                (content.src as string)
                  .split('/')
                  .pop()
                  ?.replace(/[-_]/g, ' ')
                  .replace(/\.\w+$/, '') || 'presentation image'
              }`
            : 'Presentation image';
          updates.content = { ...content, alt: altText };
          fixResults.push({
            type: 'accessibility',
            element: `Image block ${block.id}`,
            action: `Added auto-generated alt text`,
          });
          updated = true;
        }

        if (updated) {
          await this.prisma.block.update({
            where: { id: block.id },
            data: {
              ...(updates.style && {
                style: updates.style as Prisma.InputJsonValue,
              }),
              ...(updates.content && {
                content: updates.content as Prisma.InputJsonValue,
              }),
            },
          });
        }
      }
    }

    return {
      fixed: fixResults.length,
      details: fixResults,
      message:
        fixResults.length > 0
          ? `Applied ${fixResults.length} automatic fixes`
          : 'No auto-fixable issues found',
    };
  }
}
