import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export type IssueSeverity = 'error' | 'warning' | 'suggestion';
export type IssueCategory =
  | 'contrast'
  | 'font-size'
  | 'alt-text'
  | 'reading-order'
  | 'color-only'
  | 'motion'
  | 'language'
  | 'structure';

export interface AccessibilityIssue {
  id: string;
  slideId: string;
  blockId?: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  wcagCriteria: string;
  suggestion: string;
  autoFixable: boolean;
  autoFixData?: Record<string, unknown>;
}

export interface AccessibilityReport {
  projectId: string;
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  totalIssues: number;
  issuesByCategory: Record<IssueCategory, number>;
  issuesBySeverity: Record<IssueSeverity, number>;
  issues: AccessibilityIssue[];
  checkedAt: Date;
}

export interface WCAGGuideline {
  id: string;
  name: string;
  level: 'A' | 'AA' | 'AAA';
  description: string;
}

@Injectable()
export class AccessibilityService {
  private readonly logger = new Logger(AccessibilityService.name);

  // WCAG 2.1 color contrast requirements
  private readonly MIN_CONTRAST_NORMAL = 4.5;
  private readonly MIN_CONTRAST_LARGE = 3;
  private readonly LARGE_TEXT_SIZE = 18;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Run a full accessibility check on a project
   */
  async checkProject(
    projectId: string,
    userId: string,
  ): Promise<AccessibilityReport> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
      include: {
        slides: {
          include: { blocks: true },
          orderBy: { order: 'asc' },
        },
        theme: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const issues: AccessibilityIssue[] = [];
    const themeColors =
      (project.theme?.colors as Record<string, unknown>) || {};

    // Check each slide
    for (const slide of project.slides) {
      // Check slide structure
      issues.push(...this.checkSlideStructure(slide));

      // Check each block
      for (const block of slide.blocks) {
        issues.push(...this.checkBlock(block, themeColors, slide.id));
      }
    }

    // Calculate score and grade
    const { score, grade } = this.calculateScore(issues);

    // Aggregate issues
    const issuesByCategory: Record<IssueCategory, number> = {
      contrast: 0,
      'font-size': 0,
      'alt-text': 0,
      'reading-order': 0,
      'color-only': 0,
      motion: 0,
      language: 0,
      structure: 0,
    };

    const issuesBySeverity: Record<IssueSeverity, number> = {
      error: 0,
      warning: 0,
      suggestion: 0,
    };

    for (const issue of issues) {
      issuesByCategory[issue.category]++;
      issuesBySeverity[issue.severity]++;
    }

    const report: AccessibilityReport = {
      projectId,
      score,
      grade,
      totalIssues: issues.length,
      issuesByCategory,
      issuesBySeverity,
      issues,
      checkedAt: new Date(),
    };

    // Save the report
    await this.prisma.accessibilityReport.create({
      data: {
        projectId,
        score,
        grade,
        totalIssues: issues.length,

        issues: issues as unknown as Prisma.InputJsonValue,
        issuesByCategory: issuesByCategory as unknown as Prisma.InputJsonValue,
        issuesBySeverity: issuesBySeverity as unknown as Prisma.InputJsonValue,
        suggestions: [] as unknown as Prisma.InputJsonValue,
      },
    });

    return report;
  }

  /**
   * Check contrast between two colors
   */
  checkContrast(
    foreground: string,
    background: string,
  ): { ratio: number; passesAA: boolean; passesAAA: boolean } {
    const fgLuminance = this.getRelativeLuminance(foreground);
    const bgLuminance = this.getRelativeLuminance(background);

    const lighter = Math.max(fgLuminance, bgLuminance);
    const darker = Math.min(fgLuminance, bgLuminance);
    const ratio = (lighter + 0.05) / (darker + 0.05);

    return {
      ratio: Math.round(ratio * 100) / 100,
      passesAA: ratio >= this.MIN_CONTRAST_NORMAL,
      passesAAA: ratio >= 7,
    };
  }

  /**
   * Suggest accessible color alternatives
   */
  suggestAccessibleColors(
    foreground: string,
    background: string,
    targetRatio: number = 4.5,
  ): {
    adjustedForeground: string;
    adjustedBackground: string;
    newRatio: number;
  } {
    // Try adjusting foreground first
    const adjustedFg = this.adjustColorForContrast(
      foreground,
      background,
      targetRatio,
    );
    let result = this.checkContrast(adjustedFg, background);

    if (result.ratio >= targetRatio) {
      return {
        adjustedForeground: adjustedFg,
        adjustedBackground: background,
        newRatio: result.ratio,
      };
    }

    // If foreground adjustment doesn't work, try adjusting background
    const adjustedBg = this.adjustColorForContrast(
      background,
      foreground,
      targetRatio,
    );
    result = this.checkContrast(foreground, adjustedBg);

    return {
      adjustedForeground: foreground,
      adjustedBackground: adjustedBg,
      newRatio: result.ratio,
    };
  }

  /**
   * Generate alt text for an image using AI
   */
  async generateAltText(imageUrl: string): Promise<string> {
    try {
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Generate concise, descriptive alt text for this image. The alt text should be under 125 characters, describe the key visual elements, and be useful for screen reader users. Return only the alt text, nothing else.',
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        max_tokens: 100,
      });

      const content = response.choices[0]?.message?.content;
      if (typeof content === 'string') {
        return content.trim() || 'Image';
      }
      return 'Image';
    } catch (error) {
      this.logger.error('Failed to generate alt text:', error);
      return 'Decorative image';
    }
  }

  /**
   * Auto-fix issues where possible
   */
  async autoFixIssues(
    projectId: string,
    userId: string,
    issueIds: string[],
  ): Promise<{
    fixed: number;
    failed: number;
    details: Array<{ issueId: string; fixed: boolean; message: string }>;
  }> {
    const report = await this.prisma.accessibilityReport.findFirst({
      where: { projectId },
      orderBy: { checkedAt: 'desc' },
    });

    if (!report) {
      throw new NotFoundException('No accessibility report found');
    }

    const reportIssues = Array.isArray(report.issues)
      ? (report.issues as unknown as AccessibilityIssue[])
      : [];
    const issues = reportIssues.filter(
      (i) => issueIds.includes(i.id) && i.autoFixable,
    );

    const details: Array<{ issueId: string; fixed: boolean; message: string }> =
      [];
    let fixed = 0;
    let failed = 0;

    for (const issue of issues) {
      try {
        await this.applyAutoFix(issue);
        fixed++;
        details.push({
          issueId: issue.id,
          fixed: true,
          message: 'Fixed successfully',
        });
      } catch (error) {
        failed++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        details.push({
          issueId: issue.id,
          fixed: false,
          message: errorMessage,
        });
      }
    }

    return { fixed, failed, details };
  }

  /**
   * Get accessibility guidelines reference
   */
  getWCAGGuidelines(): WCAGGuideline[] {
    return [
      {
        id: '1.1.1',
        name: 'Non-text Content',
        level: 'A',
        description: 'All non-text content has a text alternative',
      },
      {
        id: '1.3.1',
        name: 'Info and Relationships',
        level: 'A',
        description:
          'Information and relationships are programmatically determined',
      },
      {
        id: '1.3.2',
        name: 'Meaningful Sequence',
        level: 'A',
        description: 'Reading order is logical and meaningful',
      },
      {
        id: '1.4.1',
        name: 'Use of Color',
        level: 'A',
        description:
          'Color is not the only visual means of conveying information',
      },
      {
        id: '1.4.3',
        name: 'Contrast (Minimum)',
        level: 'AA',
        description: 'Text has a contrast ratio of at least 4.5:1',
      },
      {
        id: '1.4.4',
        name: 'Resize Text',
        level: 'AA',
        description: 'Text can be resized up to 200% without loss',
      },
      {
        id: '1.4.6',
        name: 'Contrast (Enhanced)',
        level: 'AAA',
        description: 'Text has a contrast ratio of at least 7:1',
      },
      {
        id: '2.4.2',
        name: 'Page Titled',
        level: 'A',
        description: 'Pages have titles that describe topic or purpose',
      },
      {
        id: '2.4.6',
        name: 'Headings and Labels',
        level: 'AA',
        description: 'Headings and labels describe topic or purpose',
      },
      {
        id: '3.1.1',
        name: 'Language of Page',
        level: 'A',
        description: 'Default language is programmatically determined',
      },
    ];
  }

  // Private helper methods
  private checkSlideStructure(
    slide: Record<string, unknown> & {
      id: string;
      blocks?: Array<Record<string, unknown>>;
    },
  ): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const blocks = (slide.blocks as Array<Record<string, unknown>>) || [];

    // Check for heading hierarchy
    const headings = blocks.filter(
      (b: Record<string, unknown>) =>
        b.blockType === 'HEADING' || b.blockType === 'SUBHEADING',
    );

    if (headings.length === 0) {
      issues.push({
        id: `${slide.id}_no_heading`,
        slideId: slide.id,
        category: 'structure',
        severity: 'warning',
        title: 'Missing heading',
        description:
          'Slide does not have a heading, which helps with navigation',
        wcagCriteria: '2.4.6',
        suggestion: 'Add a heading to describe the slide content',
        autoFixable: false,
      });
    }

    // Check reading order
    const orderedBlocks = blocks.sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) =>
        (Number(a.order) || 0) - (Number(b.order) || 0),
    );
    let hasReadingOrderIssue = false;

    for (let i = 0; i < orderedBlocks.length - 1; i++) {
      const current = orderedBlocks[i];
      const next = orderedBlocks[i + 1];

      // Check if a subheading comes before a heading
      if (current.blockType === 'SUBHEADING' && next.blockType === 'HEADING') {
        hasReadingOrderIssue = true;
        break;
      }
    }

    if (hasReadingOrderIssue) {
      issues.push({
        id: `${slide.id}_reading_order`,
        slideId: slide.id,
        category: 'reading-order',
        severity: 'error',
        title: 'Incorrect reading order',
        description: 'Subheading appears before the main heading',
        wcagCriteria: '1.3.2',
        suggestion: 'Reorder blocks so headings come before subheadings',
        autoFixable: false,
      });
    }

    return issues;
  }

  private checkBlock(
    block: Record<string, unknown> & { id: string },
    themeColors: Record<string, unknown>,
    slideId: string,
  ): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const content = (block.content as Record<string, unknown>) || {};

    // Check images for alt text
    if (block.blockType === 'IMAGE') {
      const altText = String((content.alt || content.altText || '') as unknown);
      if (!altText || altText.length < 5) {
        issues.push({
          id: `${block.id}_no_alt`,
          slideId,
          blockId: block.id,
          category: 'alt-text',
          severity: 'error',
          title: 'Missing alt text',
          description: 'Image does not have descriptive alt text',
          wcagCriteria: '1.1.1',
          suggestion: 'Add descriptive alt text for the image',
          autoFixable: true,
          autoFixData: { imageUrl: content.url || content.src },
        });
      }
    }

    // Check text blocks for font size
    const textBlockTypes = ['HEADING', 'SUBHEADING', 'PARAGRAPH', 'QUOTE'];
    if (textBlockTypes.includes(String(block.blockType))) {
      const style = (block.style as Record<string, unknown>) || {};
      const fontSize = parseInt(String(style.fontSize) || '16', 10);

      if (fontSize < 12) {
        issues.push({
          id: `${block.id}_small_font`,
          slideId,
          blockId: block.id,
          category: 'font-size',
          severity: 'warning',
          title: 'Text may be too small',
          description: `Font size of ${fontSize}px may be difficult to read`,
          wcagCriteria: '1.4.4',
          suggestion: 'Use a minimum font size of 12px for body text',
          autoFixable: true,
          autoFixData: { newFontSize: '14px' },
        });
      }

      // Check contrast if colors are specified
      const textColor = String(
        (style.color as string) || (themeColors.text as string) || '#000000',
      );
      const bgColor = String(
        (style.backgroundColor as string) ||
          (themeColors.background as string) ||
          '#ffffff',
      );

      const contrast = this.checkContrast(textColor, bgColor);

      if (!contrast.passesAA) {
        issues.push({
          id: `${block.id}_low_contrast`,
          slideId,
          blockId: block.id,
          category: 'contrast',
          severity: 'error',
          title: 'Insufficient color contrast',
          description: `Contrast ratio of ${contrast.ratio}:1 is below the 4.5:1 minimum`,
          wcagCriteria: '1.4.3',
          suggestion:
            'Increase the contrast between text and background colors',
          autoFixable: true,
          autoFixData: { foreground: textColor, background: bgColor },
        });
      }
    }

    // Check for color-only information
    if (block.blockType === 'CHART' || block.blockType === 'STATS_GRID') {
      const hasLabels = (content.showDataLabels as boolean) !== false;
      const hasLegend = (content.showLegend as boolean) !== false;

      if (!hasLabels && !hasLegend) {
        issues.push({
          id: `${block.id}_color_only`,
          slideId,
          blockId: block.id,
          category: 'color-only',
          severity: 'warning',
          title: 'Information conveyed by color only',
          description: 'Chart relies on color alone to distinguish data',
          wcagCriteria: '1.4.1',
          suggestion: 'Add labels or patterns to distinguish chart elements',
          autoFixable: true,
          autoFixData: { showDataLabels: true, showLegend: true },
        });
      }
    }

    return issues;
  }

  private calculateScore(issues: AccessibilityIssue[]): {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
  } {
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'error':
          score -= 10;
          break;
        case 'warning':
          score -= 5;
          break;
        case 'suggestion':
          score -= 2;
          break;
      }
    }

    score = Math.max(0, score);

    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';

    return { score, grade };
  }

  private getRelativeLuminance(hex: string): number {
    const rgb = this.hexToRgb(hex);

    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const rLin = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    const gLin = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    const bLin = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

    return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
  }

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

  private adjustColorForContrast(
    colorToAdjust: string,
    referenceColor: string,
    targetRatio: number,
  ): string {
    const refLuminance = this.getRelativeLuminance(referenceColor);
    let rgb = this.hexToRgb(colorToAdjust);

    // Determine if we need to lighten or darken
    const shouldLighten = refLuminance < 0.5;

    for (let i = 0; i < 100; i++) {
      const adjusted = shouldLighten
        ? {
            r: Math.min(255, rgb.r + 5),
            g: Math.min(255, rgb.g + 5),
            b: Math.min(255, rgb.b + 5),
          }
        : {
            r: Math.max(0, rgb.r - 5),
            g: Math.max(0, rgb.g - 5),
            b: Math.max(0, rgb.b - 5),
          };

      const adjustedHex = this.rgbToHex(adjusted.r, adjusted.g, adjusted.b);
      const result = this.checkContrast(adjustedHex, referenceColor);

      if (result.ratio >= targetRatio) {
        return adjustedHex;
      }

      rgb = adjusted;
    }

    return this.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  private async applyAutoFix(issue: AccessibilityIssue): Promise<void> {
    if (!issue.blockId || !issue.autoFixData) return;

    switch (issue.category) {
      case 'alt-text': {
        const imageUrl = String(issue.autoFixData.imageUrl);
        const altText = await this.generateAltText(imageUrl);
        const currentBlock = await this.prisma.block.findUnique({
          where: { id: issue.blockId },
        });
        const currentContent =
          (currentBlock?.content as Record<string, unknown>) || {};
        await this.prisma.block.update({
          where: { id: issue.blockId },
          data: {
            content: {
              ...currentContent,
              alt: altText,
            },
          },
        });
        break;
      }

      case 'font-size': {
        const currentBlock = await this.prisma.block.findUnique({
          where: { id: issue.blockId },
        });
        const currentStyle =
          (currentBlock?.style as Record<string, unknown>) || {};
        await this.prisma.block.update({
          where: { id: issue.blockId },
          data: {
            style: {
              ...currentStyle,
              fontSize: String(issue.autoFixData.newFontSize),
            },
          },
        });
        break;
      }

      case 'contrast': {
        const suggestion = this.suggestAccessibleColors(
          String(issue.autoFixData.foreground),
          String(issue.autoFixData.background),
        );
        const currentBlock = await this.prisma.block.findUnique({
          where: { id: issue.blockId },
        });
        const currentStyle =
          (currentBlock?.style as Record<string, unknown>) || {};
        await this.prisma.block.update({
          where: { id: issue.blockId },
          data: {
            style: {
              ...currentStyle,
              color: suggestion.adjustedForeground,
            },
          },
        });
        break;
      }

      case 'color-only': {
        const currentBlock = await this.prisma.block.findUnique({
          where: { id: issue.blockId },
        });
        const currentContent =
          (currentBlock?.content as Record<string, unknown>) || {};
        await this.prisma.block.update({
          where: { id: issue.blockId },
          data: {
            content: {
              ...currentContent,
              showDataLabels: true,
              showLegend: true,
            },
          },
        });
        break;
      }
    }
  }
}
