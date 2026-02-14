/**
 * Enhanced Block Types for Rich Presentations
 * Supports charts, emojis, logos, card styles, and varied text colors
 */

export interface BaseBlockStyle {
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontWeight?: string | number;
  fontStyle?: 'normal' | 'italic';
  lineHeight?: string | number;
  padding?: string;
  margin?: string;
  borderRadius?: string;
  borderColor?: string;
  borderWidth?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  cardStyle?: boolean; // Apply card styling
  boxShadow?: string;
}

export interface EmojiStyle {
  emoji?: string; // Emoji to display with content
  emojiPosition?: 'before' | 'after' | 'inline';
  emojiSize?: string;
}

export interface HeadingBlock {
  type: 'heading';
  content: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  style?: BaseBlockStyle & EmojiStyle;
}

export interface SubheadingBlock {
  type: 'subheading';
  content: string;
  style?: BaseBlockStyle & EmojiStyle;
}

export interface ParagraphBlock {
  type: 'paragraph';
  content: string;
  style?: BaseBlockStyle & EmojiStyle;
  cardStyle?: boolean; // Render as card
}

export interface BulletListBlock {
  type: 'bullet-list';
  items: string[]; // Items can include emojis
  style?: BaseBlockStyle;
}

export interface NumberedListBlock {
  type: 'numbered-list';
  items: string[]; // Items can include emojis
  style?: BaseBlockStyle;
}

export interface CardBlock {
  type: 'card';
  title?: string;
  content: string;
  icon?: string; // Emoji or icon class
  style?: BaseBlockStyle & {
    shadowLevel?: 'none' | 'low' | 'medium' | 'high';
  };
}

export interface QuoteBlock {
  type: 'quote';
  content: string;
  author?: string;
  style?: BaseBlockStyle;
}

export interface ChartBlock {
  type: 'chart';
  title: string;
  chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'scatter';
  chartData?: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
    }>;
    options?: Record<string, unknown>;
  };
  dataQuery?: string; // For real-time data fetching
  useRealTimeData?: boolean;
  fallbackData?: {
    labels: string[];
    values: number[];
  };
  style?: BaseBlockStyle;
}

export interface LogoBlock {
  type: 'logo';
  name: string;
  description: string;
  imageUrl?: string;
  placeholder?: string; // Placeholder text/emoji
  style?: BaseBlockStyle & {
    logoSize?: 'small' | 'medium' | 'large';
  };
}

export interface LogoGridBlock {
  type: 'logo-grid';
  logos: Array<{
    name: string;
    description: string;
    imageUrl?: string;
    placeholder?: string;
  }>;
  columns?: number;
  style?: BaseBlockStyle;
}

export interface CalloutBlock {
  type: 'callout';
  title?: string;
  content: string;
  icon?: string; // Emoji or icon
  variant?: 'info' | 'success' | 'warning' | 'error' | 'tip';
  style?: BaseBlockStyle;
}

export interface DividerBlock {
  type: 'divider';
  style?: BaseBlockStyle;
}

export interface CodeBlock {
  type: 'code';
  content: string;
  language?: string;
  style?: BaseBlockStyle;
}

export interface TableBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
  style?: BaseBlockStyle;
}

export type EnhancedBlock =
  | HeadingBlock
  | SubheadingBlock
  | ParagraphBlock
  | BulletListBlock
  | NumberedListBlock
  | CardBlock
  | QuoteBlock
  | ChartBlock
  | LogoBlock
  | LogoGridBlock
  | CalloutBlock
  | DividerBlock
  | CodeBlock
  | TableBlock;

/**
 * Color palette for different text styles
 */
export const TEXT_COLOR_PALETTE = {
  heading: '#1a73e8', // Blue
  subheading: '#5f6368', // Dark Gray
  paragraph: '#202124', // Black
  list: '#202124', // Black
  highlight: '#ea4335', // Red
  callout: '#34a853', // Green
  quote: '#34a853', // Green
  muted: '#80868b', // Light Gray
  link: '#1a73e8', // Blue
  success: '#34a853', // Green
  warning: '#fbbc04', // Yellow
  error: '#ea4335', // Red
  info: '#1a73e8', // Blue
};

/**
 * Card style variants
 */
export const CARD_STYLES = {
  default: {
    backgroundColor: '#ffffff',
    borderColor: '#dadce0',
    borderWidth: '1px',
    borderRadius: '8px',
    padding: '20px',
    shadowLevel: 'low',
  },
  info: {
    backgroundColor: '#e8f0fe',
    borderColor: '#1a73e8',
    borderWidth: '2px',
    borderRadius: '8px',
    padding: '20px',
    shadowLevel: 'medium',
  },
  success: {
    backgroundColor: '#e6f4ea',
    borderColor: '#34a853',
    borderWidth: '2px',
    borderRadius: '8px',
    padding: '20px',
    shadowLevel: 'medium',
  },
  warning: {
    backgroundColor: '#fef7e0',
    borderColor: '#fbbc04',
    borderWidth: '2px',
    borderRadius: '8px',
    padding: '20px',
    shadowLevel: 'medium',
  },
  error: {
    backgroundColor: '#fce8e6',
    borderColor: '#ea4335',
    borderWidth: '2px',
    borderRadius: '8px',
    padding: '20px',
    shadowLevel: 'medium',
  },
} as const;

/**
 * Shadow levels for elevated elements
 */
export const SHADOW_LEVELS = {
  none: 'none',
  low: '0 1px 2px 0 rgba(60, 64, 67, 0.3)',
  medium:
    '0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15)',
  high: '0 8px 10px 1px rgba(60, 64, 67, 0.15), 0 3px 14px 2px rgba(60, 64, 67, 0.12)',
};
