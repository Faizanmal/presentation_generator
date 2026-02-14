import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIService } from './ai.service';

export interface LayoutSuggestion {
  name: string;
  description: string;
  layout: SlideLayout;
  score: number;
}

export interface SlideLayout {
  type: 'single-column' | 'two-column' | 'grid' | 'hero' | 'split' | 'centered';
  alignment: 'left' | 'center' | 'right';
  spacing: 'compact' | 'normal' | 'spacious';
  blocks: LayoutBlock[];
}

export interface LayoutBlock {
  id: string;
  type: string;
  gridArea?: string;
  width?: string;
  order: number;
  style?: {
    textAlign?: string;
    fontSize?: string;
    fontWeight?: string;
  };
}

interface SlideContent {
  blocks: {
    id: string;
    type: string;
    content: unknown;
  }[];
  heading?: string;
}

@Injectable()
export class AutoLayoutService {
  constructor(
    private configService: ConfigService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Analyze slide content and suggest optimal layouts
   */
  suggestLayouts(content: SlideContent): LayoutSuggestion[] {
    const blockTypes = content.blocks.map((b) => b.type);
    const hasImage = blockTypes.some((t) =>
      ['IMAGE', 'EMBED', 'VIDEO'].includes(t),
    );
    const hasChart = blockTypes.some((t) => ['CHART'].includes(t));
    const hasList = blockTypes.some((t) =>
      ['BULLET_LIST', 'NUMBERED_LIST'].includes(t),
    );
    const hasStats = blockTypes.some((t) =>
      ['STATS_GRID', 'COMPARISON'].includes(t),
    );
    const blockCount = content.blocks.length;

    const suggestions: LayoutSuggestion[] = [];

    // Hero layout for image + minimal text
    if (hasImage && blockCount <= 3) {
      suggestions.push({
        name: 'Hero Layout',
        description: 'Full-width image with text overlay',
        score: hasImage ? 95 : 70,
        layout: {
          type: 'hero',
          alignment: 'center',
          spacing: 'spacious',
          blocks: this.generateHeroLayout(content.blocks),
        },
      });
    }

    // Two-column for image + text or comparison
    if ((hasImage && blockCount >= 2) || hasStats) {
      suggestions.push({
        name: 'Split Layout',
        description: 'Content on left, media on right',
        score: hasImage ? 90 : 80,
        layout: {
          type: 'split',
          alignment: 'left',
          spacing: 'normal',
          blocks: this.generateSplitLayout(content.blocks),
        },
      });
    }

    // Grid layout for multiple items
    if (hasStats || blockCount >= 4) {
      suggestions.push({
        name: 'Grid Layout',
        description: 'Organized grid of content',
        score: hasStats ? 92 : 75,
        layout: {
          type: 'grid',
          alignment: 'center',
          spacing: 'normal',
          blocks: this.generateGridLayout(content.blocks),
        },
      });
    }

    // Centered for quotes or single focus
    if (blockCount <= 2) {
      suggestions.push({
        name: 'Centered Focus',
        description: 'Content centered for emphasis',
        score: blockCount === 1 ? 95 : 85,
        layout: {
          type: 'centered',
          alignment: 'center',
          spacing: 'spacious',
          blocks: this.generateCenteredLayout(content.blocks),
        },
      });
    }

    // Single column for text-heavy slides
    if (hasList || (!hasImage && !hasChart)) {
      suggestions.push({
        name: 'Single Column',
        description: 'Traditional top-to-bottom layout',
        score: hasList ? 88 : 80,
        layout: {
          type: 'single-column',
          alignment: 'left',
          spacing: 'normal',
          blocks: this.generateSingleColumnLayout(content.blocks),
        },
      });
    }

    // Sort by score
    return suggestions.sort((a, b) => b.score - a.score).slice(0, 4);
  }

  /**
   * Apply optimal layout to slide content using AI
   */
  async autoLayout(content: SlideContent): Promise<SlideLayout> {
    const response = await this.aiService.chatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a slide layout expert. Analyze the content and return the optimal layout.
          
Available layout types:
- single-column: Traditional vertical flow
- two-column: Side by side content
- grid: 2x2 or 3xN grid
- hero: Large image with text overlay
- split: 50/50 split with media
- centered: Content centered on slide

Return JSON with:
{
  "type": "layout-type",
  "alignment": "left|center|right",
  "spacing": "compact|normal|spacious",
  "blocks": [
    { "id": "block-id", "type": "block-type", "order": 1, "gridArea": "optional", "width": "optional" }
  ],
  "reasoning": "brief explanation"
}`,
        },
        {
          role: 'user',
          content: `Analyze this slide content and suggest optimal layout:\n\n${JSON.stringify(content, null, 2)}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    });

    const result = JSON.parse(
      response.choices[0]?.message?.content || '{}',
    ) as {
      type?: string;
      alignment?: string;
      spacing?: string;
      blocks?: LayoutBlock[];
    };

    return {
      type: (result.type || 'single-column') as SlideLayout['type'],
      alignment: (result.alignment || 'left') as SlideLayout['alignment'],
      spacing: (result.spacing || 'normal') as SlideLayout['spacing'],
      blocks: result.blocks || this.generateSingleColumnLayout(content.blocks),
    };
  }

  /**
   * Get layout recommendations based on block types
   */
  getRecommendations(blockTypes: string[]): {
    layout: string;
    reason: string;
  }[] {
    const recommendations: { layout: string; reason: string }[] = [];

    const hasImage = blockTypes.some((t) => ['IMAGE', 'VIDEO'].includes(t));
    const hasChart = blockTypes.includes('CHART');
    const hasList = blockTypes.some((t) =>
      ['BULLET_LIST', 'NUMBERED_LIST'].includes(t),
    );
    const hasQuote = blockTypes.includes('QUOTE');
    const hasComparison = blockTypes.includes('COMPARISON');
    const hasStats = blockTypes.includes('STATS_GRID');
    const hasTimeline = blockTypes.includes('TIMELINE');

    if (hasImage && blockTypes.length <= 3) {
      recommendations.push({
        layout: 'hero',
        reason: 'Image-focused content works best with hero layout',
      });
    }

    if (hasImage && hasList) {
      recommendations.push({
        layout: 'split',
        reason: 'Combine visual with text using split layout',
      });
    }

    if (hasChart) {
      recommendations.push({
        layout: 'centered',
        reason: 'Give charts room to breathe with centered layout',
      });
    }

    if (hasQuote) {
      recommendations.push({
        layout: 'centered',
        reason: 'Quotes have more impact when centered',
      });
    }

    if (hasComparison || hasStats) {
      recommendations.push({
        layout: 'grid',
        reason: 'Comparisons and stats display well in grids',
      });
    }

    if (hasTimeline) {
      recommendations.push({
        layout: 'single-column',
        reason: 'Timelines flow naturally in single column',
      });
    }

    if (hasList && !hasImage) {
      recommendations.push({
        layout: 'single-column',
        reason: 'Lists are easiest to read in single column',
      });
    }

    return recommendations;
  }

  /**
   * Apply golden ratio spacing
   */
  calculateGoldenRatioSpacing(containerHeight: number): {
    headerHeight: number;
    contentHeight: number;
    footerHeight: number;
  } {
    const goldenRatio = 1.618;
    const headerRatio = 1 / (goldenRatio * goldenRatio);
    const footerRatio = headerRatio / goldenRatio;
    const contentRatio = 1 - headerRatio - footerRatio;

    return {
      headerHeight: Math.round(containerHeight * headerRatio),
      contentHeight: Math.round(containerHeight * contentRatio),
      footerHeight: Math.round(containerHeight * footerRatio),
    };
  }

  // Private layout generators
  private generateHeroLayout(
    blocks: { id: string; type: string }[],
  ): LayoutBlock[] {
    const imageBlock = blocks.find((b) =>
      ['IMAGE', 'VIDEO', 'EMBED'].includes(b.type),
    );
    const textBlocks = blocks.filter(
      (b) => !['IMAGE', 'VIDEO', 'EMBED'].includes(b.type),
    );

    const layoutBlocks: LayoutBlock[] = [];

    if (imageBlock) {
      layoutBlocks.push({
        id: imageBlock.id,
        type: imageBlock.type,
        width: '100%',
        order: 1,
        style: { textAlign: 'center' },
      });
    }

    textBlocks.forEach((block, index) => {
      layoutBlocks.push({
        id: block.id,
        type: block.type,
        order: index + 2,
        style: {
          textAlign: 'center',
          fontSize: index === 0 ? '2.5rem' : '1.25rem',
        },
      });
    });

    return layoutBlocks;
  }

  private generateSplitLayout(
    blocks: { id: string; type: string }[],
  ): LayoutBlock[] {
    const mediaBlock = blocks.find((b) =>
      ['IMAGE', 'VIDEO', 'EMBED', 'CHART'].includes(b.type),
    );
    const contentBlocks = blocks.filter(
      (b) => !['IMAGE', 'VIDEO', 'EMBED', 'CHART'].includes(b.type),
    );

    const layoutBlocks: LayoutBlock[] = [];

    contentBlocks.forEach((block, index) => {
      layoutBlocks.push({
        id: block.id,
        type: block.type,
        gridArea: 'left',
        width: '50%',
        order: index + 1,
      });
    });

    if (mediaBlock) {
      layoutBlocks.push({
        id: mediaBlock.id,
        type: mediaBlock.type,
        gridArea: 'right',
        width: '50%',
        order: contentBlocks.length + 1,
      });
    }

    return layoutBlocks;
  }

  private generateGridLayout(
    blocks: { id: string; type: string }[],
  ): LayoutBlock[] {
    const columns = blocks.length <= 4 ? 2 : 3;
    return blocks.map((block, index) => ({
      id: block.id,
      type: block.type,
      gridArea: `cell-${Math.floor(index / columns)}-${index % columns}`,
      width: `${100 / columns}%`,
      order: index + 1,
    }));
  }

  private generateCenteredLayout(
    blocks: { id: string; type: string }[],
  ): LayoutBlock[] {
    return blocks.map((block, index) => ({
      id: block.id,
      type: block.type,
      order: index + 1,
      style: {
        textAlign: 'center',
        fontSize: index === 0 ? '2.5rem' : '1.5rem',
      },
    }));
  }

  private generateSingleColumnLayout(
    blocks: { id: string; type: string }[],
  ): LayoutBlock[] {
    return blocks.map((block, index) => ({
      id: block.id,
      type: block.type,
      width: '100%',
      order: index + 1,
    }));
  }
}
