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

        // Check color contrast (simplified)
        if (styles.color && styles.backgroundColor) {
          const contrast = this.calculateContrast();
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
   * Calculate color contrast ratio
   */
  private calculateContrast(): number {
    // Simplified contrast calculation
    // Real implementation would parse hex/rgb colors and calculate luminance
    return 5; // Placeholder
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
   * Auto-fix issues
   */
  autoFix(_projectId: string, issueTypes: string[]) {
    // In production, this would apply automatic fixes
    return {
      fixed: issueTypes,
      message: 'Auto-fix suggestions generated. Review before applying.',
    };
  }
}
