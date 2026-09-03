import { BlockType } from '@prisma/client';
import type { GeneratedBlock } from './ai.service';
import {
  isBannedFiller,
  isGenericKicker,
  looksLikeMockStatistic,
} from './slide-recipes';

export interface MappedPrismaBlock {
  blockType: BlockType;
  content: Record<string, unknown>;
  style: Record<string, unknown>;
}

function splitPipe(value: string): string[] {
  return value
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function asItems(block: GeneratedBlock): string[] {
  if (block.items?.length) {
    return block.items.map((item) => item.trim()).filter(Boolean);
  }
  if (block.content.includes('|')) {
    return splitPipe(block.content);
  }
  return block.content ? [block.content] : [];
}

export function mapGeneratedBlock(
  block: GeneratedBlock,
  extras?: { variant?: string },
): MappedPrismaBlock | null {
  const aiType = (block.type || 'paragraph').toLowerCase();
  const haystack = [block.content, block.label, ...(block.items || [])]
    .filter(Boolean)
    .join(' ');
  if (!haystack.trim()) return null;
  if (isBannedFiller(haystack) || looksLikeMockStatistic(haystack)) {
    return null;
  }

  if (aiType === 'kicker' || extras?.variant === 'kicker') {
    if (isGenericKicker(block.content)) return null;
    return {
      blockType: BlockType.SUBHEADING,
      content: { text: block.content },
      style: { variant: 'kicker' },
    };
  }

  if (aiType === 'image' || aiType === 'image-placeholder') {
    return {
      blockType: BlockType.IMAGE,
      content: {
        url: block.embedUrl || block.content,
        alt: block.label || 'Generated image',
      },
      style: {},
    };
  }

  if (aiType === 'statistic' || aiType === 'stats-grid') {
    const items = asItems(block);
    const structured =
      block.value || block.label
        ? [{ value: block.value || block.content, label: block.label || '' }]
        : items.map((item) => {
            const [value, ...rest] = item.split(/[:–-]/);
            return {
              value: value.trim(),
              label: rest.join(':').trim() || item,
            };
          });
    return {
      blockType: BlockType.STATS_GRID,
      content: {
        items: structured.map(
          (s) => `${s.value}${s.label ? ` ${s.label}` : ''}`,
        ),
        stats: structured,
      },
      style: { variant: 'data-emphasis' },
    };
  }

  if (aiType === 'comparison' || aiType === 'comparison-item') {
    return {
      blockType: BlockType.COMPARISON,
      content: { items: asItems(block) },
      style: {},
    };
  }

  if (aiType === 'timeline' || aiType === 'timeline-item') {
    return {
      blockType: BlockType.TIMELINE,
      content: { items: asItems(block) },
      style: {},
    };
  }

  if (aiType === 'quote') {
    return {
      blockType: BlockType.QUOTE,
      content: { text: block.content },
      style: { variant: 'quote-accent' },
    };
  }

  if (aiType === 'call-to-action' || aiType === 'callout') {
    return {
      blockType: BlockType.CALL_TO_ACTION,
      content: { text: block.content },
      style: { variant: 'callout' },
    };
  }

  if (aiType === 'card' || aiType === 'icon-text') {
    return {
      blockType: BlockType.PARAGRAPH,
      content: { text: block.content },
      style: { variant: aiType === 'card' ? 'card' : 'icon-text' },
    };
  }

  if (aiType === 'bullet' || aiType === 'bullet-list') {
    return {
      blockType: BlockType.BULLET_LIST,
      content: { items: asItems(block) },
      style: {},
    };
  }

  if (aiType === 'numbered' || aiType === 'numbered-list') {
    return {
      blockType: BlockType.NUMBERED_LIST,
      content: { items: asItems(block) },
      style: {},
    };
  }

  if (aiType === 'chart') {
    return {
      blockType: BlockType.CHART,
      content: {
        text: block.content,
        ...(block.chartData ? { chartData: block.chartData } : {}),
      },
      style: {},
    };
  }

  if (aiType === 'heading') {
    return {
      blockType: BlockType.HEADING,
      content: { text: block.content },
      style: {},
    };
  }

  if (aiType === 'subheading') {
    return {
      blockType: BlockType.SUBHEADING,
      content: { text: block.content },
      style: {},
    };
  }

  return {
    blockType: BlockType.PARAGRAPH,
    content: { text: block.content },
    style: extras?.variant ? { variant: extras.variant } : {},
  };
}

export function materializeGeneratedBlocks(
  blocks: GeneratedBlock[],
): MappedPrismaBlock[] {
  return mergeConsecutiveLists(
    blocks
      .map((block) => mapGeneratedBlock(block))
      .filter((block): block is MappedPrismaBlock => Boolean(block)),
  );
}

export function mergeConsecutiveLists(
  mapped: MappedPrismaBlock[],
): MappedPrismaBlock[] {
  const result: MappedPrismaBlock[] = [];
  for (const block of mapped) {
    const prev = result[result.length - 1];
    const isList =
      block.blockType === BlockType.BULLET_LIST ||
      block.blockType === BlockType.NUMBERED_LIST;
    if (
      isList &&
      prev &&
      prev.blockType === block.blockType &&
      Array.isArray(prev.content.items) &&
      Array.isArray(block.content.items)
    ) {
      prev.content.items = [
        ...(prev.content.items as string[]),
        ...(block.content.items as string[]),
      ];
      continue;
    }
    const isStats = block.blockType === BlockType.STATS_GRID;
    if (
      isStats &&
      prev &&
      prev.blockType === BlockType.STATS_GRID &&
      Array.isArray(prev.content.items) &&
      Array.isArray(block.content.items)
    ) {
      prev.content.items = [
        ...(prev.content.items as string[]),
        ...(block.content.items as string[]),
      ];
      const prevStats = Array.isArray(prev.content.stats)
        ? prev.content.stats
        : [];
      const nextStats = Array.isArray(block.content.stats)
        ? block.content.stats
        : [];
      prev.content.stats = [...prevStats, ...nextStats];
      continue;
    }
    result.push(block);
  }
  return result;
}
