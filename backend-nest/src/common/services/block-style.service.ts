import { Injectable, Logger } from '@nestjs/common';
import {
  EnhancedBlock,
  TEXT_COLOR_PALETTE,
  CARD_STYLES,
  SHADOW_LEVELS,
  BaseBlockStyle,
} from '../types/enhanced-block.types';

/**
 * Service for applying enhanced styles to content blocks
 */
@Injectable()
export class BlockStyleService {
  private readonly logger = new Logger(BlockStyleService.name);

  /**
   * Apply default styles to a block based on its type
   */
  applyDefaultStyles(block: Partial<EnhancedBlock>): EnhancedBlock {
    const blockType = block.type;

    switch (blockType) {
      case 'heading':
        return {
          ...block,
          style: {
            color: TEXT_COLOR_PALETTE.heading,
            fontSize: '36px',
            fontWeight: 'bold',
            lineHeight: '1.2',
            ...block.style,
          },
        } as EnhancedBlock;

      case 'subheading':
        return {
          ...block,
          style: {
            color: TEXT_COLOR_PALETTE.subheading,
            fontSize: '24px',
            fontWeight: '600',
            lineHeight: '1.3',
            ...block.style,
          },
        } as EnhancedBlock;

      case 'paragraph': {
        const paragraphStyle: BaseBlockStyle = {
          color: TEXT_COLOR_PALETTE.paragraph,
          fontSize: '18px',
          lineHeight: '1.6',
          ...block.style,
        };

        // Apply card style if specified
        if ('cardStyle' in block && block.cardStyle) {
          Object.assign(paragraphStyle, CARD_STYLES.default);
        }

        return {
          ...block,
          style: paragraphStyle,
        } as EnhancedBlock;
      }

      case 'bullet-list':
      case 'numbered-list':
        return {
          ...block,
          style: {
            color: TEXT_COLOR_PALETTE.list,
            fontSize: '16px',
            lineHeight: '1.8',
            ...block.style,
          },
        } as EnhancedBlock;

      case 'card': {
        const cardVariant = ('variant' in block && block.variant) || 'default';
        return {
          ...block,
          style: {
            ...(CARD_STYLES[cardVariant as keyof typeof CARD_STYLES] ||
              CARD_STYLES.default),
            ...block.style,
          },
        } as EnhancedBlock;
      }

      case 'quote':
        return {
          ...block,
          style: {
            color: TEXT_COLOR_PALETTE.quote,
            fontSize: '20px',
            fontStyle: 'italic',
            lineHeight: '1.5',
            borderColor: TEXT_COLOR_PALETTE.quote,
            borderWidth: '0 0 0 4px',
            padding: '10px 20px',
            ...block.style,
          },
        } as EnhancedBlock;

      case 'callout': {
        const variant = ('variant' in block && block.variant) || 'info';
        const calloutColor =
          TEXT_COLOR_PALETTE[variant as keyof typeof TEXT_COLOR_PALETTE] ||
          TEXT_COLOR_PALETTE.info;
        const cardStyle =
          CARD_STYLES[variant as keyof typeof CARD_STYLES] || CARD_STYLES.info;

        return {
          ...block,
          style: {
            ...cardStyle,
            color: calloutColor,
            ...block.style,
          },
        } as EnhancedBlock;
      }

      case 'chart':
        return {
          ...block,
          style: {
            backgroundColor: '#ffffff',
            padding: '20px',
            borderRadius: '8px',
            ...block.style,
          },
        } as EnhancedBlock;

      case 'logo':
      case 'logo-grid':
        return {
          ...block,
          style: {
            padding: '15px',
            textAlign: 'center',
            ...block.style,
          },
        } as EnhancedBlock;

      default:
        return block as EnhancedBlock;
    }
  }

  /**
   * Apply card styling to a block
   */
  applyCardStyle(
    block: EnhancedBlock,
    variant: 'default' | 'info' | 'success' | 'warning' | 'error' = 'default',
  ): EnhancedBlock {
    return {
      ...block,
      style: {
        ...block.style,
        ...CARD_STYLES[variant],
      },
    };
  }

  /**
   * Apply shadow to a block
   */
  applyShadow(
    block: EnhancedBlock,
    level: 'none' | 'low' | 'medium' | 'high',
  ): EnhancedBlock {
    return {
      ...block,
      style: {
        ...block.style,
        boxShadow: SHADOW_LEVELS[level],
      },
    };
  }

  /**
   * Add emoji to content
   */
  addEmoji(
    content: string,
    emoji: string,
    position: 'before' | 'after' = 'before',
  ): string {
    if (position === 'before') {
      return `${emoji} ${content}`;
    }
    return `${content} ${emoji}`;
  }

  /**
   * Format text with color
   */
  formatTextWithColor(text: string): string {
    return text; // In practice, this would wrap with HTML/CSS or return metadata
  }

  /**
   * Create a styled heading block
   */
  createHeadingBlock(
    content: string,
    emoji?: string,
    customStyle?: Partial<BaseBlockStyle>,
  ): EnhancedBlock {
    const block: Partial<EnhancedBlock> = {
      type: 'heading',
      content: emoji ? this.addEmoji(content, emoji) : content,
      style: customStyle,
    };

    return this.applyDefaultStyles(block);
  }

  /**
   * Create a card block
   */
  createCardBlock(
    content: string,
    title?: string,
    icon?: string,
    variant: 'default' | 'info' | 'success' | 'warning' | 'error' = 'default',
  ): EnhancedBlock {
    const block: Partial<EnhancedBlock> = {
      type: 'card',
      content,
      title,
      icon,
      style: CARD_STYLES[variant],
    };

    return this.applyDefaultStyles(block);
  }

  /**
   * Create a chart block
   */
  createChartBlock(
    title: string,
    chartType: 'bar' | 'line' | 'pie' | 'doughnut',
    dataQuery?: string,
    useRealTimeData: boolean = true,
  ): EnhancedBlock {
    const block: Partial<EnhancedBlock> = {
      type: 'chart',
      title,
      chartType,
      dataQuery,
      useRealTimeData,
    };

    return this.applyDefaultStyles(block);
  }

  /**
   * Create a bullet list block with emojis
   */
  createBulletListBlock(items: string[], emoji?: string): EnhancedBlock {
    const block: Partial<EnhancedBlock> = {
      type: 'bullet-list',
      items: emoji ? items.map((item) => this.addEmoji(item, emoji)) : items,
    };

    return this.applyDefaultStyles(block);
  }

  /**
   * Create a paragraph block with optional card style
   */
  createParagraphBlock(
    content: string,
    cardStyle: boolean = false,
    customStyle?: Partial<BaseBlockStyle>,
  ): EnhancedBlock {
    const block: Partial<EnhancedBlock> = {
      type: 'paragraph',
      content,
      cardStyle,
      style: customStyle,
    };

    return this.applyDefaultStyles(block);
  }

  /**
   * Create a logo block
   */
  createLogoBlock(
    name: string,
    description: string,
    imageUrl?: string,
    placeholder?: string,
  ): EnhancedBlock {
    const block: Partial<EnhancedBlock> = {
      type: 'logo',
      name,
      description,
      imageUrl,
      placeholder: placeholder || '🏢',
    };

    return this.applyDefaultStyles(block);
  }

  /**
   * Create a callout block
   */
  createCalloutBlock(
    content: string,
    variant: 'info' | 'success' | 'warning' | 'error' | 'tip' = 'info',
    title?: string,
    icon?: string,
  ): EnhancedBlock {
    const defaultIcons = {
      info: '💡',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      tip: '💡',
    };

    const block: Partial<EnhancedBlock> = {
      type: 'callout',
      content,
      title,
      icon: icon || defaultIcons[variant],
      variant,
    };

    return this.applyDefaultStyles(block);
  }

  /**
   * Batch process multiple blocks
   */
  processBlocks(blocks: Partial<EnhancedBlock>[]): EnhancedBlock[] {
    return blocks.map((block) => this.applyDefaultStyles(block));
  }

  /**
   * Generate a complete slide with varied styles
   */
  generateStyledSlide(
    title: string,
    content: Array<{
      type: string;
      content: string;
      options?: {
        cardStyle?: boolean;
        title?: string;
        icon?: string;
        variant?: 'default' | 'info' | 'success' | 'warning' | 'error' | 'tip';
        chartType?: 'bar' | 'line' | 'pie' | 'doughnut';
        dataQuery?: string;
        useRealTimeData?: boolean;
      };
    }>,
  ): EnhancedBlock[] {
    const blocks: EnhancedBlock[] = [];

    // Add title
    blocks.push(this.createHeadingBlock(title, '🎯'));

    // Process content blocks
    for (const item of content) {
      switch (item.type) {
        case 'paragraph':
          blocks.push(
            this.createParagraphBlock(
              item.content,
              item.options?.cardStyle || false,
            ),
          );
          break;

        case 'bullet-list': {
          const items = item.content.split('\n').filter((i) => i.trim());
          blocks.push(this.createBulletListBlock(items, '✓'));
          break;
        }

        case 'card':
          blocks.push(
            this.createCardBlock(
              item.content,
              item.options?.title,
              item.options?.icon,
              item.options?.variant === 'default' ||
                item.options?.variant === 'info' ||
                item.options?.variant === 'success' ||
                item.options?.variant === 'warning' ||
                item.options?.variant === 'error'
                ? item.options.variant
                : 'default',
            ),
          );
          break;

        case 'chart':
          blocks.push(
            this.createChartBlock(
              item.options?.title || 'Chart',
              item.options?.chartType || 'bar',
              item.options?.dataQuery,
              item.options?.useRealTimeData !== false,
            ),
          );
          break;

        case 'callout':
          blocks.push(
            this.createCalloutBlock(
              item.content,
              item.options?.variant === 'info' ||
                item.options?.variant === 'success' ||
                item.options?.variant === 'warning' ||
                item.options?.variant === 'error' ||
                item.options?.variant === 'tip'
                ? item.options.variant
                : 'info',
              item.options?.title,
              item.options?.icon,
            ),
          );
          break;

        default:
          // Default to paragraph
          blocks.push(this.createParagraphBlock(item.content));
      }
    }

    return blocks;
  }
}
